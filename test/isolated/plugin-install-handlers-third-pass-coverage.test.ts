/**
 * Third-pass isolated branch coverage for install-handlers.ts.
 *
 * Mock dependencies before importing handlers so this file can exercise source
 * routing and lock branches without network, real extraction, or operator dirs.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourceDetectPath = import.meta.resolve("../../src/commands/plugins/plugin/install-source-detect");
const extractionPath = import.meta.resolve("../../src/commands/plugins/plugin/install-extraction");
const manifestHelpersPath = import.meta.resolve("../../src/commands/plugins/plugin/install-manifest-helpers");
const lockPath = import.meta.resolve("../../src/commands/plugins/plugin/lock");
const registryPath = import.meta.resolve("../../src/plugin/registry");

type Manifest = {
  name: string;
  version: string;
  sdk: string;
  entry?: string;
  weight?: number;
  artifact?: { path: string; sha256: string | null };
};

type DownloadResult = { ok: true; path: string } | { ok: false; error: string };
type ExtractPlan = { manifest?: Manifest | null; subpaths?: Record<string, Manifest | null> };
type RecordInstallCall = { name: string; version: string; sha256: string; source: string; linked?: boolean };

let tempRoot = "";
let installDir = "";
let manifestByDir = new Map<string, Manifest | null>();
let pluginRootByStaging = new Map<string, string | null>();
let subpathRootByStaging = new Map<string, Map<string, string | null>>();
let extractQueue: ExtractPlan[] = [];
let downloadQueue: DownloadResult[] = [];
let downloadCalls: string[] = [];
let recordInstallCalls: RecordInstallCall[] = [];
let printCalls: unknown[][] = [];
let lockPlugins: Record<string, { version: string; sha256: string; source: string; added: string }> = {};
let pinnedHashOk = true;
let latestReleaseStatus = 1;
let latestReleaseStdout = "";

const originalEnv = {
  pluginsDir: process.env.MAW_PLUGINS_DIR,
  pluginsLock: process.env.MAW_PLUGINS_LOCK,
  mawJsPath: process.env.MAW_JS_PATH,
  githubBase: process.env.MAW_GITHUB_BASE_URL,
  monorepoBase: process.env.MAW_MONOREPO_BASE_URL,
  monorepoRepo: process.env.MAW_MONOREPO_REGISTRY_REPO,
};

function restoreEnv() {
  for (const [key, value] of Object.entries({
    MAW_PLUGINS_DIR: originalEnv.pluginsDir,
    MAW_PLUGINS_LOCK: originalEnv.pluginsLock,
    MAW_JS_PATH: originalEnv.mawJsPath,
    MAW_GITHUB_BASE_URL: originalEnv.githubBase,
    MAW_MONOREPO_BASE_URL: originalEnv.monorepoBase,
    MAW_MONOREPO_REGISTRY_REPO: originalEnv.monorepoRepo,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function defaultManifest(name = "demo"): Manifest {
  return {
    name,
    version: "1.0.0",
    sdk: "*",
    entry: "index.ts",
    artifact: { path: "index.ts", sha256: "sha256:" + "a".repeat(64) },
  };
}

function sourceManifest(name = "source-demo"): Manifest {
  return { name, version: "1.0.0", sdk: "*", entry: "src/index.ts", artifact: undefined };
}

function createPluginDir(parent: string, rel: string, manifest: Manifest | null): string {
  const dir = join(parent, rel);
  mkdirSync(dir, { recursive: true });
  if (manifest) {
    writeFileSync(join(dir, "plugin.json"), JSON.stringify(manifest, null, 2));
    if (manifest.entry) {
      const entryPath = join(dir, manifest.entry);
      mkdirSync(join(entryPath, ".."), { recursive: true });
      writeFileSync(entryPath, `export default ${JSON.stringify(manifest.name)};\n`);
    }
    if (manifest.artifact?.path && manifest.artifact.sha256 !== null) {
      const artifactPath = join(dir, manifest.artifact.path);
      mkdirSync(join(artifactPath, ".."), { recursive: true });
      if (!existsSync(artifactPath)) writeFileSync(artifactPath, `artifact:${manifest.name}\n`);
    }
  }
  manifestByDir.set(dir, manifest);
  return dir;
}

function makeTarball(label: string): string {
  const dir = mkdtempSync(join(tempRoot, `${label}-`));
  const path = join(dir, `${label}.tgz`);
  writeFileSync(path, `tarball:${label}`);
  return path;
}

function queueExtract(plan: ExtractPlan = {}): void { extractQueue.push(plan); }
function queueDownload(result: DownloadResult): void { downloadQueue.push(result); }

mock.module(sourceDetectPath, () => ({
  installRoot: () => installDir,
  removeExisting: (dest: string) => rmSync(dest, { recursive: true, force: true }),
}));

mock.module(registryPath, () => ({
  formatSdkMismatchError: (name: string, wanted: string, runtime: string) =>
    `sdk mismatch for ${name}: wanted ${wanted}, runtime ${runtime}`,
  runtimeSdkVersion: () => "1.0.0",
  satisfies: () => true,
  hashFile: (path: string) => `sha256:${Buffer.from(path).toString("hex").slice(0, 64).padEnd(64, "0")}`,
}));

mock.module(extractionPath, () => ({
  extractTarball: (_tarballPath: string, staging: string) => {
    const plan = extractQueue.shift() ?? { manifest: defaultManifest() };
    if (Object.prototype.hasOwnProperty.call(plan, "manifest")) {
      pluginRootByStaging.set(staging, plan.manifest === null ? null : createPluginDir(staging, "plugin", plan.manifest ?? defaultManifest()));
    } else {
      pluginRootByStaging.set(staging, createPluginDir(staging, "plugin", defaultManifest()));
    }
    const subpaths = new Map<string, string | null>();
    for (const [subpath, manifest] of Object.entries(plan.subpaths ?? {})) {
      subpaths.set(subpath, manifest === null ? null : createPluginDir(staging, subpath, manifest));
    }
    subpathRootByStaging.set(staging, subpaths);
    return { ok: true };
  },
  downloadTarball: async (url: string) => {
    downloadCalls.push(url);
    return downloadQueue.shift() ?? { ok: false, error: `unexpected download: ${url}` };
  },
  verifyArtifactHash: () => ({ ok: true }),
  verifyArtifactHashAgainst: () => pinnedHashOk ? { ok: true } : { ok: false, error: "pinned hash failed" },
  isSourcePluginManifest: (manifest: Manifest) =>
    typeof manifest.entry === "string" && (!manifest.artifact || manifest.artifact.sha256 === null),
}));

mock.module(manifestHelpersPath, () => ({
  findPluginRoot: (staging: string) => pluginRootByStaging.get(staging) ?? null,
  findMonorepoPluginRoot: (staging: string, subpath: string) => subpathRootByStaging.get(staging)?.get(subpath) ?? null,
  readManifest: (dir: string) => manifestByDir.get(dir) ?? null,
  printInstallSuccess: (...args: unknown[]) => { printCalls.push(args); },
}));

mock.module(lockPath, () => ({
  readLock: () => ({ schema: 1, updated: "now", plugins: lockPlugins }),
  recordInstall: (input: RecordInstallCall) => {
    recordInstallCalls.push(input);
    lockPlugins[input.name] = { ...input, added: "now" };
    return lockPlugins[input.name];
  },
}));

mock.module("child_process", () => ({
  spawnSync: () => ({ status: latestReleaseStatus, stdout: latestReleaseStdout, stderr: latestReleaseStatus === 0 ? "" : "no release" }),
}));

const handlers = await import("../../src/commands/plugins/plugin/install-handlers.ts?install-handlers-third-pass-coverage");
const { installFromDir, installFromGithub, installFromTarball } = handlers;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "maw-install-handlers-third-"));
  installDir = join(tempRoot, "plugins");
  mkdirSync(installDir, { recursive: true });
  process.env.MAW_PLUGINS_DIR = installDir;
  process.env.MAW_PLUGINS_LOCK = join(tempRoot, "plugins.lock");
  process.env.MAW_JS_PATH = join(tempRoot, "maw-js-root");
  mkdirSync(process.env.MAW_JS_PATH, { recursive: true });
  delete process.env.MAW_GITHUB_BASE_URL;
  delete process.env.MAW_MONOREPO_BASE_URL;
  delete process.env.MAW_MONOREPO_REGISTRY_REPO;

  manifestByDir = new Map();
  pluginRootByStaging = new Map();
  subpathRootByStaging = new Map();
  extractQueue = [];
  downloadQueue = [];
  downloadCalls = [];
  recordInstallCalls = [];
  printCalls = [];
  lockPlugins = {};
  pinnedHashOk = true;
  latestReleaseStatus = 1;
  latestReleaseStdout = "";
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  restoreEnv();
});

describe("install-handlers third-pass coverage", () => {
  test("installFromDir stores explicit weight for a fresh link install with corrupt prior overrides", async () => {
    writeFileSync(join(installDir, ".overrides.json"), "{not json");
    const source = createPluginDir(tempRoot, "weighted-link", { ...defaultManifest("weighted-link"), weight: undefined });

    await installFromDir(source, { weight: 17 });

    expect(JSON.parse(readFileSync(join(installDir, ".overrides.json"), "utf8"))).toEqual({ "weighted-link": 17 });
    expect(recordInstallCalls.at(-1)).toMatchObject({ name: "weighted-link", linked: true, source: `link:${source}` });
  });

  test("installFromTarball reports unknown observed hash for source-shaped pinned mismatch", async () => {
    lockPlugins["unknown-observed"] = { version: "1.0.0", sha256: "sha256:" + "b".repeat(64), source: "old", added: "old" };
    pinnedHashOk = false;
    queueExtract({ manifest: sourceManifest("unknown-observed") });

    await expect(installFromTarball(makeTarball("unknown-observed"), { source: "unknown-observed" }))
      .rejects.toThrow(/tarball:\s+\(unknown\)/);

    expect(recordInstallCalls).toEqual([]);
  });

  test("github handler returns after successful single-segment plugins subpath probe", async () => {
    process.env.MAW_GITHUB_BASE_URL = "https://gh.example";
    const ghTarball = makeTarball("github-prefixed-success");
    queueDownload({ ok: false, error: "tag missing" });
    queueDownload({ ok: true, path: ghTarball });
    queueExtract({ subpaths: { "plugins/tool": defaultManifest("prefixed-tool") } });

    await installFromGithub({ owner: "owner", repo: "repo", subpath: "tool", ref: "feature" }, { force: true, pin: true, weight: 13 });

    expect(downloadCalls).toEqual([
      "https://gh.example/owner/repo/archive/refs/tags/feature.tar.gz",
      "https://gh.example/owner/repo/archive/refs/heads/feature.tar.gz",
    ]);
    expect(recordInstallCalls).toHaveLength(1);
    expect(recordInstallCalls[0]).toMatchObject({ name: "prefixed-tool", source: "github:owner/repo/tool@feature" });
    expect(printCalls.at(-1)?.[1]).toBe(join(installDir, "prefixed-tool"));
    expect(existsSync(join(ghTarball, ".."))).toBe(false);
  });

  test("github handler passes slash subpaths directly to tarball install", async () => {
    process.env.MAW_GITHUB_BASE_URL = "https://gh.example";
    const ghTarball = makeTarball("github-direct-subpath");
    queueDownload({ ok: true, path: ghTarball });
    queueExtract({ subpaths: { "nested/tool": defaultManifest("nested-tool") } });

    await installFromGithub({ owner: "owner", repo: "repo", subpath: "nested/tool", ref: "v1" }, { force: true });

    expect(downloadCalls).toEqual(["https://gh.example/owner/repo/archive/refs/tags/v1.tar.gz"]);
    expect(recordInstallCalls.at(-1)).toMatchObject({ name: "nested-tool", source: "github:owner/repo/nested/tool@v1" });
  });

  test("github handler falls back from plugins-prefixed probe to literal single-segment subpath", async () => {
    process.env.MAW_GITHUB_BASE_URL = "https://gh.example";
    const ghTarball = makeTarball("github-literal-subpath");
    queueDownload({ ok: true, path: ghTarball });
    queueExtract({ subpaths: { "plugins/tool": null } });
    queueExtract({ subpaths: { tool: defaultManifest("literal-tool") } });

    await installFromGithub({ owner: "owner", repo: "repo", subpath: "tool", ref: "v2" }, { force: true });

    expect(downloadCalls).toEqual(["https://gh.example/owner/repo/archive/refs/tags/v2.tar.gz"]);
    expect(recordInstallCalls).toHaveLength(1);
    expect(recordInstallCalls[0]).toMatchObject({ name: "literal-tool", source: "github:owner/repo/tool@v2" });
    expect(printCalls.at(-1)?.[1]).toBe(join(installDir, "literal-tool"));
    expect(existsSync(join(ghTarball, ".."))).toBe(false);
  });
});
