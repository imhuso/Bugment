import { ActionResult, ICodeAnalyzer, IRuleManager, IAIReviewer, IReviewHistoryManager, IReviewFormatter, IGitHubReviewPublisher } from "./types";
/**
 * 重构后的 Bugment Action 主类
 * 按照清晰的步骤流程执行代码审查
 */
export declare class BugmentAction {
    private config;
    private codeAnalyzer;
    private ruleManager;
    private aiReviewer;
    private historyManager;
    private reviewFormatter;
    private githubPublisher;
    constructor(codeAnalyzer: ICodeAnalyzer, ruleManager: IRuleManager, aiReviewer: IAIReviewer, historyManager: IReviewHistoryManager, reviewFormatter: IReviewFormatter, githubPublisher: IGitHubReviewPublisher);
    /**
     * 主执行方法 - 按步骤执行代码审查流程
     */
    run(): Promise<ActionResult>;
    /**
     * Step 1: 代码获取与分析
     * 通过 git 拉取代码，分析 PR 中变动的代码
     */
    private step1_analyzeCode;
    /**
     * Step 2: AI 分析与审查
     * 1. 使用 action 中的 prompt
     * 2. 调用 AI 分析项目中的规则作为上下文
     * 3. 根据合并的上下文对代码进行 review
     * 4. 输出 review 结果
     */
    private step2_performAIReview;
    /**
     * Step 3: 历史审查管理
     * 1. 检查 PR 中是否有之前的 review
     * 2. 如果有则关闭之前的 review
     */
    private step3_cleanupHistory;
    /**
     * Step 4: 格式化与输出
     * 1. 根据 AI 输出的结构进行整理，输出 github 需要的格式
     * 2. 创建新的 PR review，按照 GitHub review 规范输出
     */
    private step4_formatAndPublish;
    /**
     * 初始化配置
     */
    private initializeConfig;
    /**
     * 解析 Action 输入参数
     */
    private parseInputs;
    /**
     * 提取 PR 信息
     */
    private extractPRInfo;
    /**
     * 加载 prompt 模板
     */
    private loadPromptTemplate;
    /**
     * 从 AI 输出中提取问题数量
     */
    private extractIssueCount;
}
//# sourceMappingURL=bugment-action.d.ts.map