import {
  ICodeAnalyzer,
  IRuleManager,
  IAIReviewer,
  IReviewHistoryManager,
  IReviewFormatter,
  IGitHubReviewPublisher
} from "../types";

import { CodeAnalyzer } from "./code-analyzer";
import { RuleManager } from "../rule-manager";
import { AIReviewer } from "./ai-reviewer";
import { ReviewHistoryManager } from "./review-history-manager";
import { ReviewFormatter } from "./review-formatter";
import { GitHubReviewPublisher } from "./github-review-publisher";

/**
 * 服务工厂
 * 负责创建和配置所有服务实例
 */
export class ServiceFactory {
  
  /**
   * 创建代码分析器
   */
  static createCodeAnalyzer(): ICodeAnalyzer {
    return new CodeAnalyzer();
  }

  /**
   * 创建规则管理器
   */
  static createRuleManager(): IRuleManager {
    return new RuleManager("");
  }

  /**
   * 创建 AI 审查器
   */
  static createAIReviewer(): IAIReviewer {
    return new AIReviewer();
  }

  /**
   * 创建历史审查管理器
   */
  static createReviewHistoryManager(): IReviewHistoryManager {
    return new ReviewHistoryManager();
  }

  /**
   * 创建审查格式化器
   */
  static createReviewFormatter(): IReviewFormatter {
    return new ReviewFormatter();
  }

  /**
   * 创建 GitHub 审查发布器
   */
  static createGitHubReviewPublisher(): IGitHubReviewPublisher {
    return new GitHubReviewPublisher();
  }

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
  } {
    return {
      codeAnalyzer: this.createCodeAnalyzer(),
      ruleManager: this.createRuleManager(),
      aiReviewer: this.createAIReviewer(),
      historyManager: this.createReviewHistoryManager(),
      reviewFormatter: this.createReviewFormatter(),
      githubPublisher: this.createGitHubReviewPublisher()
    };
  }
}
