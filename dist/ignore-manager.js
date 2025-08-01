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
exports.IgnoreManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
/**
 * 文件忽略管理器
 * 支持类似 .gitignore 的模式匹配
 */
class IgnoreManager {
    constructor(projectPath, useDefaults = true) {
        this.patterns = [];
        this.defaultPatterns = [
            // 依赖锁定文件
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "composer.lock",
            "Pipfile.lock",
            "poetry.lock",
            "Cargo.lock",
            // 依赖目录
            "node_modules/**",
            "vendor/**",
            ".pnp/**",
            // 构建输出
            "dist/**",
            "build/**",
            "out/**",
            "target/**",
            ".next/**",
            ".nuxt/**",
            ".output/**",
            // 系统文件
            ".DS_Store",
            "Thumbs.db",
            "desktop.ini",
            // 日志文件
            "*.log",
            "logs/**",
            "npm-debug.log*",
            "yarn-debug.log*",
            "yarn-error.log*",
            // 环境变量文件
            ".env.local",
            ".env.development.local",
            ".env.test.local",
            ".env.production.local",
            // 缓存目录
            ".cache/**",
            ".tmp/**",
            ".temp/**",
            "tmp/**",
            "temp/**",
            // IDE 文件
            ".vscode/**",
            ".idea/**",
            "*.swp",
            "*.swo",
            "*~",
            // 测试覆盖率
            "coverage/**",
            ".nyc_output/**",
            "*.lcov",
            // 其他常见忽略
            "*.tsbuildinfo",
            ".eslintcache",
            ".stylelintcache"
        ];
        if (useDefaults) {
            this.patterns = [...this.defaultPatterns];
        }
        this.loadIgnoreFile(projectPath);
    }
    /**
     * 从项目根目录加载 .bugmentignore 文件
     */
    loadIgnoreFile(projectPath) {
        const ignoreFilePath = path.join(projectPath, ".bugmentignore");
        try {
            if (fs.existsSync(ignoreFilePath)) {
                const content = fs.readFileSync(ignoreFilePath, "utf-8");
                const filePatterns = this.parseIgnoreFile(content);
                this.patterns.push(...filePatterns);
                core.info(`📋 Loaded ${filePatterns.length} patterns from .bugmentignore`);
            }
            else {
                core.info("📋 No .bugmentignore file found, using default patterns only");
            }
        }
        catch (error) {
            core.warning(`⚠️ Failed to load .bugmentignore: ${error}`);
        }
    }
    /**
     * 解析忽略文件内容
     */
    parseIgnoreFile(content) {
        return content
            .split("\n")
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#")) // 过滤空行和注释
            .map(line => line.replace(/\r$/, "")); // 移除Windows换行符
    }
    /**
     * 检查文件是否应该被忽略
     */
    shouldIgnore(filePath) {
        // 标准化文件路径（移除开头的 ./ 或 /）
        const normalizedPath = filePath.replace(/^\.?\/+/, "");
        for (const pattern of this.patterns) {
            if (this.matchPattern(normalizedPath, pattern)) {
                core.info(`🚫 Ignoring file: ${filePath} (matched pattern: ${pattern})`);
                return true;
            }
        }
        return false;
    }
    /**
     * 模式匹配逻辑
     * 支持基本的 glob 模式：*, **, ?
     */
    matchPattern(filePath, pattern) {
        // 标准化模式（移除开头的 ./ 或 /）
        const normalizedPattern = pattern.replace(/^\.?\/+/, "");
        // 转换 glob 模式为正则表达式
        const regexPattern = this.globToRegex(normalizedPattern);
        const regex = new RegExp(regexPattern);
        return regex.test(filePath);
    }
    /**
     * 将 glob 模式转换为正则表达式
     */
    globToRegex(pattern) {
        let regex = pattern
            // 转义特殊字符
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            // ** 匹配任意深度的目录
            .replace(/\*\*/g, ".*")
            // * 匹配除路径分隔符外的任意字符
            .replace(/\*/g, "[^/]*")
            // ? 匹配单个字符（除路径分隔符）
            .replace(/\?/g, "[^/]");
        // 如果模式以 / 结尾，匹配目录及其所有内容
        if (pattern.endsWith("/")) {
            regex += ".*";
        }
        // 完整匹配
        return `^${regex}$`;
    }
    /**
     * 获取所有忽略模式（用于调试）
     */
    getPatterns() {
        return [...this.patterns];
    }
    /**
     * 添加自定义忽略模式
     */
    addPattern(pattern) {
        this.patterns.push(pattern);
    }
    /**
     * 批量过滤文件列表
     */
    filterFiles(files) {
        return files.filter(file => !this.shouldIgnore(file));
    }
}
exports.IgnoreManager = IgnoreManager;
//# sourceMappingURL=ignore-manager.js.map