import {PlatformRuntime} from "ctool-config";

// Tauri v2: withGlobalTauri 暴露 window.__TAURI__ 全局对象
// 结构为 { core: { invoke }, event, path, ... }
// 插件不在全局对象上，需要通过 invoke 调用
declare global {
    interface Window {
        __TAURI__: {
            core: {
                invoke: (command: string, args?: Record<string, any>) => Promise<any>
            }
        }
    }
}

export const runtime = new (class implements PlatformRuntime {
    name = "tauri"

    is() {
        return !!window['__TAURI__'];
    }

    openUrl(url: string) {
        // 通过 shell 插件打开外部链接
        return window.__TAURI__.core.invoke('plugin:shell|open', {path: url});
    }

    // 开发工具操作
    toggleDevTools() {
        return window.__TAURI__.core.invoke('toggle_dev_tools');
    }
})
