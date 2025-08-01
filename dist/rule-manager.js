"use strict";
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
exports.RuleManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
/**
 * 规则管理器
 * 负责读取和管理项目规则文件
 */
class RuleManager {
    constructor(projectPath) {
        this.rulesCache = new Map();
        this.processedFiles = new Set();
        this.projectPath = projectPath;
    }
    /**
     * 加载项目规则文件
     * 实现 IRuleManager 接口
     */
    async loadProjectRules(projectPath) {
        this.projectPath = projectPath;
        const rulesContent = await this.loadAllRules();
        return {
            hasRules: this.rulesCache.size > 0,
            rulesContent,
            ruleFiles: Array.from(this.rulesCache.keys())
        };
    }
    /**
     * 加载所有规则文件
     * 从 .augment/rules 开始，递归查找所有 .md 文件
     * 让 AI 自己分析规则内容和引用关系
     */
    async loadAllRules() {
        core.info("📋 Loading project rules...");
        const rulesDir = path.join(this.projectPath, ".augment", "rules");
        if (!fs.existsSync(rulesDir)) {
            core.info("📋 No .augment/rules directory found");
            return "";
        }
        // 清空缓存
        this.rulesCache.clear();
        this.processedFiles.clear();
        // 递归加载 .augment/rules 目录下的所有规则文件
        await this.loadRulesFromDirectory(rulesDir);
        // 构建完整的规则内容，让 AI 自己分析引用和适用性
        const allRulesContent = this.buildRulesContent();
        core.info(`📋 Loaded ${this.rulesCache.size} rule files from .augment/rules`);
        return allRulesContent;
    }
    /**
     * 从指定目录递归加载规则文件
     */
    async loadRulesFromDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return;
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                // 递归处理子目录
                await this.loadRulesFromDirectory(fullPath);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                // 加载 markdown 规则文件
                await this.loadRuleFile(fullPath);
            }
        }
    }
    /**
     * 加载单个规则文件
     */
    async loadRuleFile(filePath) {
        if (this.processedFiles.has(filePath)) {
            return;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(this.projectPath, filePath);
            this.rulesCache.set(relativePath, content);
            this.processedFiles.add(filePath);
            core.info(`📄 Loaded rule file: ${relativePath}`);
        }
        catch (error) {
            core.warning(`⚠️ Failed to load rule file ${filePath}: ${error}`);
        }
    }
    /**
     * 构建完整的规则内容字符串
     */
    buildRulesContent() {
        if (this.rulesCache.size === 0) {
            return "";
        }
        const sections = [];
        sections.push("## 项目规则文件");
        sections.push("");
        sections.push("以下是项目中定义的规则文件，请优先检查代码是否违反了这些规则：");
        sections.push("");
        // 按文件路径排序
        const sortedEntries = Array.from(this.rulesCache.entries()).sort(([a], [b]) => a.localeCompare(b));
        for (const [filePath, content] of sortedEntries) {
            sections.push(`### 规则文件: ${filePath}`);
            sections.push("");
            sections.push("```markdown");
            sections.push(content.trim());
            sections.push("```");
            sections.push("");
        }
        return sections.join("\n");
    }
    /**
     * 获取规则文件列表
     */
    getRuleFiles() {
        return Array.from(this.rulesCache.keys());
    }
    /**
     * 获取特定规则文件的内容
     */
    getRuleContent(filePath) {
        return this.rulesCache.get(filePath);
    }
    /**
     * 检查是否有规则文件
     */
    hasRules() {
        return this.rulesCache.size > 0;
    }
}
exports.RuleManager = RuleManager;
//# sourceMappingURL=rule-manager.js.map