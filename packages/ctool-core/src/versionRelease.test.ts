import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {afterEach, describe, expect, it} from "vitest";
import {resolveBuildVersion, resolveReleaseVersion} from "../../ctool-adapter/base/src/version";
import {validateReleaseVersion} from "../../ctool-adapter/base/src";

const tempPaths: string[] = [];

const releaseDirectory = (platform: string, htmlVersion: string, metadataVersion = htmlVersion) => {
    const path = mkdtempSync(join(tmpdir(), `ctool-${platform}-`));
    tempPaths.push(path);
    writeFileSync(join(path, "index.html"), `<meta name="ctool-version" content="${htmlVersion}">`);
    const metadataFiles: Record<string, string> = {
        chrome: "manifest.json",
        edge: "manifest.json",
        firefox: "manifest.json",
        utools: "plugin.json",
    };
    if (metadataFiles[platform]) {
        writeFileSync(join(path, metadataFiles[platform]), JSON.stringify({version: metadataVersion}));
    }
    return path;
};

afterEach(() => {
    tempPaths.splice(0).forEach(path => rmSync(path, {recursive: true, force: true}));
});

describe("release version resolution", () => {
    it("prefers an explicit stable CTOOL_VERSION", () => {
        expect(resolveReleaseVersion({ctoolVersion: "v3.1.4", githubRefName: "v2.9.1", exactTag: "v2.9.1", cleanHead: true})).toBe("3.1.4");
    });

    it("accepts a stable GITHUB_REF_NAME", () => {
        expect(resolveReleaseVersion({githubRefName: "v3.1.4", exactTag: "", cleanHead: false})).toBe("3.1.4");
    });

    it("uses only a stable exact tag on a clean HEAD", () => {
        expect(resolveReleaseVersion({exactTag: "v2.9.1", cleanHead: true})).toBe("2.9.1");
        expect(() => resolveReleaseVersion({exactTag: "v2.9.1", cleanHead: false})).toThrow("release version requires");
    });

    it("does not publish prerelease, branch, or ancestor-tag values", () => {
        expect(() => resolveReleaseVersion({ctoolVersion: "2.10.0-beta.1", githubRefName: "main", exactTag: "", cleanHead: true})).toThrow("invalid CTOOL_VERSION");
        expect(() => resolveReleaseVersion({githubRefName: "v2.10.0-beta.1", exactTag: "", cleanHead: true})).toThrow("release version requires");
        expect(() => resolveReleaseVersion({githubRefName: "v2.10.0-a1b2c3d", exactTag: "", cleanHead: true})).toThrow("release version requires");
        expect(() => resolveReleaseVersion({githubRefName: "feature/version", exactTag: "", cleanHead: true})).toThrow("release version requires");
        expect(() => resolveReleaseVersion({exactTag: "", cleanHead: true})).toThrow("release version requires");
    });

    it("rejects version segments that browser manifests cannot publish", () => {
        expect(resolveReleaseVersion({ctoolVersion: "65535.0.1", cleanHead: false})).toBe("65535.0.1");
        expect(() => resolveReleaseVersion({ctoolVersion: "65536.0.1", cleanHead: false})).toThrow("invalid CTOOL_VERSION");
        expect(() => resolveReleaseVersion({ctoolVersion: "02.9.1", cleanHead: false})).toThrow("invalid CTOOL_VERSION");
    });

    it("does not hide an invalid CTOOL_VERSION behind another valid source", () => {
        const inputs = {ctoolVersion: "2.9.x", githubRefName: "v2.9.1", exactTag: "v2.9.1", cleanHead: true};
        expect(() => resolveReleaseVersion(inputs)).toThrow("invalid CTOOL_VERSION: 2.9.x");
        expect(() => resolveBuildVersion(inputs, "2.9.1")).toThrow("invalid CTOOL_VERSION: 2.9.x");
    });

    it("uses a valid development SemVer without impersonating the latest release", () => {
        expect(resolveBuildVersion({githubRefName: "feature/version", exactTag: "", cleanHead: false}, "2.9.1")).toBe("2.9.1-dev");
    });
});

describe("release directory version validation", () => {
    it.each(["chrome", "edge", "firefox", "utools", "web"])("validates %s output", platform => {
        expect(() => validateReleaseVersion(releaseDirectory(platform, "2.9.1"), platform, "2.9.1")).not.toThrow();
    });

    it("validates Tauri web meta and configuration together", () => {
        const path = releaseDirectory("tauri", "2.9.1");
        const configPath = join(path, "tauri.conf.json5");
        writeFileSync(configPath, `{ "version": "2.9.1" }`);
        expect(() => validateReleaseVersion(path, "tauri", "2.9.1", configPath)).not.toThrow();
    });

    it("rejects stale core HTML reused by only-release", () => {
        const path = releaseDirectory("chrome", "2.9.0", "2.9.1");
        expect(() => validateReleaseVersion(path, "chrome", "2.9.1")).toThrow("core version 2.9.0");
    });

    it("rejects stale platform metadata", () => {
        const path = releaseDirectory("utools", "2.9.1", "2.9.0");
        expect(() => validateReleaseVersion(path, "utools", "2.9.1")).toThrow("metadata version 2.9.0");
    });

    it("rejects any unversioned HTML entry", () => {
        const path = releaseDirectory("chrome", "2.9.1");
        writeFileSync(join(path, "popup.html"), "<html></html>");
        expect(() => validateReleaseVersion(path, "chrome", "2.9.1")).toThrow("popup.html");
    });

    it("rejects a development version as a release", () => {
        const path = releaseDirectory("web", "2.9.1-dev");
        expect(() => validateReleaseVersion(path, "web", "2.9.1-dev")).toThrow("stable x.y.z");
    });

    it("rejects output without versioned core HTML", () => {
        const path = mkdtempSync(join(tmpdir(), "ctool-empty-"));
        tempPaths.push(path);
        mkdirSync(join(path, "assets"));
        expect(() => validateReleaseVersion(path, "web", "2.9.1")).toThrow("no ctool-version HTML meta");
    });
});
