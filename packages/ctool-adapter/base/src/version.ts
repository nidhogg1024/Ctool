import {execFileSync} from "child_process";

const STABLE_VERSION = /^v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;

export interface VersionInputs {
    ctoolVersion?: string;
    githubRefName?: string;
    exactTag?: string;
    cleanHead: boolean;
}

const stableVersion = (value = ""): string => {
    const matched = value.trim().match(STABLE_VERSION)?.[1] || "";
    return matched && matched.split(".").every(part => Number(part) <= 65535) ? matched : "";
}

const resolvedStableVersion = (inputs: VersionInputs): string => {
    if (inputs.ctoolVersion !== undefined && !stableVersion(inputs.ctoolVersion)) {
        throw new Error(`invalid CTOOL_VERSION: ${inputs.ctoolVersion || "<empty>"}`);
    }
    const explicit = stableVersion(inputs.ctoolVersion) || stableVersion(inputs.githubRefName);
    if (explicit) {
        return explicit;
    }
    if (inputs.cleanHead) {
        const tagVersion = stableVersion(inputs.exactTag);
        if (tagVersion) {
            return tagVersion;
        }
    }
    return "";
}

export const resolveReleaseVersion = (inputs: VersionInputs): string => {
    const resolved = resolvedStableVersion(inputs);
    if (!resolved) {
        throw new Error("release version requires CTOOL_VERSION/GITHUB_REF_NAME x.y.z or a clean HEAD at an exact stable tag");
    }
    return resolved;
}

export const resolveBuildVersion = (inputs: VersionInputs, baselineVersion: string): string => {
    const resolved = resolvedStableVersion(inputs);
    if (resolved) {
        return resolved;
    }
    const baseline = stableVersion(baselineVersion);
    if (!baseline) {
        throw new Error(`invalid development version baseline: ${baselineVersion || "<missing>"}`);
    }
    return `${baseline}-dev`;
}

const git = (rootPath: string, args: string[]): string => {
    try {
        return execFileSync("git", args, {cwd: rootPath, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"]}).trim();
    } catch {
        return "";
    }
}

export const repositoryVersionInputs = (rootPath: string, env: NodeJS.ProcessEnv = process.env): VersionInputs => {
    return {
        ctoolVersion: env.CTOOL_VERSION,
        githubRefName: env.GITHUB_REF_NAME,
        exactTag: git(rootPath, ["describe", "--tags", "--exact-match", "HEAD"]),
        cleanHead: git(rootPath, ["status", "--porcelain"]) === "",
    };
}
