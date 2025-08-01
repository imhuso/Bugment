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
exports.GitHubReviewPublisher = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
/**
 * Step 4: GitHub 审查发布器
 * 负责将格式化后的审查结果发布到 GitHub
 */
class GitHubReviewPublisher {
    constructor() {
        const githubToken = process.env.INPUT_GITHUB_TOKEN;
        if (!githubToken) {
            throw new Error("GitHub token is required");
        }
        this.octokit = github.getOctokit(githubToken);
    }
    /**
     * 发布审查到 GitHub
     */
    async publishReview(reviewOutput, prInfo) {
        core.info(`📝 Publishing review to PR #${prInfo.number}`);
        try {
            // 构建审查参数
            const reviewParams = {
                owner: prInfo.owner,
                repo: prInfo.repo,
                pull_number: prInfo.number,
                body: reviewOutput.body,
                event: reviewOutput.event,
                commit_id: prInfo.headSha
            };
            // 添加行级评论（如果有）
            if (reviewOutput.comments.length > 0) {
                // 验证并过滤有效的行级评论
                const validComments = await this.validateLineComments(reviewOutput.comments, prInfo);
                if (validComments.length > 0) {
                    reviewParams.comments = validComments;
                    core.info(`📝 Including ${validComments.length} line comments`);
                }
                else {
                    core.info(`📝 No valid line comments found`);
                }
            }
            // 创建审查
            const response = await this.octokit.rest.pulls.createReview(reviewParams);
            core.info(`✅ Review published successfully (ID: ${response.data.id})`);
            // 设置 Action 输出
            core.setOutput("review_result", reviewOutput.body);
            core.setOutput("issues_found", reviewOutput.comments.length);
            core.setOutput("review_status", "success");
        }
        catch (error) {
            core.error(`❌ Failed to publish review: ${error}`);
            throw new Error(`Failed to publish review: ${error}`);
        }
    }
    /**
     * 验证行级评论的有效性
     * 确保评论指向的文件和行号在 PR diff 中存在
     */
    async validateLineComments(comments, prInfo) {
        const validComments = [];
        try {
            // 获取 PR 的文件列表
            const files = await this.octokit.rest.pulls.listFiles({
                owner: prInfo.owner,
                repo: prInfo.repo,
                pull_number: prInfo.number
            });
            const changedFiles = new Set(files.data.map(file => file.filename));
            for (const comment of comments) {
                // 检查文件是否在 PR 变更中
                if (!changedFiles.has(comment.path)) {
                    core.warning(`⚠️ Skipping comment for ${comment.path}: file not in PR changes`);
                    continue;
                }
                // 检查行号是否有效（简单验证）
                if (comment.line <= 0) {
                    core.warning(`⚠️ Skipping comment for ${comment.path}:${comment.line}: invalid line number`);
                    continue;
                }
                // 添加到有效评论列表
                validComments.push({
                    path: comment.path,
                    line: comment.line,
                    body: comment.body,
                    side: comment.side || "RIGHT" // 默认为右侧（新代码）
                });
            }
            core.info(`✅ Validated ${validComments.length}/${comments.length} line comments`);
            return validComments;
        }
        catch (error) {
            core.warning(`⚠️ Failed to validate line comments: ${error}`);
            // 如果验证失败，返回原始评论（让 GitHub API 处理）
            return comments.map(comment => ({
                ...comment,
                side: comment.side || "RIGHT"
            }));
        }
    }
    /**
     * 检查是否有权限发布审查
     */
    async checkPermissions(prInfo) {
        try {
            // 检查仓库权限
            const repo = await this.octokit.rest.repos.get({
                owner: prInfo.owner,
                repo: prInfo.repo
            });
            // 检查是否有写入权限
            const hasWriteAccess = repo.data.permissions?.push || repo.data.permissions?.admin;
            if (!hasWriteAccess) {
                core.warning("⚠️ No write access to repository");
                return false;
            }
            return true;
        }
        catch (error) {
            core.warning(`⚠️ Failed to check permissions: ${error}`);
            return false;
        }
    }
    /**
     * 获取 PR 的当前状态
     */
    async getPRStatus(prInfo) {
        try {
            const pr = await this.octokit.rest.pulls.get({
                owner: prInfo.owner,
                repo: prInfo.repo,
                pull_number: prInfo.number
            });
            return {
                state: pr.data.state,
                mergeable: pr.data.mergeable,
                draft: pr.data.draft || false
            };
        }
        catch (error) {
            core.warning(`⚠️ Failed to get PR status: ${error}`);
            return {
                state: "unknown",
                mergeable: null,
                draft: false
            };
        }
    }
}
exports.GitHubReviewPublisher = GitHubReviewPublisher;
//# sourceMappingURL=github-review-publisher.js.map