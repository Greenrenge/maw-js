/**
 * Default-suite coverage for src/plugin/registry-invoke.ts.
 *
 * The 00- prefix is intentional: older default-suite API tests install a
 * process-global mock for ../src/plugin/registry. Loading the real invoke
 * module first keeps this focused helper coverage deterministic while the
 * deeper WASM cases remain isolated under test/isolated/.
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { invokePlugin } from "../src/plugin/registry-invoke";
import type { InvokeContext, LoadedPlugin, PluginManifest } from "../src/plugin/types";

const tmp = mkdtempSync(join(tmpdir(), "maw-registry-invoke-default-"));
let seq = 0;

function writeModule(source: string): string {
  const path = join(tmp, `plugin-${++seq}-${Date.now()}.mjs`);
  writeFileSync(path, source);
  return path;
}

function tsPlugin(entryPath: string, manifest: Partial<PluginManifest> = {}): LoadedPlugin {
  return {
    manifest: {
      name: manifest.name ?? "plug",
      version: manifest.version ?? "1.0.0",
      sdk: manifest.sdk ?? "*",
      ...manifest,
    },
    dir: tmp,
    entryPath,
    wasmPath: "",
    kind: "ts",
  };
}

function wasmPlugin(manifest: Partial<PluginManifest> = {}): LoadedPlugin {
  return {
    manifest: {
      name: manifest.name ?? "wasm-plug",
      version: manifest.version ?? "1.0.0",
      sdk: manifest.sdk ?? "*",
      ...manifest,
    },
    dir: tmp,
    wasmPath: join(tmp, "missing.wasm"),
    kind: "wasm",
  };
}

beforeEach(() => {
  seq += 1;
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("invokePlugin universal CLI metadata in the default suite", () => {
  test("--version reports effective surfaces including default-name TS CLI", async () => {
    const entry = writeModule(`export default async function handler() { return { ok: true }; }`);
    const result = await invokePlugin(
      tsPlugin(entry, {
        name: "surface",
        version: "2.3.4",
        description: "surface reporter",
        weight: 7,
        api: { path: "/api/surface", methods: ["GET"] },
        hooks: { on: ["message:send"] },
        transport: { peer: true },
      }),
      { source: "cli", args: ["--version"] },
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("surface v2.3.4 (ts, weight:7)");
    expect(result.output).toContain("surface reporter");
    expect(result.output).toContain("cli:surface");
    expect(result.output).toContain("api:/api/surface");
    expect(result.output).toContain("hooks");
    expect(result.output).toContain("peer");
  });

  test("--help matches anywhere in args and renders declared CLI metadata", async () => {
    const entry = writeModule(`export const handler = async () => ({ ok: true });`);
    const result = await invokePlugin(
      tsPlugin(entry, {
        name: "helper",
        version: "1.0.1",
        description: "helpful plugin",
        cli: {
          command: "helper",
          help: "maw helper <thing>",
          aliases: ["hp"],
          flags: { "--name": "Name to render" },
        },
        api: { path: "/api/helper", methods: ["GET", "POST"] },
        hooks: { gate: ["cmd:before"] },
      }),
      { source: "cli", args: ["sub", "--help"] },
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("helper v1.0.1");
    expect(result.output).toContain("helpful plugin");
    expect(result.output).toContain("usage: maw helper <thing>");
    expect(result.output).toContain("aliases: hp");
    expect(result.output).toContain("--name");
    expect(result.output).toContain("api: GET/POST /api/helper");
    expect(result.output).toContain("hooks: gate");
  });
});

describe("invokePlugin TS dispatch in the default suite", () => {
  test("returns handler InvokeResult objects as-is", async () => {
    const entry = writeModule(`
      export default async function handler(ctx) {
        return { ok: true, output: "args=" + ctx.args.join("|") };
      }
    `);

    const result = await invokePlugin(
      tsPlugin(entry),
      { source: "api", args: ["a", "b"] } satisfies InvokeContext,
    );

    expect(result).toEqual({ ok: true, output: "args=a|b" });
  });

  test("honors caller-provided writer instead of replacing it for CLI calls", async () => {
    const entry = writeModule(`
      export async function handler(ctx) {
        ctx.writer("sent", 42);
        return { ok: true };
      }
    `);
    const seen: string[] = [];

    const result = await invokePlugin(
      tsPlugin(entry),
      {
        source: "cli",
        args: [],
        writer: (...args: unknown[]) => seen.push(args.map(String).join(":")),
      },
    );

    expect(result).toEqual({ ok: true });
    expect(seen).toEqual(["sent:42"]);
  });

  test("missing handlers fail without falling through to WASM", async () => {
    const entry = writeModule(`export const nope = true;`);

    const result = await invokePlugin(tsPlugin(entry), { source: "api", args: [] });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("TS plugin has no default export or handler");
  });

  test("thrown non-Error values are coerced into error results", async () => {
    const entry = writeModule(`export default async function handler() { throw "plain failure"; }`);

    const result = await invokePlugin(tsPlugin(entry), { source: "api", args: [] });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("plain failure");
  });

  test("non-CLI calls skip universal flags and reach plugin execution", async () => {
    const result = await invokePlugin(wasmPlugin(), { source: "peer", args: ["--version"] });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("failed to read wasm");
  });
});
