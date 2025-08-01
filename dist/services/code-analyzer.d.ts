import { ICodeAnalyzer, PullRequestInfo, CodeAnalysisResult } from "../types";
/**
 * Step 1: 代码分析器
 * 负责获取和分析 PR 中的代码变更
 */
export declare class CodeAnalyzer implements ICodeAnalyzer {
    private ignoreManager?;
    /**
     * 分析 PR 中的代码变更
     */
    analyzeChanges(prInfo: PullRequestInfo, workspaceDir: string): Promise<CodeAnalysisResult>;
    /**
     * 获取实际的 base SHA
     * 处理 GitHub Actions 中的 merge commit 情况
     */
    private getActualBaseSha;
    /**
     * 检查是否是 merge commit
     */
    private checkIfMergeCommit;
    /**
     * 获取 merge commit 的第一个父提交
     */
    private getFirstParent;
    /**
     * 生成 diff 内容
     */
    private generateDiff;
    /**
     * 解析 diff 内容为结构化数据
     */
    private parseDiff;
}
//# sourceMappingURL=code-analyzer.d.ts.map