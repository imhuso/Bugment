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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIReviewer = void 0;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const augment_client_1 = require("./augment-client");
/**
 * Step 2: AI 审查器
 * 负责调用 AI 进行代码审查
 */
class AIReviewer {
    /**
     * 执行 AI 代码审查
     */
    async performReview(context) {
        core.info("🤖 Starting AI code review...");
        try {
            // 设置 Augment 认证
            await this.setupAugmentAuth(context);
            // 启动 Augment 客户端
            this.client = new augment_client_1.AugmentIPCClient();
            await this.client.startServer(context.workspaceDir);
            // 等待同步完成
            await this.waitForSync();
            // 构建完整的审查提示
            const reviewPrompt = this.buildReviewPrompt(context);
            // 发送审查请求
            const result = await this.client.sendMessage(reviewPrompt, context.workspaceDir);
            const reviewId = this.generateReviewId();
            const timestamp = new Date().toISOString();
            core.info("✅ AI review completed successfully");
            return {
                rawOutput: result.text,
                timestamp,
                reviewId,
                commitSha: context.codeChanges.prInfo.headSha
            };
        }
        catch (error) {
            throw new Error(`AI review failed: ${error}`);
        }
        finally {
            // 清理资源
            if (this.client) {
                this.client.stopServer();
            }
        }
    }
    /**
     * 设置 Augment 认证
     */
    async setupAugmentAuth(_context) {
        core.info("🔐 Setting up Augment authentication...");
        // 从环境变量获取认证信息
        const accessToken = process.env.INPUT_AUGMENT_ACCESS_TOKEN;
        const tenantUrl = process.env.INPUT_AUGMENT_TENANT_URL;
        if (!accessToken || !tenantUrl) {
            throw new Error("Missing Augment authentication credentials");
        }
        const configDir = path.join(process.env.HOME || "~", ".local/share/vim-augment");
        const configFile = path.join(configDir, "secrets.json");
        // 创建配置目录
        await fs.promises.mkdir(configDir, { recursive: true });
        // 创建认证配置
        const authConfig = {
            "augment.sessions": JSON.stringify({
                accessToken,
                tenantURL: tenantUrl,
                scopes: ["email"]
            })
        };
        await fs.promises.writeFile(configFile, JSON.stringify(authConfig, null, 2));
        core.info("✅ Augment authentication configured");
    }
    /**
     * 等待 Augment 同步完成
     */
    async waitForSync() {
        if (!this.client) {
            throw new Error("Client not initialized");
        }
        core.info("⏳ Waiting for Augment synchronization...");
        // 增加最大重试次数并添加更详细的日志
        for (let attempt = 0; attempt < 600; attempt++) { // 增加到 10 分钟
            try {
                const status = await this.client.getStatus();
                core.info(`🔄 Sync status: ${status.syncPercentage || 0}% (attempt ${attempt + 1}/600)`);
                if (status.syncPercentage === 100) {
                    core.info("✅ Augment synchronization completed");
                    return;
                }
                // 显示进度更新（每 30 秒显示一次）
                if (attempt > 0 && attempt % 30 === 0) {
                    core.info(`🔄 Still syncing... ${status.syncPercentage || 0}% complete (${Math.floor(attempt / 60)} minutes elapsed)`);
                }
                if (attempt === 599) {
                    throw new Error(`Server synchronization timeout after 600 attempts (10 minutes). Last sync percentage: ${status.syncPercentage || 0}%`);
                }
                // 等待1秒后重试
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            catch (error) {
                core.warning(`⚠️ Sync status check failed (attempt ${attempt + 1}): ${error}`);
                // 如果是最后几次尝试，抛出错误
                if (attempt >= 590) {
                    throw new Error(`Failed to get sync status after ${attempt + 1} attempts: ${error}`);
                }
                // 等待1秒后重试
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }
    /**
     * 构建完整的审查提示
     */
    buildReviewPrompt(context) {
        let prompt = context.prompt;
        // 替换基本信息
        prompt = prompt
            .replace("{PR_TITLE}", context.codeChanges.prInfo.title || "No title provided")
            .replace("{PR_DESCRIPTION}", context.codeChanges.prInfo.body || "No description provided")
            .replace("{DIFF_CONTENT}", context.codeChanges.diffContent || "No diff content available")
            .replace("{PROJECT_RULES}", context.projectRules.rulesContent || "无项目规则文件");
        // 添加 GitHub 仓库信息
        if (context.githubInfo) {
            const githubInfo = `

## GitHub 仓库信息
- 仓库: ${context.githubInfo.repoOwner}/${context.githubInfo.repoName}
- 提交: ${context.githubInfo.commitSha}
- 基础链接: https://github.com/${context.githubInfo.repoOwner}/${context.githubInfo.repoName}/blob/${context.githubInfo.commitSha}/`;
            prompt += githubInfo;
        }
        return prompt;
    }
    /**
     * 生成审查 ID
     */
    generateReviewId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `review_${timestamp}_${random}`;
    }
}
exports.AIReviewer = AIReviewer;
//# sourceMappingURL=ai-reviewer.js.map