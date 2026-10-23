import { defineConfig } from "cf/config";

export default defineConfig({
    accountId: "e40748de5807c8858fb98e5c95e1a3cc",
    worker: {
        name: "ctool-plus",
        compatibilityDate: "2026-10-22",
        domains: ["ctool-plus.nidhogglab.top"],
        workersDev: false,
        observability: {
            enabled: true,
            logs: { enabled: true },
            traces: { enabled: true, headSamplingRate: 0.01 },
        },
    },
});
