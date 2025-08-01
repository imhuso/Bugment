import { IRuleManager, ProjectRules } from "./types";
/**
 * 规则管理器
 * 负责读取和管理项目规则文件
 */
export declare class RuleManager implements IRuleManager {
    private projectPath;
    private rulesCache;
    private processedFiles;
    constructor(projectPath: string);
    /**
     * 加载项目规则文件
     * 实现 IRuleManager 接口
     */
    loadProjectRules(projectPath: string): Promise<ProjectRules>;
    /**
     * 加载所有规则文件
     * 从 .augment/rules 开始，递归查找所有 .md 文件
     * 让 AI 自己分析规则内容和引用关系
     */
    private loadAllRules;
    /**
     * 从指定目录递归加载规则文件
     */
    private loadRulesFromDirectory;
    /**
     * 加载单个规则文件
     */
    private loadRuleFile;
    /**
     * 构建完整的规则内容字符串
     */
    private buildRulesContent;
    /**
     * 获取规则文件列表
     */
    getRuleFiles(): string[];
    /**
     * 获取特定规则文件的内容
     */
    getRuleContent(filePath: string): string | undefined;
    /**
     * 检查是否有规则文件
     */
    hasRules(): boolean;
}
//# sourceMappingURL=rule-manager.d.ts.map