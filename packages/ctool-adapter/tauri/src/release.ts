import {release} from "ctool-adapter-base";
import {parse, join} from "path";
import {readdirSync, statSync, existsSync, rmSync, mkdirSync, cpSync} from "fs";
import os from 'os';

const platform = ["win32", "darwin"].includes(os.platform()) ? os.platform() : "linux";

// 从环境变量获取构建目标架构（CI 中由 workflow 传入）
// 例如: aarch64-apple-darwin, x86_64-apple-darwin, x86_64-pc-windows-msvc
const tauriTarget = process.env.TAURI_TARGET || "";

// 根据构建目标确定 macOS 架构后缀，避免 ARM/Intel 产物命名冲突
const getMacArchSuffix = (): string => {
    if (tauriTarget.includes("x86_64")) {
        return "_x64";
    }
    if (tauriTarget.includes("aarch64")) {
        return "_arm64";
    }
    // 本地构建时根据当前系统架构判断
    return os.arch() === "arm64" ? "_arm64" : "_x64";
}

const getTauriReleaseFile = (dir: string, name: string, extension: string) => {
    const path = join(__dirname, "../src-tauri/target/release", dir)
    const files = readdirSync(path).map(item => join(path, item)).filter(item => {
        return statSync(item).isFile()
    }) || []
    for (let file of files) {
        const fileInfo = parse(file)
        if (fileInfo.name.includes(name) && extension === fileInfo.ext) {
            return file
        }
    }
    return "";
}

(async () => {
    const files: { path: string, name: string }[] = []

    const filesPush = (path: string, name: string) => {
        if (path === "") {
            return;
        }
        files.push({path, name: `tauri_${name}`})
    }

    if (platform === "win32") {
        filesPush(getTauriReleaseFile("", 'ctool', '.exe'), "win.exe")
        filesPush(getTauriReleaseFile('bundle/msi', 'ctool', '.msi'), "win.msi")
    }
    if (platform === "darwin") {
        const arch = getMacArchSuffix();
        filesPush(getTauriReleaseFile("bundle/dmg", 'ctool', '.dmg'), `mac${arch}.dmg`)
        // mac app 程序 特殊处理
        const appFile = join(__dirname, "../src-tauri/target/release/bundle/macos/ctool.app")
        if (existsSync(appFile)) {
            const appTempDir1 = join(__dirname, "../src-tauri/target/release/bundle/macos/ctool")
            const appTempDir2 = join(appTempDir1, "ctool.app")
            rmSync(appTempDir1, {recursive: true, force: true});
            mkdirSync(appTempDir2, {recursive: true});
            cpSync(appFile, appTempDir2, {recursive: true})
            filesPush(appTempDir1, `mac${arch}_app`)
        }
    }
    if (platform === "linux") {
        filesPush(getTauriReleaseFile("bundle/deb", 'ctool', '.deb'), "linux.deb")
        filesPush(getTauriReleaseFile("bundle/appimage", 'ctool', '.AppImage'), "linux.AppImage")
    }
    for (let file of files) {
        await release(file.path, file.name)
    }
})()
