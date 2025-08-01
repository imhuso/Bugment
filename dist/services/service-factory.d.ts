import { ICodeAnalyzer, IRuleManager, IAIReviewer, IReviewHistoryManager, IReviewFormatter, IGitHubReviewPublisher } from "../types";
/**
 * 服务工厂
 * 负责创建和配置所有服务实例
 */
export declare class ServiceFactory {
    /**
     * 创建代码分析器
     */
    static createCodeAnalyzer(): ICodeAnalyzer;
    /**
     * 创建规则管理器
     */
    static createRuleManager(): IRuleManager;
    /**
     * 创建 AI 审查器
     */
    static createAIReviewer(): IAIReviewer;
    /**
     * 创建历史审查管理器
     */
    static createReviewHistoryManager(): IReviewHistoryManager;
    /**
     * 创建审查格式化器
     */
    static createReviewFormatter(): IReviewFormatter;
    /**
     * 创建 GitHub 审查发布器
     */
    static createGitHubReviewPublisher(): IGitHubReviewPublisher;
    /**
     * 创建所有服务的完整集合
     */
    static createAllServices(): {
        codeAnalyzer: ICodeAnalyzer;
        ruleManager: IRuleManager;
        aiReviewer: IAIReviewer;
        historyManager: IReviewHistoryManager;
        reviewFormatter: IReviewFormatter;
        githubPublisher: IGitHubReviewPublisher;
    };
}
//# sourceMappingURL=service-factory.d.ts.map