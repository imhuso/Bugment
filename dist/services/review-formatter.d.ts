import { IReviewFormatter, AIReviewResult, StructuredReviewResult, PullRequestInfo, GitHubReviewOutput } from "../types";
/**
 * Step 4: 审查格式化器
 * 负责解析 AI 输出并格式化为 GitHub Review 格式
 */
export declare class ReviewFormatter implements IReviewFormatter {
    /**
     * 解析 AI 输出为结构化数据
     */
    parseAIOutput(aiResult: AIReviewResult): StructuredReviewResult;
    /**
     * 格式化为 GitHub Review 格式
     */
    formatForGitHub(structuredResult: StructuredReviewResult, prInfo: PullRequestInfo): GitHubReviewOutput;
    /**
     * 从指定部分解析问题
     */
    private parseIssuesFromSection;
    /**
     * 解析单个问题
     */
    private parseIndividualIssues;
    /**
     * 解析问题内容
     */
    private parseIssueContent;
    /**
     * 映射严重程度
     */
    private mapSeverity;
    /**
     * 解析位置信息
     */
    private parseLocationInfo;
    /**
     * 提取总结
     */
    private extractSummaryFromReview;
    /**
     * 生成主评论内容
     */
    private generateMainReviewBody;
    /**
     * 生成问题统计
     */
    private generateIssueStatistics;
    /**
     * 生成行级评论
     */
    private generateLineComments;
    /**
     * 格式化问题评论
     */
    private formatIssueComment;
    /**
     * 确定审查事件类型
     */
    private determineReviewEvent;
}
//# sourceMappingURL=review-formatter.d.ts.map