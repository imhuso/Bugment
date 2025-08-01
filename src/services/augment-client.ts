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
  private connectionTimeout = 120000; // 增加到 2 分钟
  private requestTimeout = 180000; // 增加到 3 分钟

  constructor(serverPath?: string) {
    super();
    // 在 GitHub Actions 环境中，使用正确的服务器路径
    if (!serverPath) {
      // 从当前文件位置找到 server.js
      const currentDir = __dirname;
      const projectRoot = path.resolve(currentDir, '../..');
      serverPath = path.join(projectRoot, 'dist', 'server.js');
    }
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
          retries: 5, // 增加重试次数
          minTimeout: 2000, // 增加最小超时
          maxTimeout: 10000, // 增加最大超时
          onFailedAttempt: (error) => {
            console.warn(
              `⚠️ Attempt ${error.attemptNumber}/${5} failed: ${error.message}`
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
      console.log(`🚀 Starting Augment server from: ${this.serverPath}`);
      
      // 检查服务器文件是否存在
      if (!require('fs').existsSync(this.serverPath)) {
        reject(new Error(`Server file not found: ${this.serverPath}`));
        return;
      }

      this.serverProcess = spawn("node", [this.serverPath, "--node-ipc"], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: { ...process.env },
      });

      let processStarted = false;

      // IPC 消息监听
      this.serverProcess.on("message", (message: LSPMessage) => {
        if (!processStarted) {
          console.log("📨 First IPC message received, server is ready");
          processStarted = true;
          resolve();
        }
        this._handleMessage(message);
      });

      // 进程错误监听
      this.serverProcess.on("error", (error) => {
        console.error(`❌ Server process error: ${error.message}`);
        reject(new Error(`Server process error: ${error.message}`));
      });

      // 进程退出监听
      this.serverProcess.on("exit", (code, signal) => {
        console.log(`🔚 Server process exited with code ${code}, signal ${signal}`);
        this.emit("serverExit", { code, signal });
        this._cleanup();
        if (!processStarted && code !== 0) {
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      // 标准错误输出监听
      this.serverProcess.stderr?.on("data", (data) => {
        const errorText = data.toString().trim();
        if (errorText) {
          console.warn(`⚠️ Server stderr: ${errorText}`);
        }
      });

      // 标准输出监听（用于调试）
      this.serverProcess.stdout?.on("data", (data) => {
        const outputText = data.toString().trim();
        if (outputText) {
          console.log(`📋 Server stdout: ${outputText}`);
        }
      });

      // 等待进程启动的后备方案
      setTimeout(() => {
        if (!processStarted) {
          if (this.serverProcess && !this.serverProcess.killed) {
            console.log("⏰ Server process started but no IPC message received yet");
            processStarted = true;
            resolve();
          } else {
            reject(new Error("Server process failed to start within timeout"));
          }
        }
      }, 3000); // 增加到 3 秒
    });
  }

  private async _initializeServer(basePath: string): Promise<void> {
    console.log(`🚀 Initializing server with workspace: ${basePath}`);
    
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

    console.log("📝 Sending initialize request with params:", JSON.stringify(initParams, null, 2));
    const result = await this._sendRequest("initialize", initParams);
    console.log("✅ Server initialized successfully:", JSON.stringify(result, null, 2));
    this.isInitialized = true;
  }

  stopServer(): void {
    this._cleanup();
  }

  private _cleanup(): void {
    if (this.serverProcess) {
      if (!this.serverProcess.killed) {
        console.log("🛑 Terminating server process");
        this.serverProcess.kill("SIGTERM");

        // 强制终止超时
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            console.log("💀 Force killing server process");
            this.serverProcess.kill("SIGKILL");
          }
        }, 5000);
      }
      this.serverProcess = null;
    }
    
    // 清理待处理的请求
    for (const [, request] of this.pendingRequests) {
      request.reject(new Error("Server connection closed"));
    }
    this.pendingRequests.clear();
    
    this.isInitialized = false;
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

    if (!this.serverProcess || this.serverProcess.killed) {
      throw new Error("Server process is not running");
    }

    try {
      console.log("🔍 Requesting server status...");
      const result = await this._sendRequest("augment/status");
      console.log("📊 Status response received:", JSON.stringify(result, null, 2));

      const enhancedStatus: StatusResponse = {
        loggedIn: result.loggedIn || false,
        syncPercentage: result.syncPercentage,
      };

      return enhancedStatus;
    } catch (error) {
      console.error("❌ Failed to get status:", error);
      console.error("Server process status:", {
        running: this.isRunning(),
        initialized: this.isInitialized,
        pid: this.serverProcess?.pid
      });
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
