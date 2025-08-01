import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { ICodeAnalyzer, PullRequestInfo, CodeAnalysisResult, CodeChange } from "../types";
import { IgnoreManager } from "../ignore-manager";

/**
 * Step 1: 代码分析器
 * 负责获取和分析 PR 中的代码变更
 */
export class CodeAnalyzer implements ICodeAnalyzer {
  private ignoreManager?: IgnoreManager;

  /**
   * 分析 PR 中的代码变更
   */
  async analyzeChanges(prInfo: PullRequestInfo, workspaceDir: string): Promise<CodeAnalysisResult> {
    core.info(`🔍 Analyzing changes for PR #${prInfo.number}`);

    // 初始化忽略管理器
    this.ignoreManager = new IgnoreManager(workspaceDir);
    core.info(`📋 Initialized ignore manager with ${this.ignoreManager.getPatterns().length} patterns`);

    // 获取实际的 base SHA
    const actualBaseSha = await this.getActualBaseSha(workspaceDir, prInfo);
    
    // 生成 diff
    const diffContent = await this.generateDiff(workspaceDir, actualBaseSha, prInfo.headSha);
    
    // 解析 diff 内容
    const changes = this.parseDiff(diffContent);
    
    core.info(`📊 Found changes in ${changes.size} files`);

    return {
      prInfo,
      changes,
      diffContent
    };
  }

  /**
   * 获取实际的 base SHA
   * 处理 GitHub Actions 中的 merge commit 情况
   */
  private async getActualBaseSha(workspaceDir: string, prInfo: PullRequestInfo): Promise<string> {
    const githubSha = process.env.GITHUB_SHA;
    if (!githubSha) {
      core.info("📝 No GITHUB_SHA found, using original base SHA");
      return prInfo.baseSha;
    }

    // 检查是否是 merge commit
    const isMergeCommit = await this.checkIfMergeCommit(workspaceDir, githubSha);
    if (!isMergeCommit) {
      core.info("📝 GITHUB_SHA is not a merge commit, using original base SHA");
      return prInfo.baseSha;
    }

    // 获取 merge commit 的第一个父提交
    try {
      const firstParent = await this.getFirstParent(workspaceDir, githubSha);
      core.info(`📝 Using first parent of merge commit: ${firstParent}`);
      return firstParent;
    } catch (error) {
      core.warning(`⚠️ Failed to get first parent, using original base SHA: ${error}`);
      return prInfo.baseSha;
    }
  }

  /**
   * 检查是否是 merge commit
   */
  private async checkIfMergeCommit(workspaceDir: string, sha: string): Promise<boolean> {
    return new Promise((resolve) => {
      const git = spawn("git", ["cat-file", "-p", sha], { cwd: workspaceDir });
      let output = "";

      git.stdout.on("data", (data) => {
        output += data.toString();
      });

      git.on("close", (code) => {
        if (code === 0) {
          // 检查是否有多个 parent 行
          const parentLines = output.split("\n").filter(line => line.startsWith("parent "));
          resolve(parentLines.length > 1);
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * 获取 merge commit 的第一个父提交
   */
  private async getFirstParent(workspaceDir: string, sha: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn("git", ["rev-parse", `${sha}^1`], { cwd: workspaceDir });
      let output = "";

      git.stdout.on("data", (data) => {
        output += data.toString();
      });

      git.on("close", (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Failed to get first parent of ${sha}`));
        }
      });
    });
  }

  /**
   * 生成 diff 内容
   */
  private async generateDiff(workspaceDir: string, baseSha: string, headSha: string): Promise<string> {
    core.info(`📝 Generating diff: ${baseSha}...${headSha}`);

    return new Promise((resolve, reject) => {
      const git = spawn("git", [
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--unified=3",
        `${baseSha}...${headSha}`
      ], { cwd: workspaceDir });

      let diffContent = "";
      let errorOutput = "";

      git.stdout.on("data", (data) => {
        diffContent += data.toString();
      });

      git.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      git.on("close", (code) => {
        if (code === 0) {
          core.info(`📊 Generated diff with ${diffContent.length} characters`);
          resolve(diffContent);
        } else {
          reject(new Error(`Git diff failed: ${errorOutput}`));
        }
      });
    });
  }

  /**
   * 解析 diff 内容为结构化数据
   */
  private parseDiff(diffContent: string): Map<string, CodeChange[]> {
    const files = new Map<string, CodeChange[]>();
    const lines = diffContent.split("\n");
    
    let currentFile = "";
    let currentHunk: CodeChange | null = null;
    let isIgnoringFile = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // 文件头: diff --git a/file b/file
      if (line.startsWith("diff --git")) {
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match && match[2]) {
          const filePath = match[2];

          // 检查文件是否应该被忽略
          if (this.ignoreManager && this.ignoreManager.shouldIgnore(filePath)) {
            isIgnoringFile = true;
            currentFile = "";
            currentHunk = null;
            continue;
          }

          // 文件不被忽略
          isIgnoringFile = false;
          currentFile = filePath;
          currentHunk = null;

          core.info(`📁 Found file in diff: ${currentFile}`);
          if (!files.has(currentFile)) {
            files.set(currentFile, []);
          }
        }
      }

      // 如果当前文件被忽略，跳过所有内容
      if (isIgnoringFile) {
        continue;
      }

      // Hunk 头: @@ -oldStart,oldLines +newStart,newLines @@
      if (line.startsWith("@@") && currentFile) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match && match[1] && match[3]) {
          const oldStart = parseInt(match[1], 10);
          const oldLines = match[2] ? parseInt(match[2], 10) : 1;
          const newStart = parseInt(match[3], 10);
          const newLines = match[4] ? parseInt(match[4], 10) : 1;

          currentHunk = {
            filePath: currentFile,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: []
          };

          core.info(`📊 Found hunk for ${currentFile}: lines ${newStart}-${newStart + newLines - 1}`);
          files.get(currentFile)!.push(currentHunk);
        }
      }

      // Hunk 内容行
      if (currentHunk && (line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))) {
        currentHunk.lines.push(line);
      }
    }

    return files;
  }
}
