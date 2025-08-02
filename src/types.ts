/**
 * 类型定义文件
 * 定义整个 action 流程中使用的数据结构
 */

// ============================================================================
// Step 1: 代码获取与分析相关类型
// ============================================================================

export interface PullRequestInfo {
  number: number;
  title: string;
  body: string;
  baseSha: string;
  headSha: string;
  owner: string;
  repo: string;
}

export interface CodeChange {
  filePath: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface CodeAnalysisResult {
  prInfo: PullRequestInfo;
  changes: Map<string, CodeChange[]>;
  diffContent: string;
}

// ============================================================================
// Step 2: AI 分析相关类型
// ============================================================================

export interface ProjectRules {
  hasRules: boolean;
  rulesContent: string;
  ruleFiles: string[];
}

export interface AIAnalysisContext {
  prompt: string;
  projectRules: ProjectRules;
  codeChanges: CodeAnalysisResult;
  workspaceDir: string;
  githubInfo?: {
    repoOwner: string;
    repoName: string;
    commitSha: string;
  };
}

export interface AIReviewResult {
  rawOutput: string;
  timestamp: string;
  reviewId: string;
  commitSha: string;
}

// ============================================================================
// Step 3: 历史审查管理相关类型
// ============================================================================

export interface HistoricalReview {
  id: number;        // 数字 ID，用于日志显示
  nodeId?: string;   // Node ID，用于 GraphQL API 调用
  body: string;
  state: string;
  submittedAt: string;
}

export interface ReviewCleanupResult {
  processedCount: number;
  hiddenCount: number;
  resolvedCount: number;
}

// ============================================================================
// Step 4: 格式化与输出相关类型
// ============================================================================

export type IssueSeverity = "critical" | "major" | "minor";
export type IssueType = "bug" | "code_smell" | "security" | "performance";

export interface ReviewIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  ruleReference?: string;
  location: string;
  filePath?: string;
  lineNumber?: number;
  startLine?: number;
  endLine?: number;
  suggestion?: string;
  fixPrompt?: string;
}

export interface StructuredReviewResult {
  reviewId: string;
  timestamp: string;
  commitSha: string;
  summary: string[];
  issues: ReviewIssue[];
  totalIssues: number;
}

export interface GitHubLineComment {
  path: string;
  line: number;
  body: string;
  side?: "LEFT" | "RIGHT";
}

export interface GitHubReviewOutput {
  body: string;
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comments: GitHubLineComment[];
}

// ============================================================================
// 配置和选项类型
// ============================================================================

export interface ActionInputs {
  augmentAccessToken: string;
  augmentTenantUrl: string;
  githubToken: string;
}

export interface ActionConfig {
  workspaceDir: string;
  inputs: ActionInputs;
  prInfo: PullRequestInfo;
}

// ============================================================================
// 错误处理相关类型
// ============================================================================

export interface StepError {
  step: string;
  message: string;
  details?: any;
}

export interface ActionResult {
  success: boolean;
  reviewResult?: string;
  issuesFound?: number;
  error?: StepError;
}

// ============================================================================
// 服务接口定义
// ============================================================================

export interface ICodeAnalyzer {
  analyzeChanges(prInfo: PullRequestInfo, workspaceDir: string): Promise<CodeAnalysisResult>;
}

export interface IRuleManager {
  loadProjectRules(projectPath: string): Promise<ProjectRules>;
}

export interface IAIReviewer {
  performReview(context: AIAnalysisContext): Promise<AIReviewResult>;
}

export interface IReviewHistoryManager {
  cleanupPreviousReviews(prInfo: PullRequestInfo): Promise<ReviewCleanupResult>;
}

export interface IReviewFormatter {
  parseAIOutput(aiResult: AIReviewResult): StructuredReviewResult;
  formatForGitHub(structuredResult: StructuredReviewResult, prInfo: PullRequestInfo): GitHubReviewOutput;
}

export interface IGitHubReviewPublisher {
  publishReview(reviewOutput: GitHubReviewOutput, prInfo: PullRequestInfo): Promise<void>;
}
