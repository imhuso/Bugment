import { EventEmitter } from "events";
interface StatusResponse {
    loggedIn: boolean;
    syncPercentage?: number;
}
export declare class AugmentIPCClient extends EventEmitter {
    private static readonly VIM_VERSION;
    private static readonly PLUGIN_VERSION;
    private requestId;
    private pendingRequests;
    private serverProcess;
    private serverPath;
    private isInitialized;
    private connectionTimeout;
    private requestTimeout;
    constructor(serverPath?: string);
    startServer(basePath: string): Promise<void>;
    private _spawnServerProcess;
    private _initializeServer;
    stopServer(): void;
    private _cleanup;
    private _sendRequest;
    private _handleMessage;
    private handleNotification;
    getStatus(): Promise<StatusResponse>;
    sendMessage(message: string, filePath: string): Promise<any>;
    isRunning(): boolean;
    isReady(): boolean;
}
export {};
//# sourceMappingURL=augment-client.d.ts.map