"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceFactory = void 0;
const code_analyzer_1 = require("./code-analyzer");
const rule_manager_1 = require("../rule-manager");
const ai_reviewer_1 = require("./ai-reviewer");
const review_history_manager_1 = require("./review-history-manager");
const review_formatter_1 = require("./review-formatter");
const github_review_publisher_1 = require("./github-review-publisher");
/**
 * 服务工厂
 * 负责创建和配置所有服务实例
 */
class ServiceFactory {
    /**
     * 创建代码分析器
     */
    static createCodeAnalyzer() {
        return new code_analyzer_1.CodeAnalyzer();
    }
    /**
     * 创建规则管理器
     */
    static createRuleManager() {
        return new rule_manager_1.RuleManager("");
    }
    /**
     * 创建 AI 审查器
     */
    static createAIReviewer() {
        return new ai_reviewer_1.AIReviewer();
    }
    /**
     * 创建历史审查管理器
     */
    static createReviewHistoryManager() {
        return new review_history_manager_1.ReviewHistoryManager();
    }
    /**
     * 创建审查格式化器
     */
    static createReviewFormatter() {
        return new review_formatter_1.ReviewFormatter();
    }
    /**
     * 创建 GitHub 审查发布器
     */
    static createGitHubReviewPublisher() {
        return new github_review_publisher_1.GitHubReviewPublisher();
    }
    /**
     * 创建所有服务的完整集合
     */
    static createAllServices() {
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
exports.ServiceFactory = ServiceFactory;
//# sourceMappingURL=service-factory.js.map