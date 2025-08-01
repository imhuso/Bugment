/**
 * 文件忽略管理器
 * 支持类似 .gitignore 的模式匹配
 */
export declare class IgnoreManager {
    private patterns;
    private defaultPatterns;
    constructor(projectPath: string, useDefaults?: boolean);
    /**
     * 从项目根目录加载 .bugmentignore 文件
     */
    private loadIgnoreFile;
    /**
     * 解析忽略文件内容
     */
    private parseIgnoreFile;
    /**
     * 检查文件是否应该被忽略
     */
    shouldIgnore(filePath: string): boolean;
    /**
     * 模式匹配逻辑
     * 支持基本的 glob 模式：*, **, ?
     */
    private matchPattern;
    /**
     * 将 glob 模式转换为正则表达式
     */
    private globToRegex;
    /**
     * 获取所有忽略模式（用于调试）
     */
    getPatterns(): string[];
    /**
     * 添加自定义忽略模式
     */
    addPattern(pattern: string): void;
    /**
     * 批量过滤文件列表
     */
    filterFiles(files: string[]): string[];
}
//# sourceMappingURL=ignore-manager.d.ts.map