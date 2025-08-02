import * as core from "@actions/core";
import * as github from "@actions/github";
import { IReviewHistoryManager, PullRequestInfo, ReviewCleanupResult, HistoricalReview } from "../types";

/**
 * Step 3: 历史审查管理器
 * 负责管理和清理之前的审查记录
 */
export class ReviewHistoryManager implements IReviewHistoryManager {
  private octokit: ReturnType<typeof github.getOctokit>;

  constructor() {
    const githubToken = process.env.INPUT_GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token is required");
    }
    this.octokit = github.getOctokit(githubToken);
  }

  /**
   * 清理之前的审查记录
   */
  async cleanupPreviousReviews(prInfo: PullRequestInfo): Promise<ReviewCleanupResult> {
    core.info(`🧹 Cleaning up previous reviews for PR #${prInfo.number}`);

    try {
      // 获取之前的审查记录
      const previousReviews = await this.getPreviousReviews(prInfo);
      
      if (previousReviews.length === 0) {
        core.info("📝 No previous Bugment reviews found");
        return { processedCount: 0, hiddenCount: 0, resolvedCount: 0 };
      }

      // 隐藏之前的审查评论
      const hiddenCount = await this.hidePreviousReviews(prInfo, previousReviews);

      // 解决之前的审查线程
      const resolvedCount = await this.resolvePreviousThreads(prInfo);

      core.info(`✅ Cleanup completed: hidden ${hiddenCount} reviews, resolved ${resolvedCount} threads`);

      return {
        processedCount: previousReviews.length,
        hiddenCount,
        resolvedCount
      };

    } catch (error) {
      core.warning(`⚠️ Failed to cleanup previous reviews: ${error}`);
      return { processedCount: 0, hiddenCount: 0, resolvedCount: 0 };
    }
  }

  /**
   * 获取之前的 Bugment 审查记录
   */
  private async getPreviousReviews(prInfo: PullRequestInfo): Promise<HistoricalReview[]> {
    try {
      const reviews = await this.octokit.rest.pulls.listReviews({
        owner: prInfo.owner,
        repo: prInfo.repo,
        pull_number: prInfo.number,
        per_page: 100
      });

      const bugmentReviews: HistoricalReview[] = [];

      for (const review of reviews.data) {
        if (this.isBugmentReview(review.body || "")) {
          bugmentReviews.push({
            id: review.id,
            body: review.body || "",
            state: review.state,
            submittedAt: review.submitted_at || ""
          });
        }
      }

      core.info(`📋 Found ${bugmentReviews.length} previous Bugment reviews`);
      return bugmentReviews;

    } catch (error) {
      core.warning(`Failed to fetch previous reviews: ${error}`);
      return [];
    }
  }

  /**
   * 关闭之前的审查
   */
  private async hidePreviousReviews(prInfo: PullRequestInfo, reviews: HistoricalReview[]): Promise<number> {
    let hiddenCount = 0;

    for (const review of reviews) {
      try {
        // 使用 GraphQL API 关闭整个 review
        await this.dismissPullRequestReview(review.id, "Outdated review replaced by new Bugment analysis");
        hiddenCount++;
        core.info(`✅ Dismissed review ${review.id}`);
      } catch (error) {
        core.warning(`Failed to dismiss review ${review.id}: ${error}`);
      }
    }

    return hiddenCount;
  }

  /**
   * 解决之前的审查线程
   */
  private async resolvePreviousThreads(prInfo: PullRequestInfo): Promise<number> {
    let resolvedCount = 0;

    try {
      // 获取 PR 的审查线程
      const threads = await this.getReviewThreads(prInfo);

      for (const thread of threads) {
        if (this.isAIGeneratedThread(thread)) {
          try {
            await this.resolveReviewThread(thread.id);
            resolvedCount++;
            core.info(`✅ Resolved conversation thread ${thread.id}`);
          } catch (error) {
            core.warning(`Failed to resolve thread ${thread.id}: ${error}`);
          }
        }
      }

    } catch (error) {
      core.warning(`Failed to resolve review threads: ${error}`);
    }

    return resolvedCount;
  }

  /**
   * 使用 GraphQL API 关闭 PR review
   */
  private async dismissPullRequestReview(reviewId: number, message: string): Promise<void> {
    const mutation = `
      mutation($reviewId: ID!, $message: String!) {
        dismissPullRequestReview(input: {pullRequestReviewId: $reviewId, message: $message}) {
          pullRequestReview {
            id
            state
          }
        }
      }
    `;

    await this.octokit.graphql(mutation, {
      reviewId: reviewId.toString(),
      message
    });
  }

  /**
   * 获取审查线程
   */
  private async getReviewThreads(prInfo: PullRequestInfo): Promise<any[]> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                comments(first: 10) {
                  nodes {
                    body
                    author {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await this.octokit.graphql(query, {
      owner: prInfo.owner,
      repo: prInfo.repo,
      number: prInfo.number
    });

    return result.repository.pullRequest.reviewThreads.nodes || [];
  }

  /**
   * 解决审查线程
   */
  private async resolveReviewThread(threadId: string): Promise<void> {
    const mutation = `
      mutation($threadId: ID!) {
        resolveReviewThread(input: {threadId: $threadId}) {
          thread {
            isResolved
          }
        }
      }
    `;

    await this.octokit.graphql(mutation, {
      threadId
    });
  }

  /**
   * 检查是否是 Bugment 生成的审查
   */
  private isBugmentReview(body: string): boolean {
    const bugmentSignatures = [
      "🤖 Powered by [Bugment AI Code Review]",
      "Bugment Code Review",
      "Bugment AI Code Review",
      "🤖 Powered by Bugment",
      "REVIEW_DATA:"
    ];

    return bugmentSignatures.some(signature => body.includes(signature));
  }

  /**
   * 检查是否是 AI 生成的线程
   */
  private isAIGeneratedThread(thread: any): boolean {
    if (!thread.comments?.nodes?.length) {
      return false;
    }

    const firstComment = thread.comments.nodes[0];
    return this.isBugmentReview(firstComment.body || "");
  }
}
