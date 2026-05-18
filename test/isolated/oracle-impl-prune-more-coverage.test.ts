/** Focused isolated coverage for src/commands/plugins/oracle/impl-prune.ts. */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { OracleEntry } from "../../src/sdk";
import type { StaleEntry, StaleTier } from "../../src/commands/plugins/oracle/impl-stale";

const TEST_CONFIG_DIR = mkdtempSync(join(tmpdir(), "maw-oracle-impl-prune-more-"));
const REGISTRY_FILE = join(TEST_CONFIG_DIR, "oracles.json");

type Session = { name: string; windows: Array<{ index?: number; name: string }> };

let sessions: Session[] | Error = [];
let logs: string[] = [];

const originalLog = console.log;

mock.module(import.meta.resolve("../../src/sdk"), () => ({
  CONFIG_DIR: TEST_CONFIG_DIR,
  listSessions: async () => {
    if (sessions instanceof Error) throw sessions;
    return sessions;
  },
  readCache: () => ({ oracles: [] }),
  scanAndCache: () => ({ oracles: [] }),
}));

const prune = await import("../../src/commands/plugins/oracle/impl-prune.ts?oracle-impl-prune-more-coverage");

function oracleEntry(patch: Partial<OracleEntry> = {}): OracleEntry {
  const name = patch.name ?? "ghost";
  return {
    org: "Soul-Brews-Studio",
    repo: `${name}-oracle`,
    name,
    local_path: join(TEST_CONFIG_DIR, `${name}-oracle`),
    has_psi: false,
    has_fleet_config: false,
    budded_from: null,
    budded_at: null,
    federation_node: null,
    detected_at: "2026-05-18T00:00:00.000Z",
    ...patch,
  };
}

function staleEntry(name: string, tier: StaleTier, patch: Partial<StaleEntry> = {}): StaleEntry {
  return {
    name,
    org: "Soul-Brews-Studio",
    repo: `${name}-oracle`,
    local_path: join(TEST_CONFIG_DIR, `${name}-oracle`),
    has_psi: false,
    awake: false,
    last_commit: null,
    days_since_commit: null,
    tier,
    recommendation: tier === "DEAD" ? "prune candidate" : "keep watching",
    ...patch,
  };
}

function writeRegistry(raw: unknown): void {
  const data = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
  writeFileSync(REGISTRY_FILE, data, "utf-8");
}

function readRegistry(): Record<string, unknown> {
  return JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
}

function output(): string {
  return logs.join("\n");
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

beforeEach(() => {
  rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  sessions = [];
  logs = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.log = originalLog;
});

afterAll(() => {
  rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
});

describe("oracle impl-prune focused isolated coverage", () => {
  test("invalid registry JSON is treated as empty and the clean report does not rewrite it", async () => {
    writeRegistry("{ invalid registry json");

    await expect(prune.runPrune({}, { listAwake: async () => new Set<string>() })).resolves.toEqual([]);
    await prune.cmdOraclePrune({}, { listAwake: async () => new Set<string>() });

    expect(stripAnsi(output())).toContain("No prune candidates");
    expect(readFileSync(REGISTRY_FILE, "utf-8")).toBe("{ invalid registry json");
  });

  test("skips entries with positive signals and stale tiers that are not pruneable", async () => {
    const skipped = prune.buildPruneCandidates([
      oracleEntry({ name: "has-psi", has_psi: true }),
      oracleEntry({ name: "has-fleet", has_fleet_config: true }),
      oracleEntry({ name: "has-parent", budded_from: "neo" }),
      oracleEntry({ name: "has-node", federation_node: "white" }),
      oracleEntry({ name: "awake-only" }),
    ], new Set(["awake-only"]));

    expect(skipped).toEqual([]);

    const staleCandidates = await prune.runPrune({ stale: true }, {
      runStale: async () => [
        staleEntry("active", "ACTIVE", { awake: true, recommendation: "awake in tmux" }),
        staleEntry("slow", "SLOW", { days_since_commit: 10, recommendation: "monitor" }),
      ],
    });

    expect(staleCandidates).toEqual([]);
  });

  test("dry-run human report lists candidates and leaves the temp registry unchanged", async () => {
    const registry = {
      oracles: [
        oracleEntry({ name: "ghost", local_path: "" }),
        oracleEntry({ name: "dust" }),
        oracleEntry({ name: "awake-only" }),
        oracleEntry({ name: "federated", federation_node: "clinic-nat" }),
      ],
      retired: [{ ...oracleEntry({ name: "old" }), retired_at: "2026-01-01T00:00:00.000Z", retired_reasons: ["old"] }],
    };
    writeRegistry(registry);
    const before = readFileSync(REGISTRY_FILE, "utf-8");
    sessions = [{ name: "maw", windows: [{ name: "awake-only-oracle" }] }];

    await prune.cmdOraclePrune({});

    const plain = stripAnsi(output());
    expect(plain).toContain("Prune candidates (2)");
    expect(plain).toContain("dry-run");
    expect(plain).toContain("ghost");
    expect(plain).toContain("not cloned");
    expect(plain).toContain("dust");
    expect(plain).toContain("Run with --force");
    expect(plain).not.toContain("awake-only");
    expect(plain).not.toContain("federated");
    expect(readFileSync(REGISTRY_FILE, "utf-8")).toBe(before);
  });

  test("force confirmation prunes candidates into retired and prints the removal report", async () => {
    writeRegistry({
      oracles: [
        oracleEntry({ name: "remove-a", local_path: "" }),
        oracleEntry({ name: "remove-b" }),
        oracleEntry({ name: "keep-psi", has_psi: true }),
        oracleEntry({ name: "keep-awake" }),
      ],
      retired: [{ ...oracleEntry({ name: "already-retired" }), retired_at: "2026-01-01T00:00:00.000Z", retired_reasons: ["manual"] }],
    });
    sessions = [{ name: "maw", windows: [{ name: "keep-awake-oracle" }] }];
    const prompts: string[] = [];

    await prune.cmdOraclePrune({ force: true }, {
      promptConfirm: async (message) => {
        prompts.push(message);
        return true;
      },
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Retire 2 oracle(s)");

    const written = readRegistry();
    expect((written.oracles as OracleEntry[]).map((entry) => entry.name)).toEqual(["keep-psi", "keep-awake"]);

    const retired = written.retired as Array<OracleEntry & { retired_at: string; retired_reasons: string[] }>;
    expect(retired.map((entry) => entry.name)).toEqual(["already-retired", "remove-a", "remove-b"]);
    expect(retired[1].retired_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(retired[1].retired_reasons).toEqual(["empty lineage", "not cloned", "no tmux", "no federation"]);
    expect(retired[2].retired_reasons).toEqual(["empty lineage", "no tmux", "no federation"]);

    const plain = stripAnsi(output());
    expect(plain).toContain("Retired 2 oracle(s) → retired[] in registry");
    expect(plain).toContain("→ remove-a");
    expect(plain).toContain("→ remove-b");
  });
});
