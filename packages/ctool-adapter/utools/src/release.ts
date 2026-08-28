import {copyCoreDist, release, replaceFileContent, version} from "ctool-adapter-base";
import {join} from "path";
import {cpSync, mkdirSync, rmSync, readFileSync, writeFileSync} from "fs";
import {releaseFeatures} from "./features";

const tempPath = join(__dirname, '../_temp')
rmSync(tempPath, {recursive: true, force: true});
mkdirSync(tempPath);

// 核心文件
copyCoreDist(tempPath)
// 平台文件
cpSync(join(__dirname, '../resources'), tempPath, {recursive: true});

(async () => {
    // 写入版本号
    replaceFileContent(join(tempPath, 'plugin.json'), '##version##', version())
    replaceFileContent(join(tempPath, 'plugin.json'), '"##features##"', JSON.stringify(releaseFeatures))

    // 去除 HTML 中的 crossorigin 属性（uTools 使用 file:// 协议，crossorigin 会导致 CORS 白屏）
    for (const htmlFile of ['tool.html', 'index.html']) {
        const htmlPath = join(tempPath, htmlFile)
        try {
            const html = readFileSync(htmlPath, 'utf-8')
            writeFileSync(htmlPath, html.replace(/ crossorigin/g, ''), 'utf-8')
        } catch {}
    }

    // 移除 development 字段（仅开发时使用，发布产物不需要）
    const pluginJsonPath = join(tempPath, 'plugin.json')
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'))
    delete pluginJson.development
    writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 4), 'utf-8')

    // 发布
    console.info(`utools: ${await release(tempPath, 'utools')}`)
    // 移除临时目录
    rmSync(tempPath, {recursive: true, force: true});
})()
