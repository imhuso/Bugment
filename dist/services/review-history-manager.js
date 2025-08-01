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
exports.ReviewHistoryManager = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
/**
 * Step 3: 历史审查管理器
 * 负责管理和清理之前的审查记录
 */
class ReviewHistoryManager {
    constructor() {
        const githubToken = process.env.INPUT_GITHUB_TOKEN;
        if (!githubToken) {
            throw new Error("GitHub token is required");
        }
        this.octokit = github.getOctokit(githubToken);
    }
    /**
     * 清理之前的审查记录
     */
    async cleanupPreviousReviews(prInfo) {
        core.info(`🧹 Cleaning up previous reviews for PR #${prInfo.number}`);
        try {
            // 获取之前的审查记录
            const previousReviews = await this.getPreviousReviews(prInfo);
            if (previousReviews.length === 0) {
                core.info("📝 No previous Bugment reviews found");
                return { processedCount: 0, hiddenCount: 0, resolvedCount: 0 };
            }
            // 隐藏之前的审查评论
            const hiddenCount = await this.hidePreviousReviews(prInfo, previousReviews);
            // 解决之前的审查线程
            const resolvedCount = await this.resolvePreviousThreads(prInfo);
            core.info(`✅ Cleanup completed: hidden ${hiddenCount} reviews, resolved ${resolvedCount} threads`);
            return {
                processedCount: previousReviews.length,
                hiddenCount,
                resolvedCount
            };
        }
        catch (error) {
            core.warning(`⚠️ Failed to cleanup previous reviews: ${error}`);
            return { processedCount: 0, hiddenCount: 0, resolvedCount: 0 };
        }
    }
    /**
     * 获取之前的 Bugment 审查记录
     */
    async getPreviousReviews(prInfo) {
        try {
            const reviews = await this.octokit.rest.pulls.listReviews({
                owner: prInfo.owner,
                repo: prInfo.repo,
                pull_number: prInfo.number,
                per_page: 100
            });
            const bugmentReviews = [];
            for (const review of reviews.data) {
                if (this.isBugmentReview(review.body || "")) {
                    bugmentReviews.push({
                        id: review.id,
                        body: review.body || "",
                        state: review.state,
                        submittedAt: review.submitted_at || ""
                    });
                }
            }
            core.info(`📋 Found ${bugmentReviews.length} previous Bugment reviews`);
            return bugmentReviews;
        }
        catch (error) {
            core.warning(`Failed to fetch previous reviews: ${error}`);
            return [];
        }
    }
    /**
     * 隐藏之前的审查评论
     */
    async hidePreviousReviews(prInfo, reviews) {
        let hiddenCount = 0;
        for (const review of reviews) {
            try {
                // 使用 GraphQL API 隐藏评论
                await this.hideReviewComment(review.id);
                hiddenCount++;
                core.info(`✅ Hidden review comment ${review.id}`);
            }
            catch (error) {
                core.warning(`Failed to hide review ${review.id}: ${error}`);
            }
        }
        return hiddenCount;
    }
    /**
     * 解决之前的审查线程
     */
    async resolvePreviousThreads(prInfo) {
        let resolvedCount = 0;
        try {
            // 获取 PR 的审查线程
            const threads = await this.getReviewThreads(prInfo);
            for (const thread of threads) {
                if (this.isAIGeneratedThread(thread)) {
                    try {
                        await this.resolveReviewThread(thread.id);
                        resolvedCount++;
                        core.info(`✅ Resolved conversation thread ${thread.id}`);
                    }
                    catch (error) {
                        core.warning(`Failed to resolve thread ${thread.id}: ${error}`);
                    }
                }
            }
        }
        catch (error) {
            core.warning(`Failed to resolve review threads: ${error}`);
        }
        return resolvedCount;
    }
    /**
     * 使用 GraphQL API 隐藏审查评论
     */
    async hideReviewComment(reviewId) {
        const mutation = `
      mutation($reviewId: ID!) {
        minimizeComment(input: {subjectId: $reviewId, classifier: OUTDATED}) {
          minimizedComment {
            isMinimized
          }
        }
      }
    `;
        await this.octokit.graphql(mutation, {
            reviewId: reviewId.toString()
        });
    }
    /**
     * 获取审查线程
     */
    async getReviewThreads(prInfo) {
        const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                comments(first: 10) {
                  nodes {
                    body
                    author {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
        const result = await this.octokit.graphql(query, {
            owner: prInfo.owner,
            repo: prInfo.repo,
            number: prInfo.number
        });
        return result.repository.pullRequest.reviewThreads.nodes || [];
    }
    /**
     * 解决审查线程
     */
    async resolveReviewThread(threadId) {
        const mutation = `
      mutation($threadId: ID!) {
        resolveReviewThread(input: {threadId: $threadId}) {
          thread {
            isResolved
          }
        }
      }
    `;
        await this.octokit.graphql(mutation, {
            threadId
        });
    }
    /**
     * 检查是否是 Bugment 生成的审查
     */
    isBugmentReview(body) {
        const bugmentSignatures = [
            "🤖 Powered by [Bugment AI Code Review]",
            "Bugment Code Review",
            "Bugment AI Code Review",
            "🤖 Powered by Bugment",
            "REVIEW_DATA:"
        ];
        return bugmentSignatures.some(signature => body.includes(signature));
    }
    /**
     * 检查是否是 AI 生成的线程
     */
    isAIGeneratedThread(thread) {
        if (!thread.comments?.nodes?.length) {
            return false;
        }
        const firstComment = thread.comments.nodes[0];
        return this.isBugmentReview(firstComment.body || "");
    }
}
exports.ReviewHistoryManager = ReviewHistoryManager;
//# sourceMappingURL=review-history-manager.js.map