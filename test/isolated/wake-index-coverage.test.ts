import { beforeEach, describe, expect, mock, test } from "bun:test";

const wakeCalls: Array<{ oracle: string; opts: Record<string, unknown> }> = [];
const wakeAllCalls: Array<Record<string, unknown>> = [];
const parseTargetCalls: string[] = [];
const ensureClonedCalls: string[] = [];
const fetchPromptCalls: Array<{ kind: string; num: number; repo?: string }> = [];

let parsedTarget: null | { oracle: string; slug: string; issueNum?: number } = null;
let fetchedPrompt = "fetched prompt";

mock.module("maw-js/commands/shared/wake", () => ({
  cmdWake: async (oracle: string, opts: Record<string, unknown>) => {
    wakeCalls.push({ oracle, opts });
    console.log(`wake ${oracle}`);
  },
}));

mock.module("maw-js/commands/shared/fleet", () => ({
  cmdWakeAll: async (opts: Record<string, unknown>) => {
    wakeAllCalls.push(opts);
    console.log("wake all invoked");
  },
}));

mock.module("maw-js/commands/shared/wake-target", () => ({
  parseWakeTarget: (target: string) => {
    parseTargetCalls.push(target);
    return parsedTarget;
  },
  ensureCloned: async (slug: string) => {
    ensureClonedCalls.push(slug);
  },
}));

mock.module("maw-js/commands/shared/wake-resolve", () => ({
  fetchGitHubPrompt: async (kind: string, num: number, repo?: string) => {
    fetchPromptCalls.push({ kind, num, repo });
    return fetchedPrompt;
  },
}));

const { command, default: handler } = await import("../../src/vendor/mpr-plugins/wake/index.ts?wake-index-coverage");

beforeEach(() => {
  wakeCalls.length = 0;
  wakeAllCalls.length = 0;
  parseTargetCalls.length = 0;
  ensureClonedCalls.length = 0;
  fetchPromptCalls.length = 0;
  parsedTarget = null;
  fetchedPrompt = "fetched prompt";
});

describe("wake plugin index", () => {
  test("exports wake command metadata", () => {
    expect(command).toEqual({
      name: "wake",
      description: "Spawn or attach to an oracle session",
    });
  });

  test("returns usage when cli args omit the wake target", async () => {
    const result = await handler({ source: "cli", args: [] } as any);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("usage: maw wake <oracle|org/repo|URL>");
    expect(wakeCalls).toEqual([]);
  });

  test("dispatches wake all with parsed fleet flags", async () => {
    const result = await handler({ source: "cli", args: ["all", "--kill", "--resume"] } as any);

    expect(result).toEqual({ ok: true, output: "wake all invoked" });
    expect(wakeAllCalls).toEqual([{ kill: true, all: undefined, resume: true }]);
  });

  test("maps cli repo issue target into cloned repo wake options", async () => {
    parsedTarget = { oracle: "repo-oracle", slug: "Soul-Brews-Studio/maw-js", issueNum: 42 };
    fetchedPrompt = "issue body";

    const result = await handler({
      source: "cli",
      args: ["https://github.com/Soul-Brews-Studio/maw-js/issues/42", "--new", "--no-attach"],
    } as any);

    expect(result.ok).toBe(true);
    expect(parseTargetCalls).toEqual(["https://github.com/Soul-Brews-Studio/maw-js/issues/42"]);
    expect(ensureClonedCalls).toEqual(["Soul-Brews-Studio/maw-js"]);
    expect(fetchPromptCalls).toEqual([{ kind: "issue", num: 42, repo: "Soul-Brews-Studio/maw-js" }]);
    expect(wakeCalls).toEqual([
      {
        oracle: "repo-oracle",
        opts: {
          urlRepoName: "maw-js",
          fresh: true,
          attach: false,
          prompt: "issue body",
          task: "issue-42",
        },
      },
    ]);
  });

  test("maps cli reusable worktree picker flags", async () => {
    const result = await handler({
      source: "cli",
      args: ["homekeeper", "--wt", "white", "--pick", "--name", "osmosis"],
    } as any);

    expect(result.ok).toBe(true);
    expect(wakeCalls).toEqual([
      {
        oracle: "homekeeper",
        opts: {
          wt: "white",
          pick: true,
          name: "osmosis",
        },
      },
    ]);
  });

  test("maps api pr body into wake options", async () => {
    fetchedPrompt = "pr body";

    const result = await handler({
      source: "api",
      args: {
        oracle: "neo",
        pr: 7,
        repo: "owner/repo",
        wt: "feature-slot",
        pick: true,
        name: "named-slot",
        dryRun: true,
        solo: true,
        snapshot: "snap-1",
      },
    } as any);

    expect(result).toEqual({ ok: true, output: "wake neo" });
    expect(fetchPromptCalls).toEqual([{ kind: "pr", num: 7, repo: "owner/repo" }]);
    expect(wakeCalls).toEqual([
      {
        oracle: "neo",
        opts: {
          wt: "feature-slot",
          pick: true,
          name: "named-slot",
          prompt: "pr body",
          task: "pr-7",
          dryRun: true,
          noRehydrate: true,
          snapshotId: "snap-1",
          fromSnapshot: true,
        },
      },
    ]);
  });

  test("returns missing oracle for api bodies without oracle", async () => {
    const result = await handler({ source: "api", args: { task: "ignored" } } as any);

    expect(result).toEqual({ ok: false, error: "missing oracle name" });
    expect(wakeCalls).toEqual([]);
  });
});
