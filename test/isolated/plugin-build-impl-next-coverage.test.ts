/** Next-pass isolated coverage for src/commands/plugins/plugin/build-impl.ts. */
import { afterEach, describe, expect, mock, test } from "bun:test";
import { dirname, join } from "path";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import {
  cmdPluginBuild,
  inferCapabilities,
  inferCapabilitiesRegex,
} from "../../src/commands/plugins/plugin/build-impl";

const created: string[] = [];
const originalLog = console.log;
const originalError = console.error;

afterEach(() => {
  delete process.env.MAW_PLUGIN_CAP_INFER;
  console.log = originalLog;
  console.error = originalError;
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

function scaffoldPlugin(
  dir: string,
  opts: {
    name?: string;
    version?: string;
    target?: string;
    entry?: string;
    source?: string;
    capabilities?: string[];
  } = {},
): void {
  const entry = opts.entry ?? "./src/index.ts";
  const sourcePath = join(dir, entry);
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(
    sourcePath,
    opts.source ?? "export default async function run() { return { ok: true }; }\n",
  );
  writeFileSync(
    join(dir, "plugin.json"),
    JSON.stringify(
      {
        name: opts.name ?? "next-build",
        version: opts.version ?? "0.1.0",
        sdk: "^1.0.0",
        target: opts.target ?? "js",
        entry,
        capabilities: opts.capabilities ?? [],
        artifact: { path: "dist/index.js", sha256: null },
      },
      null,
      2,
    ) + "\n",
  );
}

async function captureConsole(fn: () => Promise<unknown>): Promise<{ stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  console.log = (...args: unknown[]) => stdout.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => stderr.push(args.map(String).join(" "));
  try {
    await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  return { stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("plugin build implementation next-pass coverage", () => {
  test("regex inference detects SDK, risky imports, ffi, and global fetch capabilities", () => {
    const regexSource = [
      'import { readFileSync } from "node:fs";',
      'import { spawn } from "node:child_process";',
      'import ffi from "bun:ffi";',
      "maw.identity();",
      'fetch("https://example.invalid");',
    ].join("\n");

    expect(inferCapabilitiesRegex(regexSource)).toEqual([
      "ffi:any",
      "fs:read",
      "net:fetch",
      "proc:spawn",
      "sdk:identity",
    ]);

    process.env.MAW_PLUGIN_CAP_INFER = "regex";
    expect(inferCapabilities("maw.wake(); fetch('/health');")).toEqual(["net:fetch", "sdk:wake"]);

    delete process.env.MAW_PLUGIN_CAP_INFER;
    expect(
      inferCapabilities('import maw from "@maw-js/sdk";\nmaw["send"]();\n', "plugin.ts"),
    ).toContain("sdk:send");
  });

  test("build rejects missing manifests and the explicit wasm phase gate before bundling", async () => {
    const missingManifestDir = tmpDir("maw-plugin-no-manifest-");
    await expect(cmdPluginBuild([missingManifestDir])).rejects.toThrow(/no plugin\.json/);

    const wasmDir = tmpDir("maw-plugin-wasm-target-");
    scaffoldPlugin(wasmDir, { target: "wasm" });

    await expect(cmdPluginBuild([wasmDir])).rejects.toThrow(/target "wasm" not yet supported/);
    expect(existsSync(join(wasmDir, "dist", "index.js"))).toBe(false);
  });

  test("build --types emits dist manifest, tarball, and plugin-specific declarations", async () => {
    const dir = tmpDir("maw-plugin-types-build-");
    scaffoldPlugin(dir, {
      name: "typed-next",
      source: [
        "export interface TypedNextResult { ok: boolean }",
        "export default function run(): TypedNextResult { return { ok: true }; }",
      ].join("\n"),
    });
    mock.module(import.meta.resolve("../../src/commands/plugins/plugin/dts-gen"), () => ({
      generatePluginDts: ({ distDir, pluginName }: { distDir: string; pluginName: string }) => {
        const dtsPath = join(distDir, `${pluginName}.d.ts`);
        writeFileSync(dtsPath, "export interface TypedNextResult { ok: boolean }\n");
        return { dtsPath, diagnostics: "" };
      },
    }));

    const { stdout } = await captureConsole(() => cmdPluginBuild([dir, "--types"]));
    const distManifest = readJson(join(dir, "dist", "plugin.json"));

    expect(distManifest.name).toBe("typed-next");
    expect("entry" in distManifest).toBe(false);
    expect(distManifest.artifact).toMatchObject({ path: "./index.js" });
    expect(String((distManifest.artifact as { sha256: string }).sha256)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(existsSync(join(dir, "typed-next-0.1.0.tgz"))).toBe(true);
    expect(existsSync(join(dir, "dist", "typed-next.d.ts"))).toBe(true);
    expect(existsSync(join(dir, "dist", "tsconfig.emit.json"))).toBe(false);
    expect(stdout).toContain("types:        dist/typed-next.d.ts");
    expect(stdout).toContain("ready. install with: maw plugin install ./typed-next-0.1.0.tgz");
  });
});
