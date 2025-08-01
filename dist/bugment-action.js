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
exports.BugmentAction = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
/**
 * 重构后的 Bugment Action 主类
 * 按照清晰的步骤流程执行代码审查
 */
class BugmentAction {
    constructor(codeAnalyzer, ruleManager, aiReviewer, historyManager, reviewFormatter, githubPublisher) {
        this.config = this.initializeConfig();
        this.codeAnalyzer = codeAnalyzer;
        this.ruleManager = ruleManager;
        this.aiReviewer = aiReviewer;
        this.historyManager = historyManager;
        this.reviewFormatter = reviewFormatter;
        this.githubPublisher = githubPublisher;
    }
    /**
     * 主执行方法 - 按步骤执行代码审查流程
     */
    async run() {
        try {
            core.info("🚀 Starting Bugment AI Code Review...");
            // Step 1: 代码获取与分析
            const codeAnalysis = await this.step1_analyzeCode();
            // Step 2: AI 分析与审查
            const aiResult = await this.step2_performAIReview(codeAnalysis);
            // Step 3: 历史审查管理
            const cleanupResult = await this.step3_cleanupHistory();
            // Step 4: 格式化与输出
            await this.step4_formatAndPublish(aiResult);
            core.info("✅ Code review completed successfully");
            return {
                success: true,
                reviewResult: aiResult.rawOutput,
                issuesFound: this.extractIssueCount(aiResult.rawOutput)
            };
        }
        catch (error) {
            const stepError = {
                step: "unknown",
                message: error instanceof Error ? error.message : String(error),
                details: error
            };
            core.setFailed(`❌ Code review failed: ${stepError.message}`);
            return {
                success: false,
                error: stepError
            };
        }
    }
    /**
     * Step 1: 代码获取与分析
     * 通过 git 拉取代码，分析 PR 中变动的代码
     */
    async step1_analyzeCode() {
        core.info("📊 Step 1: Analyzing code changes...");
        try {
            const result = await this.codeAnalyzer.analyzeChanges(this.config.prInfo, this.config.workspaceDir);
            core.info(`📁 Found changes in ${result.changes.size} files`);
            return result;
        }
        catch (error) {
            throw new Error(`Step 1 failed - Code analysis: ${error}`);
        }
    }
    /**
     * Step 2: AI 分析与审查
     * 1. 使用 action 中的 prompt
     * 2. 调用 AI 分析项目中的规则作为上下文
     * 3. 根据合并的上下文对代码进行 review
     * 4. 输出 review 结果
     */
    async step2_performAIReview(codeAnalysis) {
        core.info("🤖 Step 2: Performing AI review...");
        try {
            // 2.1 加载项目规则
            const projectRules = await this.ruleManager.loadProjectRules(this.config.workspaceDir);
            if (projectRules.hasRules) {
                core.info(`📋 Loaded ${projectRules.ruleFiles.length} rule files`);
            }
            // 2.2 构建 AI 分析上下文
            const context = {
                prompt: await this.loadPromptTemplate(),
                projectRules,
                codeChanges: codeAnalysis,
                workspaceDir: this.config.workspaceDir,
                githubInfo: {
                    repoOwner: this.config.prInfo.owner,
                    repoName: this.config.prInfo.repo,
                    commitSha: this.config.prInfo.headSha
                }
            };
            // 2.3 执行 AI 审查
            const result = await this.aiReviewer.performReview(context);
            core.info("✅ AI review completed");
            return result;
        }
        catch (error) {
            throw new Error(`Step 2 failed - AI review: ${error}`);
        }
    }
    /**
     * Step 3: 历史审查管理
     * 1. 检查 PR 中是否有之前的 review
     * 2. 如果有则关闭之前的 review
     */
    async step3_cleanupHistory() {
        core.info("🧹 Step 3: Cleaning up previous reviews...");
        try {
            const result = await this.historyManager.cleanupPreviousReviews(this.config.prInfo);
            if (result.processedCount > 0) {
                core.info(`📝 Processed ${result.processedCount} previous reviews, hidden ${result.hiddenCount}, resolved ${result.resolvedCount}`);
            }
            return result;
        }
        catch (error) {
            // 历史清理失败不应该阻止整个流程
            core.warning(`Step 3 warning - History cleanup: ${error}`);
            return { processedCount: 0, hiddenCount: 0, resolvedCount: 0 };
        }
    }
    /**
     * Step 4: 格式化与输出
     * 1. 根据 AI 输出的结构进行整理，输出 github 需要的格式
     * 2. 创建新的 PR review，按照 GitHub review 规范输出
     */
    async step4_formatAndPublish(aiResult) {
        core.info("📝 Step 4: Formatting and publishing review...");
        try {
            // 4.1 解析 AI 输出为结构化数据
            const structuredResult = this.reviewFormatter.parseAIOutput(aiResult);
            core.info(`🔍 Parsed ${structuredResult.totalIssues} issues from AI output`);
            // 4.2 格式化为 GitHub Review 格式
            const githubOutput = this.reviewFormatter.formatForGitHub(structuredResult, this.config.prInfo);
            // 4.3 发布到 GitHub
            await this.githubPublisher.publishReview(githubOutput, this.config.prInfo);
            core.info("✅ Review published to GitHub");
        }
        catch (error) {
            throw new Error(`Step 4 failed - Format and publish: ${error}`);
        }
    }
    /**
     * 初始化配置
     */
    initializeConfig() {
        const inputs = this.parseInputs();
        const prInfo = this.extractPRInfo();
        const workspaceDir = process.env.GITHUB_WORKSPACE || process.cwd();
        return {
            workspaceDir,
            inputs,
            prInfo
        };
    }
    /**
     * 解析 Action 输入参数
     */
    parseInputs() {
        return {
            augmentAccessToken: core.getInput("augment_access_token", { required: true }),
            augmentTenantUrl: core.getInput("augment_tenant_url", { required: true }),
            githubToken: core.getInput("github_token", { required: true })
        };
    }
    /**
     * 提取 PR 信息
     */
    extractPRInfo() {
        const context = github.context;
        if (!context.payload.pull_request) {
            throw new Error("This action can only be run on pull request events");
        }
        const pr = context.payload.pull_request;
        return {
            number: pr.number,
            title: pr.title || "",
            body: pr.body || "",
            baseSha: pr.base.sha,
            headSha: pr.head.sha,
            owner: context.repo.owner,
            repo: context.repo.repo
        };
    }
    /**
     * 加载 prompt 模板
     */
    async loadPromptTemplate() {
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        const promptPath = path.join(__dirname, "prompt.md");
        return fs.readFileSync(promptPath, "utf-8");
    }
    /**
     * 从 AI 输出中提取问题数量
     */
    extractIssueCount(aiOutput) {
        // 简单的问题计数逻辑，可以根据需要优化
        const issuePatterns = [
            /## \d+\./g // 匹配 "## 1.", "## 2." 等格式
        ];
        let count = 0;
        for (const pattern of issuePatterns) {
            const matches = aiOutput.match(pattern);
            if (matches) {
                count += matches.length;
            }
        }
        return count;
    }
}
exports.BugmentAction = BugmentAction;
//# sourceMappingURL=bugment-action.js.map