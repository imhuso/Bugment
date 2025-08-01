#!/usr/bin/env node

/**
 * Bugment AI Code Review Action - 主入口文件
 * 重构后的清晰架构实现
 */

import * as core from "@actions/core";
import { BugmentAction } from "./bugment-action";
import { ServiceFactory } from "./services/service-factory";

/**
 * 主执行函数
 */
async function main(): Promise<void> {
  try {
    core.info("🚀 Initializing Bugment AI Code Review...");

    // 创建所有服务实例
    const services = ServiceFactory.createAllServices();

    // 创建主 Action 实例
    const action = new BugmentAction(
      services.codeAnalyzer,
      services.ruleManager,
      services.aiReviewer,
      services.historyManager,
      services.reviewFormatter,
      services.githubPublisher
    );

    // 执行代码审查流程
    const result = await action.run();

    if (result.success) {
      core.info("✅ Bugment AI Code Review completed successfully");
      
      if (result.issuesFound !== undefined) {
        core.info(`📊 Found ${result.issuesFound} issues`);
      }
    } else {
      core.setFailed(`❌ Code review failed: ${result.error?.message}`);
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`❌ Unexpected error: ${errorMessage}`);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main().catch((error) => {
    core.setFailed(`❌ Fatal error: ${error}`);
    process.exit(1);
  });
}

export { main };
