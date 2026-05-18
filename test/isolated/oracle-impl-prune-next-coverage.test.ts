/** Next-pass isolated coverage for src/commands/plugins/oracle/impl-prune.ts. */
import { afterEach, describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "stream";
import { join } from "path";
import type { OracleEntry } from "../../src/sdk";
import type { StaleEntry } from "../../src/commands/plugins/oracle/impl-stale";

const prune = await import("../../src/commands/plugins/oracle/impl-prune");

const originalLog = console.log;

afterEach(() => {
  console.log = originalLog;
});

function entry(patch: Partial<OracleEntry> = {}): OracleEntry {
  const name = patch.name ?? "ghost";
  return {
    org: "Soul-Brews-Studio",
    repo: `${name}-oracle`,
    name,
    local_path: join("/tmp", `${name}-oracle`),
    has_psi: false,
    has_fleet_config: false,
    budded_from: null,
    budded_at: null,
    federation_node: null,
    detected_at: "2026-05-18T00:00:00.000Z",
    ...patch,
  };
}

function stale(name: string, patch: Partial<StaleEntry> = {}): StaleEntry {
  return {
    org: "Soul-Brews-Studio",
    repo: `${name}-oracle`,
    name,
    local_path: join("/tmp", `${name}-oracle`),
    has_psi: false,
    awake: false,
    last_commit: null,
    days_since_commit: null,
    tier: "STALE",
    recommendation: "inspect",
    ...patch,
  };
}

async function captureConsole(fn: () => Promise<unknown>): Promise<string> {
  const logs: string[] = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    await fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join("\n");
}

async function runWithPrompt(answer: string, fn: () => Promise<unknown>): Promise<{ prompt: string; logs: string }> {
  const stdinDesc = Object.getOwnPropertyDescriptor(process, "stdin");
  const stdoutDesc = Object.getOwnPropertyDescriptor(process, "stdout");
  const input = new PassThrough();
  const promptChunks: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      promptChunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
      callback();
    },
  });
  const logs: string[] = [];

  Object.defineProperty(process, "stdin", { value: input, configurable: true });
  Object.defineProperty(process, "stdout", { value: output, configurable: true });
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  input.end(`${answer}\n`);
  try {
    await fn();
  } finally {
    console.log = originalLog;
    if (stdinDesc) Object.defineProperty(process, "stdin", stdinDesc);
    if (stdoutDesc) Object.defineProperty(process, "stdout", stdoutDesc);
  }

  return { prompt: promptChunks.join(""), logs: logs.join("\n") };
}

describe("oracle impl-prune next-pass coverage", () => {
  test("stale mode threads dependency hooks through runStale and maps only stale/dead tiers", async () => {
    const sourceEntries = [entry({ name: "from-read-entries" })];
    const now = new Date("2026-05-18T12:34:56.000Z");
    const hookCalls: string[] = [];

    const candidates = await prune.runPrune({ stale: true }, {
      readEntries: () => {
        hookCalls.push("readEntries");
        return sourceEntries;
      },
      listAwake: async () => {
        hookCalls.push("listAwake");
        return new Set(["awake-stale"]);
      },
      now: () => {
        hookCalls.push("now");
        return now;
      },
      runStale: async (opts, deps) => {
        expect(opts).toEqual({ all: false });
        expect(deps.readEntries?.()).toEqual(sourceEntries);
        expect(await deps.listAwake?.()).toEqual(new Set(["awake-stale"]));
        expect(deps.now?.()).toBe(now);
        return [
          stale("awake-stale", { awake: true, recommendation: "stale but awake" }),
          stale("dead-silent", { tier: "DEAD", recommendation: "retire" }),
          stale("active", { tier: "ACTIVE", recommendation: "healthy", awake: true }),
        ];
      },
    });

    expect(hookCalls).toEqual(["readEntries", "listAwake", "now"]);
    expect(candidates.map((candidate) => candidate.entry.name)).toEqual(["awake-stale", "dead-silent"]);
    expect(candidates[0]).toMatchObject({
      tier: "STALE",
      reasons: ["STALE (30-90d)", "stale but awake"],
    });
    expect(candidates[1]).toMatchObject({
      tier: "DEAD",
      reasons: ["DEAD (>90d)", "retire", "no tmux"],
    });
  });

  test("json output marks force runs as non-dry-run without mutating the cache", async () => {
    let wrote = false;
    const stdout = await captureConsole(() =>
      prune.cmdOraclePrune({ json: true, force: true }, {
        listAwake: async () => new Set<string>(),
        readRawCache: () => ({ oracles: [entry({ name: "json-force", local_path: "" })] }),
        writeRawCache: () => {
          wrote = true;
        },
      }),
    );

    const payload = JSON.parse(stdout);
    expect(payload).toMatchObject({ schema: 1, count: 1, dry_run: false });
    expect(payload.candidates[0].entry.name).toBe("json-force");
    expect(payload.candidates[0].reasons).toContain("not cloned");
    expect(wrote).toBe(false);
  });

  test("default prompt confirmation accepts y and retires candidates into a fresh retired list", async () => {
    let written: Record<string, unknown> | null = null;

    const { prompt, logs } = await runWithPrompt("y", () =>
      prune.cmdOraclePrune({ force: true }, {
        listAwake: async () => new Set<string>(),
        readRawCache: () => ({
          oracles: [entry({ name: "prompted", local_path: "" })],
        }),
        writeRawCache: (data) => {
          written = data;
        },
      }),
    );

    expect(prompt).toContain("Retire 1 oracle(s)?");
    expect((written!.oracles as OracleEntry[])).toEqual([]);
    const retired = written!.retired as Array<OracleEntry & { retired_reasons: string[] }>;
    expect(retired).toHaveLength(1);
    expect(retired[0].name).toBe("prompted");
    expect(retired[0].retired_reasons).toEqual(["empty lineage", "not cloned", "no tmux", "no federation"]);
    expect(logs).toContain("Retired 1 oracle(s) → retired[] in registry");
  });
});
