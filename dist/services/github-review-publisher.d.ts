import { IGitHubReviewPublisher, GitHubReviewOutput, PullRequestInfo } from "../types";
/**
 * Step 4: GitHub 审查发布器
 * 负责将格式化后的审查结果发布到 GitHub
 */
export declare class GitHubReviewPublisher implements IGitHubReviewPublisher {
    private octokit;
    constructor();
    /**
     * 发布审查到 GitHub
     */
    publishReview(reviewOutput: GitHubReviewOutput, prInfo: PullRequestInfo): Promise<void>;
    /**
     * 验证行级评论的有效性
     * 确保评论指向的文件和行号在 PR diff 中存在
     */
    private validateLineComments;
    /**
     * 检查是否有权限发布审查
     */
    checkPermissions(prInfo: PullRequestInfo): Promise<boolean>;
    /**
     * 获取 PR 的当前状态
     */
    getPRStatus(prInfo: PullRequestInfo): Promise<{
        state: string;
        mergeable: boolean | null;
        draft: boolean;
    }>;
}
//# sourceMappingURL=github-review-publisher.d.ts.map