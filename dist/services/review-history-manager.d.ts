import { IReviewHistoryManager, PullRequestInfo, ReviewCleanupResult } from "../types";
/**
 * Step 3: 历史审查管理器
 * 负责管理和清理之前的审查记录
 */
export declare class ReviewHistoryManager implements IReviewHistoryManager {
    private octokit;
    constructor();
    /**
     * 清理之前的审查记录
     */
    cleanupPreviousReviews(prInfo: PullRequestInfo): Promise<ReviewCleanupResult>;
    /**
     * 获取之前的 Bugment 审查记录
     */
    private getPreviousReviews;
    /**
     * 隐藏之前的审查评论
     */
    private hidePreviousReviews;
    /**
     * 解决之前的审查线程
     */
    private resolvePreviousThreads;
    /**
     * 使用 GraphQL API 隐藏审查评论
     */
    private hideReviewComment;
    /**
     * 获取审查线程
     */
    private getReviewThreads;
    /**
     * 解决审查线程
     */
    private resolveReviewThread;
    /**
     * 检查是否是 Bugment 生成的审查
     */
    private isBugmentReview;
    /**
     * 检查是否是 AI 生成的线程
     */
    private isAIGeneratedThread;
}
//# sourceMappingURL=review-history-manager.d.ts.map