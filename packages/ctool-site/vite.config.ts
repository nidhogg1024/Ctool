import { join, resolve } from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import svgLoader from "vite-svg-loader";
import ctoolPlugin from "./vitePlugin";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import HtmlConfig from "vite-plugin-html-config";

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
        ctoolPlugin(),
        HtmlConfig({
            metas: [
                {
                    name: "ctool-version",
                    content: getVersion(),
                },
                {
                    name: "ctool-build-timestamp",
                    content: `${Date.parse((new Date()).toString()) / 1000}`,
                },
            ],
        }),
        vue(),
        svgLoader({
            defaultImport: "component",
        }),
        VitePWA({
            injectRegister: null,
            registerType: "prompt",
            manifest: false,
            workbox: {
                navigateFallbackDenylist: [
                    /^\/api/,
                    /^\/privacy/,
                ],
                globPatterns: ["**\/*.{js,css,html,png,jpg,ico,svg,json}"],
                cleanupOutdatedCaches: true,
                maximumFileSizeToCacheInBytes: 10485760,
            },
        }),
    ],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    build: {
        assetsDir: "_assets",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve(__dirname, "index.html"),
            },
        },
        reportCompressedSize: false,
    },
});
