import {join} from "path";
import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "fs";
import {repositoryVersionInputs, resolveBuildVersion, resolveReleaseVersion} from "./version";

export {resolveBuildVersion, resolveReleaseVersion} from "./version";

export const getPath = (path = "") => {
    return join(__dirname, '../../../../', path)
}

export const getCoreDistPath = () => {
    const path = getPath('packages/ctool-core/dist')
    if (!existsSync(path)) {
        throw new Error(`core dist path "${path}" not found`)
    }
    return path
}

export const copyCoreDist = (path: string) => {
    if (!existsSync(path)) {
        throw new Error(`"${path}" not found`)
    }
    cpSync(getCoreDistPath(), path, {recursive: true})
}

const getReleasePath = () => {
    const path = getPath("_release")
    if (!existsSync(path)) {
        mkdirSync(path);
    }
    return path
}

export const release = async (path: string, name: string) => {
    if (["chrome", "edge", "firefox", "utools", "web"].includes(name)) {
        validateReleaseVersion(path, name, version())
    }
    name = `ctool_${name}`
    if (!existsSync(path)) {
        throw new Error(`release path "${path}" not found`)
    }
    const isFile = statSync(path).isFile()
    let releaseFile = "";
    if (isFile) {
        releaseFile = join(getReleasePath(), name)
        copyFileSync(path, releaseFile)
    } else {
        releaseFile = join(getReleasePath(), `${name}.zip`)
        await require('zip-a-folder').zip(path, releaseFile);
    }
    return releaseFile;
}

export const replaceFileContent = (path: string, search: string, replace: string) => {
    if (!existsSync(path)) {
        throw new Error(`file "${path}" not found`)
    }
    writeFileSync(path, readFileSync(path).toString().replace(new RegExp(search, 'g'), replace))
}

export const getRootPackageJson = (): Record<string, any> => {
    return JSON.parse(readFileSync(getPath('package.json')).toString())
}

export const getAdditionData = (): Record<string, any> => {
    return JSON.parse(readFileSync(getPath('packages/ctool-core/dist/ctool.addition.json')).toString())
}

const htmlVersion = (content: string): string => {
    return content.match(/<meta\s+name=["']ctool-version["']\s+content=["']([^"']+)["']/i)?.[1] ||
        content.match(/<meta\s+content=["']([^"']+)["']\s+name=["']ctool-version["']/i)?.[1] || "";
}

const metadataVersion = (path: string): string => {
    const content = readFileSync(path, "utf-8");
    try {
        return `${JSON.parse(content).version || ""}`;
    } catch {
        return content.match(/["']version["']\s*:\s*["']([^"']+)["']/)?.[1] || "";
    }
}

export const validateReleaseVersion = (rootPath: string, platform: string, expectedVersion: string, metadataPath?: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
        throw new Error(`${platform} release version must be a stable x.y.z version, got ${expectedVersion || "<missing>"}`);
    }
    if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
        throw new Error(`${platform} release directory "${rootPath}" not found`);
    }
    const htmlFiles = readdirSync(rootPath)
        .filter(file => file.endsWith(".html"))
        .map(file => join(rootPath, file));
    if (htmlFiles.length === 0) {
        throw new Error(`${platform} release has no ctool-version HTML meta`);
    }
    const htmlVersions = htmlFiles.map(file => ({
        file,
        version: htmlVersion(readFileSync(file, "utf-8")),
    }));
    const unversionedHtml = htmlVersions.find(item => item.version === "");
    if (unversionedHtml) {
        throw new Error(`${platform} release HTML "${unversionedHtml.file}" has no ctool-version meta`);
    }
    const mismatchedHtml = htmlVersions.find(item => item.version !== expectedVersion);
    if (mismatchedHtml) {
        throw new Error(`${platform} core version ${mismatchedHtml.version} does not match release version ${expectedVersion}`);
    }

    const defaultMetadata: Record<string, string> = {
        chrome: "manifest.json",
        edge: "manifest.json",
        firefox: "manifest.json",
        utools: "plugin.json",
    };
    const resolvedMetadataPath = metadataPath || (defaultMetadata[platform] ? join(rootPath, defaultMetadata[platform]) : "");
    if (resolvedMetadataPath) {
        if (!existsSync(resolvedMetadataPath)) {
            throw new Error(`${platform} version metadata "${resolvedMetadataPath}" not found`);
        }
        const actualVersion = metadataVersion(resolvedMetadataPath);
        if (actualVersion !== expectedVersion) {
            throw new Error(`${platform} metadata version ${actualVersion || "<missing>"} does not match release version ${expectedVersion}`);
        }
    }
}

export const version = (): string => {
    return resolveReleaseVersion(repositoryVersionInputs(getPath()))
}

export const buildVersion = (): string => {
    return resolveBuildVersion(repositoryVersionInputs(getPath()), getRootPackageJson()['version'])
}
