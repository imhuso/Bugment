import { IAIReviewer, AIAnalysisContext, AIReviewResult } from "../types";
/**
 * Step 2: AI 审查器
 * 负责调用 AI 进行代码审查
 */
export declare class AIReviewer implements IAIReviewer {
    private client?;
    /**
     * 执行 AI 代码审查
     */
    performReview(context: AIAnalysisContext): Promise<AIReviewResult>;
    /**
     * 设置 Augment 认证
     */
    private setupAugmentAuth;
    /**
     * 等待 Augment 同步完成
     */
    private waitForSync;
    /**
     * 构建完整的审查提示
     */
    private buildReviewPrompt;
    /**
     * 生成审查 ID
     */
    private generateReviewId;
}
//# sourceMappingURL=ai-reviewer.d.ts.map