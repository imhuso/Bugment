#!/usr/bin/env node
"use strict";
/**
 * Bugment AI Code Review Action - 主入口文件
 * 重构后的清晰架构实现
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const core = __importStar(require("@actions/core"));
const bugment_action_1 = require("./bugment-action");
const service_factory_1 = require("./services/service-factory");
/**
 * 主执行函数
 */
async function main() {
    try {
        core.info("🚀 Initializing Bugment AI Code Review...");
        // 创建所有服务实例
        const services = service_factory_1.ServiceFactory.createAllServices();
        // 创建主 Action 实例
        const action = new bugment_action_1.BugmentAction(services.codeAnalyzer, services.ruleManager, services.aiReviewer, services.historyManager, services.reviewFormatter, services.githubPublisher);
        // 执行代码审查流程
        const result = await action.run();
        if (result.success) {
            core.info("✅ Bugment AI Code Review completed successfully");
            if (result.issuesFound !== undefined) {
                core.info(`📊 Found ${result.issuesFound} issues`);
            }
        }
        else {
            core.setFailed(`❌ Code review failed: ${result.error?.message}`);
            process.exit(1);
        }
    }
    catch (error) {
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
//# sourceMappingURL=main.js.map