import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^monaco-editor$/,
                replacement: resolve(__dirname, "./src/test/mocks/monacoEditor.ts"),
            },
            {
                find: "@",
                replacement: resolve(__dirname, "./src"),
            },
            {
                find: /^ctool-adapter-utools$/,
                replacement: resolve(__dirname, "../ctool-adapter/utools/src/index.ts"),
            },
        ],
    },
    test: {
        globals: true,
        include: ["src/**/*.test.ts"],
    },
});
