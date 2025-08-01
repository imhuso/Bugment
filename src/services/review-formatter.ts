import * as core from "@actions/core";
import {
  IReviewFormatter,
  AIReviewResult,
  StructuredReviewResult,
  ReviewIssue,
  PullRequestInfo,
  GitHubReviewOutput,
  GitHubLineComment,
  IssueType,
  IssueSeverity
} from "../types";

/**
 * Step 4: 审查格式化器
 * 负责解析 AI 输出并格式化为 GitHub Review 格式
 */
export class ReviewFormatter implements IReviewFormatter {

  /**
   * 解析 AI 输出为结构化数据
   */
  parseAIOutput(aiResult: AIReviewResult): StructuredReviewResult {
    core.info("🔍 Parsing AI output to structured format...");

    const issues: ReviewIssue[] = [];
    let issueId = 1;

    // 解析不同类型的问题
    this.parseIssuesFromSection(aiResult.rawOutput, /# Bugs\s*\n([\s\S]*?)(?=\n# |$)/g, "bug", issues, issueId);
    this.parseIssuesFromSection(aiResult.rawOutput, /# Code Smells\s*\n([\s\S]*?)(?=\n# |$)/g, "code_smell", issues, issueId);
    this.parseIssuesFromSection(aiResult.rawOutput, /# Security Issues\s*\n([\s\S]*?)(?=\n# |$)/g, "security", issues, issueId);
    this.parseIssuesFromSection(aiResult.rawOutput, /# Performance Issues\s*\n([\s\S]*?)(?=\n# |$)/g, "performance", issues, issueId);

    // 提取总结
    const summary = this.extractSummaryFromReview(aiResult.rawOutput);

    core.info(`✅ Parsed ${issues.length} issues from AI output`);

    return {
      reviewId: aiResult.reviewId,
      timestamp: aiResult.timestamp,
      commitSha: aiResult.commitSha,
      summary,
      issues,
      totalIssues: issues.length
    };
  }

  /**
   * 格式化为 GitHub Review 格式
   */
  formatForGitHub(structuredResult: StructuredReviewResult, prInfo: PullRequestInfo): GitHubReviewOutput {
    core.info("📝 Formatting review for GitHub...");

    // 生成主评论内容
    const body = this.generateMainReviewBody(structuredResult);

    // 生成行级评论
    const comments = this.generateLineComments(structuredResult.issues);

    // 确定审查事件类型
    const event = this.determineReviewEvent(structuredResult);

    core.info(`📊 Generated review with ${comments.length} line comments`);

    return {
      body,
      event,
      comments
    };
  }

  /**
   * 从指定部分解析问题
   */
  private parseIssuesFromSection(
    reviewResult: string,
    pattern: RegExp,
    type: IssueType,
    issues: ReviewIssue[],
    _issueId: number
  ): void {
    const matches = reviewResult.matchAll(pattern);

    for (const match of matches) {
      if (match[1]) {
        const sectionContent = match[1].trim();
        if (sectionContent && sectionContent !== "无") {
          const sectionIssues = this.parseIndividualIssues(sectionContent, type);
          issues.push(...sectionIssues);
        }
      }
    }
  }

  /**
   * 解析单个问题
   */
  private parseIndividualIssues(sectionContent: string, type: IssueType): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const issuePattern = /## (\d+)\.\s*(.+?)\n\n([\s\S]*?)(?=\n## \d+\.|$)/g;
    const matches = sectionContent.matchAll(issuePattern);

    for (const match of matches) {
      const [, id, title, content] = match;
      if (id && title && content) {
        const issue = this.parseIssueContent(id, title, content, type);
        if (issue) {
          issues.push(issue);
        }
      }
    }

    return issues;
  }

  /**
   * 解析问题内容
   */
  private parseIssueContent(id: string, title: string, content: string, type: IssueType): ReviewIssue | null {
    try {
      // 提取各个字段
      const severityMatch = content.match(/\*\*严重程度\*\*:\s*🔴\s*\*\*严重\*\*|🟡\s*\*\*中等\*\*|🟢\s*\*\*轻微\*\*/);
      const descriptionMatch = content.match(/\*\*描述\*\*:\s*(.*?)(?=\n\*\*|$)/s);
      const ruleReferenceMatch = content.match(/\*\*规则引用\*\*:\s*(.*?)(?=\n\*\*|$)/s);
      const locationMatch = content.match(/\*\*位置\*\*:\s*(.*?)(?=\n\*\*|$)/s);
      const suggestionMatch = content.match(/\*\*建议修改\*\*:\s*(.*?)(?=\n\*\*|$)/s);
      const fixPromptMatch = content.match(/\*\*AI修复Prompt\*\*:\s*```\s*([\s\S]*?)\s*```/);

      if (!descriptionMatch?.[1] || !locationMatch?.[1]) {
        core.warning(`⚠️ Failed to parse issue: missing required fields`);
        return null;
      }

      // 解析严重程度
      const severityText = severityMatch?.[0] || "";
      const severity = this.mapSeverity(severityText);

      // 解析位置信息
      const location = locationMatch[1].trim();
      const { filePath, lineNumber, startLine, endLine } = this.parseLocationInfo(location);

      return {
        id: `${type}_${id}`,
        type,
        severity,
        title: title.trim(),
        description: descriptionMatch[1].trim(),
        ruleReference: ruleReferenceMatch?.[1]?.trim(),
        location,
        filePath,
        lineNumber,
        startLine,
        endLine,
        suggestion: suggestionMatch?.[1]?.trim(),
        fixPrompt: fixPromptMatch?.[1]?.trim()
      };

    } catch (error) {
      core.warning(`⚠️ Failed to parse issue content: ${error}`);
      return null;
    }
  }

  /**
   * 映射严重程度
   */
  private mapSeverity(severityText: string): IssueSeverity {
    if (severityText.includes("严重")) return "critical";
    if (severityText.includes("中等")) return "major";
    return "minor";
  }

  /**
   * 解析位置信息
   */
  private parseLocationInfo(location: string): {
    filePath?: string;
    lineNumber?: number;
    startLine?: number;
    endLine?: number;
  } {
    // 匹配格式: file.js#L10 或 file.js#L10-L20
    const match = location.match(/^(.+?)#L(\d+)(?:-L(\d+))?/);
    
    if (match && match[1] && match[2]) {
      const filePath = match[1];
      const startLine = parseInt(match[2], 10);
      const endLine = match[3] ? parseInt(match[3], 10) : startLine;
      
      return {
        filePath,
        lineNumber: startLine,
        startLine,
        endLine
      };
    }

    return {};
  }

  /**
   * 提取总结
   */
  private extractSummaryFromReview(reviewResult: string): string[] {
    const summaryMatch = reviewResult.match(/# Overall Comments\s*\n([\s\S]*?)(?=\n# |$)/);
    if (!summaryMatch?.[1]) return [];

    const summaryContent = summaryMatch[1].trim();
    return summaryContent
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  /**
   * 生成主评论内容
   */
  private generateMainReviewBody(result: StructuredReviewResult): string {
    const sections: string[] = [];

    sections.push("## 🤖 Bugment AI Code Review");
    sections.push("");

    // 总结部分
    if (result.summary.length > 0) {
      sections.push("### 📋 整体评价");
      sections.push("");
      result.summary.forEach((item, index) => {
        sections.push(`${index + 1}️⃣ ${item}`);
      });
      sections.push("");
    }

    // 问题统计
    const issueStats = this.generateIssueStatistics(result.issues);
    sections.push("### 📊 问题统计");
    sections.push("");
    sections.push(issueStats);
    sections.push("");

    // 添加审查数据（用于后续处理）
    sections.push("<!-- REVIEW_DATA:");
    sections.push("```json");
    sections.push(JSON.stringify(result, null, 2));
    sections.push("```");
    sections.push("-->");
    sections.push("");

    sections.push("🤖 Powered by [Bugment AI Code Review](https://github.com/imhuso/Bugment)");

    return sections.join("\n");
  }

  /**
   * 生成问题统计
   */
  private generateIssueStatistics(issues: ReviewIssue[]): string {
    const stats = {
      critical: issues.filter(i => i.severity === "critical").length,
      major: issues.filter(i => i.severity === "major").length,
      minor: issues.filter(i => i.severity === "minor").length,
      total: issues.length
    };

    return `- 🔴 严重问题: ${stats.critical}
- 🟡 中等问题: ${stats.major}
- 🟢 轻微问题: ${stats.minor}
- 📝 总计: ${stats.total}`;
  }

  /**
   * 生成行级评论
   */
  private generateLineComments(issues: ReviewIssue[]): GitHubLineComment[] {
    const comments: GitHubLineComment[] = [];

    for (const issue of issues) {
      if (issue.filePath && issue.lineNumber) {
        const commentBody = this.formatIssueComment(issue);
        
        comments.push({
          path: issue.filePath,
          line: issue.lineNumber,
          body: commentBody
        });
      }
    }

    return comments;
  }

  /**
   * 格式化问题评论
   */
  private formatIssueComment(issue: ReviewIssue): string {
    const sections: string[] = [];

    // 问题标题和严重程度
    const severityEmoji = issue.severity === "critical" ? "🔴" : issue.severity === "major" ? "🟡" : "🟢";
    sections.push(`## ${severityEmoji} ${issue.title}`);
    sections.push("");

    // 问题描述
    sections.push(`**描述**: ${issue.description}`);
    sections.push("");

    // 规则引用（如果有）
    if (issue.ruleReference) {
      sections.push(`**规则引用**: ${issue.ruleReference}`);
      sections.push("");
    }

    // 修改建议（如果有）
    if (issue.suggestion) {
      sections.push(`**建议修改**: ${issue.suggestion}`);
      sections.push("");
    }

    return sections.join("\n");
  }

  /**
   * 确定审查事件类型
   */
  private determineReviewEvent(result: StructuredReviewResult): "APPROVE" | "REQUEST_CHANGES" | "COMMENT" {
    const criticalIssues = result.issues.filter(i => i.severity === "critical").length;
    
    if (criticalIssues > 0) {
      return "REQUEST_CHANGES";
    } else if (result.totalIssues > 0) {
      return "COMMENT";
    } else {
      return "APPROVE";
    }
  }
}
