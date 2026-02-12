import { PlatformRuntime, Storage, Initializer } from "@/types";
import { runtime as web } from "./platformRuntimeDefault";
import { runtime as edge } from "ctool-adapter-edge";
import { runtime as chrome } from "ctool-adapter-chrome";
import { runtime as firefox } from "ctool-adapter-firefox";
import { runtime as utools } from "ctool-adapter-utools";
import { runtime as tauri } from "ctool-adapter-tauri";
import { Router } from "vue-router";
// 适配平台
const platforms = [edge, chrome, firefox, utools, tauri];

export default class {
    private readonly platformRuntime: PlatformRuntime;

    constructor() {
        for (const platform of platforms) {
            if (platform.is()) {
                this.platformRuntime = platform;
                return;
            }
        }
        this.platformRuntime = web;
    }

    name() {
        return this.platformRuntime.name;
    }

    webSecurity() {
        return this.platformRuntime.webSecurity?.() || false;
    }

    openUrl(url: string) {
        return this.platformRuntime.openUrl(url);
    }

    // 平台入口
    initialize(storage: Storage, router: Router) {

        const initializer: Initializer = {
            storage(): Storage {
                return storage;
            },
            push(path: string, query: Record<string, string | number> = {}) {
                // 等待路由就绪后再跳转（uTools 冷启动时 router 可能未 ready）
                // 使用 replace 避免路由历史堆积导致二次进入回到错误页面
                router.isReady().then(() => {
                    void router.replace({ path, query });
                });
            },
        };

        this.platformRuntime.initialize?.(initializer);
    }

    get storage() {
        return this.platformRuntime.storage?.() || web.storage();
    }

    call<T = any>(method: string, ...param: any[]): T {
        return this.platformRuntime[method]?.(...param);
    }

    getLocale() {
        return this.platformRuntime.getLocale?.() || web.getLocale();
    }
}
