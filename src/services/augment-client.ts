import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import pRetry from "p-retry";
import pTimeout from "p-timeout";

interface StatusResponse {
  loggedIn: boolean;
  syncPercentage?: number;
}

interface LSPMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface InitializeParams {
  processId: number;
  capabilities: object;
  initializationOptions: {
    editor: string;
    vimVersion: string;
    pluginVersion: string;
  };
  workspaceFolders: any[];
}

export class AugmentIPCClient extends EventEmitter {
  private static readonly VIM_VERSION = "9.1.754";
  private static readonly PLUGIN_VERSION = "0.25.1";

  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timestamp: number;
    }
  >();
  private serverProcess: ChildProcess | null = null;
  private serverPath: string;
  private isInitialized = false;
  private connectionTimeout = 60000;
  private requestTimeout = 120000;

  constructor(serverPath: string = "./dist/server.js") {
    super();
    this.serverPath = path.resolve(serverPath);
  }

  // ========================================================================
  // Server Management
  // ========================================================================

  async startServer(basePath: string): Promise<void> {
    if (this.serverProcess) {
      throw new Error("Server is already running");
    }

    return pTimeout(
      pRetry(
        async () => {
          await this._spawnServerProcess();
          await this._initializeServer(basePath);
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 5000,
          onFailedAttempt: (error) => {
            console.warn(
              `⚠️ Attempt ${error.attemptNumber} failed: ${error.message}`
            );
            this._cleanup();
          },
        }
      ),
      {
        milliseconds: this.connectionTimeout,
        message: "Server startup timeout",
      }
    );
  }

  private async _spawnServerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn("node", [this.serverPath], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: { ...process.env },
      });

      // IPC 消息监听
      this.serverProcess.on("message", (message: LSPMessage) => {
        this._handleMessage(message);
      });

      // 进程错误监听
      this.serverProcess.on("error", (error) => {
        reject(new Error(`Server process error: ${error.message}`));
      });

      // 进程退出监听
      this.serverProcess.on("exit", (code, _signal) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      // 标准错误输出监听
      this.serverProcess.stderr?.on("data", (data) => {
        const errorText = data.toString().trim();
        if (errorText) {
          // Suppress normal stderr output unless it's an actual error
        }
      });

      // 标准输出监听（用于调试）
      this.serverProcess.stdout?.on("data", () => {
        // Suppress stdout output for cleaner logs
      });

      // 等待进程启动
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          resolve();
        } else {
          reject(new Error("Server process failed to start"));
        }
      }, 1000);
    });
  }

  private async _initializeServer(basePath: string): Promise<void> {
    const initParams: InitializeParams = {
      processId: process.pid,
      capabilities: {},
      initializationOptions: {
        editor: "vim",
        vimVersion: AugmentIPCClient.VIM_VERSION,
        pluginVersion: AugmentIPCClient.PLUGIN_VERSION,
      },
      workspaceFolders: [
        {
          uri: `file://${basePath}`,
          name: path.basename(basePath),
        },
      ],
    };

    await this._sendRequest("initialize", initParams);
    this.isInitialized = true;
  }

  stopServer(): void {
    this._cleanup();
  }

  private _cleanup(): void {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.isInitialized = false;
    this.pendingRequests.clear();
  }

  // ========================================================================
  // Communication
  // ========================================================================

  private async _sendRequest(method: string, params?: any): Promise<any> {
    if (!this.serverProcess) {
      throw new Error("Server is not running");
    }

    const id = ++this.requestId;
    const message: LSPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return pTimeout(
      new Promise((resolve, reject) => {
        this.pendingRequests.set(id, {
          resolve,
          reject,
          timestamp: Date.now(),
        });

        // 发送 IPC 消息
        this.serverProcess!.send(message, (error) => {
          if (error) {
            this.pendingRequests.delete(id);
            reject(new Error(`IPC send failed: ${error.message}`));
          }
        });
      }),
      {
        milliseconds: this.requestTimeout,
        message: `Request timeout: ${method}`,
      }
    );
  }

  private _handleMessage(message: LSPMessage): void {
    if (message.id !== undefined) {
      // 处理响应
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);

        if (message.error) {
          const error = new Error(message.error.message);
          (error as any).code = message.error.code;
          (error as any).data = message.error.data;
          pending.reject(error);
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // 处理通知
      this.handleNotification(message.method, message.params);
    }
  }

  private handleNotification(method: string, params: any): void {
    switch (method) {
      case "augment/chatChunk":
        this.emit("chatChunk", params);
        break;
      case "window/logMessage":
        console.log("Server log:", params);
        break;
      default:
        console.log("Unknown notification:", method, params);
    }
  }

  // ========================================================================
  // Status API
  // ========================================================================

  async getStatus(): Promise<StatusResponse> {
    if (!this.isInitialized) {
      throw new Error("Server is not initialized. Call startServer() first.");
    }

    try {
      const result = await this._sendRequest("augment/status");

      const enhancedStatus: StatusResponse = {
        loggedIn: result.loggedIn || false,
        syncPercentage: result.syncPercentage,
      };

      return enhancedStatus;
    } catch (error) {
      console.error("❌ Failed to get status:", error);
      throw error;
    }
  }

  async sendMessage(message: string, filePath: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error("Server is not initialized. Call startServer() first.");
    }

    try {
      const result = await this._sendRequest("augment/chat", {
        textDocumentPosition: {
          textDocument: {
            uri: `file:///${filePath}`,
          },
          position: { line: 0, character: 0 },
        },
        message,
      });

      return result;
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      throw error;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  isRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  isReady(): boolean {
    return this.isRunning() && this.isInitialized;
  }
}
