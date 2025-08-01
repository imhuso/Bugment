"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AugmentIPCClient = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const path = __importStar(require("path"));
const p_retry_1 = __importDefault(require("p-retry"));
const p_timeout_1 = __importDefault(require("p-timeout"));
class AugmentIPCClient extends events_1.EventEmitter {
    constructor(serverPath) {
        super();
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.serverProcess = null;
        this.isInitialized = false;
        this.connectionTimeout = 120000; // 增加到 2 分钟
        this.requestTimeout = 180000; // 增加到 3 分钟
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
    async startServer(basePath) {
        if (this.serverProcess) {
            throw new Error("Server is already running");
        }
        return (0, p_timeout_1.default)((0, p_retry_1.default)(async () => {
            await this._spawnServerProcess();
            await this._initializeServer(basePath);
        }, {
            retries: 5, // 增加重试次数
            minTimeout: 2000, // 增加最小超时
            maxTimeout: 10000, // 增加最大超时
            onFailedAttempt: (error) => {
                console.warn(`⚠️ Attempt ${error.attemptNumber}/${5} failed: ${error.message}`);
                this._cleanup();
            },
        }), {
            milliseconds: this.connectionTimeout,
            message: "Server startup timeout",
        });
    }
    async _spawnServerProcess() {
        return new Promise((resolve, reject) => {
            console.log(`🚀 Starting Augment server from: ${this.serverPath}`);
            // 检查服务器文件是否存在
            if (!require('fs').existsSync(this.serverPath)) {
                reject(new Error(`Server file not found: ${this.serverPath}`));
                return;
            }
            this.serverProcess = (0, child_process_1.spawn)("node", [this.serverPath, "--node-ipc"], {
                stdio: ["pipe", "pipe", "pipe", "ipc"],
                env: { ...process.env },
            });
            let processStarted = false;
            // IPC 消息监听
            this.serverProcess.on("message", (message) => {
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
                    }
                    else {
                        reject(new Error("Server process failed to start within timeout"));
                    }
                }
            }, 3000); // 增加到 3 秒
        });
    }
    async _initializeServer(basePath) {
        console.log(`🚀 Initializing server with workspace: ${basePath}`);
        const initParams = {
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
    stopServer() {
        this._cleanup();
    }
    _cleanup() {
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
    async _sendRequest(method, params) {
        if (!this.serverProcess) {
            throw new Error("Server is not running");
        }
        const id = ++this.requestId;
        const message = {
            jsonrpc: "2.0",
            id,
            method,
            params,
        };
        return (0, p_timeout_1.default)(new Promise((resolve, reject) => {
            this.pendingRequests.set(id, {
                resolve,
                reject,
                timestamp: Date.now(),
            });
            // 发送 IPC 消息
            this.serverProcess.send(message, (error) => {
                if (error) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`IPC send failed: ${error.message}`));
                }
            });
        }), {
            milliseconds: this.requestTimeout,
            message: `Request timeout: ${method}`,
        });
    }
    _handleMessage(message) {
        if (message.id !== undefined) {
            // 处理响应
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    const error = new Error(message.error.message);
                    error.code = message.error.code;
                    error.data = message.error.data;
                    pending.reject(error);
                }
                else {
                    pending.resolve(message.result);
                }
            }
        }
        else if (message.method) {
            // 处理通知
            this.handleNotification(message.method, message.params);
        }
    }
    handleNotification(method, params) {
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
    async getStatus() {
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
            const enhancedStatus = {
                loggedIn: result.loggedIn || false,
                syncPercentage: result.syncPercentage,
            };
            return enhancedStatus;
        }
        catch (error) {
            console.error("❌ Failed to get status:", error);
            console.error("Server process status:", {
                running: this.isRunning(),
                initialized: this.isInitialized,
                pid: this.serverProcess?.pid
            });
            throw error;
        }
    }
    async sendMessage(message, filePath) {
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
        }
        catch (error) {
            console.error("❌ Failed to send message:", error);
            throw error;
        }
    }
    // ========================================================================
    // Utility Methods
    // ========================================================================
    isRunning() {
        return this.serverProcess !== null && !this.serverProcess.killed;
    }
    isReady() {
        return this.isRunning() && this.isInitialized;
    }
}
exports.AugmentIPCClient = AugmentIPCClient;
AugmentIPCClient.VIM_VERSION = "9.1.754";
AugmentIPCClient.PLUGIN_VERSION = "0.25.1";
//# sourceMappingURL=augment-client.js.map