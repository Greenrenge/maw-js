/** Targeted runtime coverage for src/vendor/mpr-plugins/doctor/impl.ts. */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const C = { green: "", red: "", yellow: "", gray: "", reset: "" };

let logs: string[] = [];
let execCalls: string[] = [];
let pm2Jlist: string | Error | null = null;
let fetchVersion: string | null = null;
let fetchOk = true;
let peersStore: Record<string, any> = {};
let loadPeersError: Error | null = null;
let configValue: any = { oracle: "mawjs", node: "local" };
let configError: Error | null = null;
let staleCheck = { name: "peers:stale", ok: true, message: "no stale peers" };
let fixStaleResult = { ok: true, checks: [{ name: "peers:fix-stale", ok: true, message: "removed 0 stale peers" }] };
let manifestValue: any[] = [];
let manifestError: Error | null = null;
let invalidateCalls = 0;
let branchCheck = { name: "maw-js:branch", ok: true, message: "on alpha" };
let worktreeCheck = { name: "worktrees:stillborn", ok: true, message: "no .wt-* directories found" };

const originalLog = console.log;
const originalFetch = globalThis.fetch;

mock.module("child_process", () => ({
  execSync: (cmd: string) => {
    execCalls.push(cmd);
    if (cmd.includes("pm2 jlist")) {
      if (pm2Jlist instanceof Error) throw pm2Jlist;
      return pm2Jlist ?? "[]";
    }
    throw new Error(`unexpected execSync: ${cmd}`);
  },
}));

mock.module("maw-js/config", () => ({
  loadConfig: () => {
    if (configError) throw configError;
    return configValue;
  },
}));

mock.module("maw-js/commands/shared/fleet-doctor-fixer", () => ({ C }));

mock.module("maw-js/lib/oracle-manifest", () => ({
  invalidateManifest: () => { invalidateCalls += 1; },
  loadManifestCached: () => {
    if (manifestError) throw manifestError;
    return manifestValue;
  },
}));

mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/peers-store"), () => ({
  loadPeers: () => {
    if (loadPeersError) throw loadPeersError;
    return { version: 1, peers: peersStore };
  },
}));

mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/stale-peers"), () => ({
  checkStalePeers: () => staleCheck,
  cmdFixStalePeers: async () => fixStaleResult,
}));

mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/maw-js-branch-check"), () => ({
  checkMawJsBranch: async () => branchCheck,
}));

mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/stillborn-worktrees"), () => ({
  checkStillbornWorktrees: () => worktreeCheck,
}));

mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/bun-link-detect"), () => ({
  detectBunLinkedCheckout: () => null,
}));

const { cmdDoctor } = await import("../../src/vendor/mpr-plugins/doctor/impl.ts?doctor-impl-runtime-coverage");

beforeEach(() => {
  logs = [];
  execCalls = [];
  pm2Jlist = null;
  fetchVersion = null;
  fetchOk = true;
  peersStore = {};
  loadPeersError = null;
  configValue = { oracle: "mawjs", node: "local" };
  configError = null;
  staleCheck = { name: "peers:stale", ok: true, message: "no stale peers" };
  fixStaleResult = { ok: true, checks: [{ name: "peers:fix-stale", ok: true, message: "removed 0 stale peers" }] };
  manifestValue = [];
  manifestError = null;
  invalidateCalls = 0;
  branchCheck = { name: "maw-js:branch", ok: true, message: "on alpha" };
  worktreeCheck = { name: "worktrees:stillborn", ok: true, message: "no .wt-* directories found" };
  console.log = (line?: unknown) => { logs.push(String(line ?? "")); };
  globalThis.fetch = (async (url: string | URL | Request) => {
    return {
      ok: fetchOk,
      json: async () => (fetchVersion === null ? {} : { version: fetchVersion }),
    } as Response;
  }) as typeof fetch;
});

afterEach(() => {
  console.log = originalLog;
  globalThis.fetch = originalFetch;
});

describe("doctor impl runtime coverage", () => {
  test("--fix-stale returns stale-peer fix result without rendering the normal suite", async () => {
    fixStaleResult = {
      ok: true,
      checks: [{ name: "peers:fix-stale", ok: true, message: "removed 2 stale peers" }],
    };

    const result = await cmdDoctor(["--fix-stale"]);

    expect(result).toEqual(fixStaleResult);
    expect(logs).toEqual([]);
    expect(execCalls).toEqual([]);
  });

  test("version check reports drift and --allow-drift downgrades version-only failures", async () => {
    pm2Jlist = JSON.stringify([
      { name: "maw", pm_id: 7, pm2_env: { env: { MAW_PORT: "4567" } } },
    ]);
    fetchVersion = "0.0.0-test-drift";

    const drift = await cmdDoctor(["version"]);
    const allowed = await cmdDoctor(["version", "--allow-drift"]);

    expect(drift.ok).toBe(false);
    expect(drift.checks).toHaveLength(1);
    expect(drift.checks[0]!.name).toBe("version:maw#7");
    expect(drift.checks[0]!.message).toContain("drift — running 0.0.0-test-drift");
    expect(drift.checks[0]!.message).toContain(":4567");
    expect(allowed.ok).toBe(true);
    expect(execCalls).toEqual(["pm2 jlist 2>/dev/null", "pm2 jlist 2>/dev/null"]);
  });

  test("peers check surfaces duplicate local identity while preserving stale-peer result", async () => {
    peersStore = {
      twin: {
        url: "http://peer.example:3456",
        node: "local",
        addedAt: "2026-01-01T00:00:00.000Z",
        lastSeen: "2026-01-02T00:00:00.000Z",
        identity: { oracle: "mawjs", node: "local" },
      },
    };
    staleCheck = { name: "peers:stale", ok: false, message: "1 stale peer (>30d) — run 'maw doctor --fix-stale' to remove" };

    const result = await cmdDoctor(["peers"]);

    expect(result.ok).toBe(false);
    expect(result.checks.map(c => c.name)).toEqual(["peers:duplicates", "peers:stale"]);
    expect(result.checks[0]!.ok).toBe(false);
    expect(result.checks[0]!.message).toContain('duplicate <oracle>:<node> claim "mawjs:local"');
    expect(result.checks[0]!.message).toContain("<local>");
    expect(result.checks[0]!.message).toContain("twin (http://peer.example:3456)");
    expect(result.checks[1]).toEqual(staleCheck);
  });

  test("manifest check invalidates cache, reports cross-source gaps, and remains warning-only", async () => {
    manifestValue = [
      { name: "ghost", node: "local", sources: ["agent"] },
      { name: "orphan", sources: ["oracles-json"] },
    ];

    const result = await cmdDoctor(["manifest"]);

    expect(result.ok).toBe(true);
    expect(invalidateCalls).toBe(1);
    expect(result.checks).toEqual([
      {
        name: "manifest:cross-source",
        ok: true,
        message: "2 cross-source gaps (agent-without-fleet×1, oracles-json-without-runtime×1)",
      },
    ]);
    const joinedLogs = logs.join("\n");
    expect(joinedLogs).toContain("[agent-without-fleet]");
    expect(joinedLogs).toContain("[oracles-json-without-runtime]");
  });

  test("manifest check skips unreadable manifests as a non-fatal doctor warning", async () => {
    manifestError = new Error("manifest boom");

    const result = await cmdDoctor(["manifest"]);

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual([
      { name: "manifest:cross-source", ok: true, message: "manifest unreadable (manifest boom) — skipping cross-source check" },
    ]);
  });
});
