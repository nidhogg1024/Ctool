import { join, resolve } from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import HtmlConfig from "vite-plugin-html-config";
import ReactivityTransform from "@vue-macros/reactivity-transform/vite";

// 优先从 git tag 读取版本号，fallback 到 package.json
function getVersion(): string {
    try {
        const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim();
        return tag.startsWith("v") ? tag.slice(1) : tag;
    } catch {
        return JSON.parse(readFileSync(join(__dirname, "../../package.json")).toString())["version"];
    }
}

export default defineConfig({
    base: "./",
    plugins: [
        nodePolyfills(),
        HtmlConfig({
            metas: [
                {
                    name: "ctool-version",
                    content: getVersion(),
                },
                {
                    name: "ctool-build-timestamp",
                    content: `${Date.parse(new Date().toString()) / 1000}`,
                },
            ],
        }),
        vue(),
        ReactivityTransform(),
    ],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    build: {
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve(__dirname, "index.html"),
                tool: resolve(__dirname, "tool.html"),
            },
            output: {
                // 将大依赖拆分为独立 chunk，按需加载
                manualChunks: {
                    "vendor-monaco": ["monaco-editor", "@monaco-editor/loader"],
                    "vendor-prettier": ["prettier"],
                    "vendor-crypto": ["crypto-js", "jsrsasign", "sm-crypto"],
                    "vendor-lodash": ["lodash"],
                    "vendor-mathjs": ["mathjs"],
                },
            },
        },
        reportCompressedSize: false,
        chunkSizeWarningLimit: 5000,
    },
});
