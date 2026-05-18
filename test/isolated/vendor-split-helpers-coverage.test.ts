/** Targeted isolated coverage for duplicated vendor split helper implementations. */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type Session = {
  name: string;
  windows: Array<{ index?: number; name?: string }>;
};

type ResolveResult =
  | { kind: "match"; match: Session }
  | { kind: "ambiguous"; candidates: Session[] }
  | { kind: "none"; hints?: Session[] };

type CmdSplit = (target: string, opts?: {
  pct?: number;
  vertical?: boolean;
  noAttach?: boolean;
  lock?: boolean;
  settleMs?: number;
  anchorPane?: string;
}) => Promise<void>;

let sessions: Session[] = [];
let resolveResults = new Map<string, ResolveResult>();
let resolveCalls: Array<{ target: string; sessions: Session[] }> = [];
let listSessionsCalls = 0;
let hostExecCalls: string[] = [];
let hostExecFailure: unknown = null;
let lockEvents: string[] = [];
let normalizeCalls: string[] = [];
let normalizeImpl: (target: string) => string = (target) => target;
let logs: string[] = [];
let errors: string[] = [];

const original = {
  log: console.log,
  error: console.error,
  tmux: process.env.TMUX,
  tmuxPane: process.env.TMUX_PANE,
};

mock.module("maw-js/sdk", () => ({
  listSessions: async () => {
    listSessionsCalls += 1;
    return sessions;
  },
  hostExec: async (cmd: string) => {
    hostExecCalls.push(cmd);
    if (hostExecFailure) throw hostExecFailure;
    return "";
  },
  withPaneLock: async (fn: () => Promise<void>) => {
    lockEvents.push("lock:start");
    try {
      await fn();
    } finally {
      lockEvents.push("lock:end");
    }
  },
}));

mock.module("maw-js/core/matcher/resolve-target", () => ({
  resolveSessionTarget: (target: string, seenSessions: Session[]) => {
    resolveCalls.push({ target, sessions: seenSessions });
    return resolveResults.get(target) ?? { kind: "none", hints: [] };
  },
}));

mock.module("maw-js/core/matcher/normalize-target", () => ({
  normalizeTarget: (target: string) => {
    normalizeCalls.push(target);
    return normalizeImpl(target);
  },
}));

const budSplit = await import("../../src/vendor/mpr-plugins/bud/internal/split-impl.ts?vendor-split-helpers-coverage");
const split = await import("../../src/vendor/mpr-plugins/split/impl.ts?vendor-split-helpers-coverage");
const viewSplit = await import("../../src/vendor/mpr-plugins/view/internal/split-impl.ts?vendor-split-helpers-coverage");

const helpers: Array<{ label: string; cmdSplit: CmdSplit }> = [
  { label: "bud/internal/split-impl", cmdSplit: budSplit.cmdSplit },
  { label: "split/impl", cmdSplit: split.cmdSplit },
  { label: "view/internal/split-impl", cmdSplit: viewSplit.cmdSplit },
];

function stdout(): string {
  return logs.join("\n");
}

function stderr(): string {
  return errors.join("\n");
}

function resetCalls(): void {
  resolveCalls = [];
  listSessionsCalls = 0;
  hostExecCalls = [];
  lockEvents = [];
  normalizeCalls = [];
  logs = [];
  errors = [];
}

beforeEach(() => {
  sessions = [];
  resolveResults = new Map();
  hostExecFailure = null;
  normalizeImpl = (target) => target;
  process.env.TMUX = "/tmp/tmux-test";
  process.env.TMUX_PANE = "%7";
  resetCalls();
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.log = original.log;
  console.error = original.error;
  if (original.tmux === undefined) delete process.env.TMUX;
  else process.env.TMUX = original.tmux;
  if (original.tmuxPane === undefined) delete process.env.TMUX_PANE;
  else process.env.TMUX_PANE = original.tmuxPane;
});

for (const helper of helpers) {
  describe(`${helper.label} cmdSplit`, () => {
    test("normalizes before rejecting calls outside tmux", async () => {
      delete process.env.TMUX;
      normalizeImpl = (target) => target.replace(/\/(?:\.git\/?)?$/, "");

      await expect(helper.cmdSplit("repo/.git/")).rejects.toThrow("maw split requires an active tmux session");

      expect(normalizeCalls).toEqual(["repo/.git/"]);
      expect(listSessionsCalls).toBe(0);
      expect(resolveCalls).toEqual([]);
      expect(hostExecCalls).toEqual([]);
    });

    test("prints usage and avoids side effects for empty normalized targets", async () => {
      normalizeImpl = () => "";

      await expect(helper.cmdSplit("anything/.git/")).rejects.toThrow(
        "usage: maw split <target> [--pct N] [--vertical] [--no-attach]",
      );

      expect(stderr()).toContain("usage: maw split <target>");
      expect(stderr()).toContain("maw split yeast");
      expect(listSessionsCalls).toBe(0);
      expect(resolveCalls).toEqual([]);
      expect(hostExecCalls).toEqual([]);
    });

    test("validates pct before resolving or shelling out", async () => {
      for (const pct of [Number.NaN, 0, 100]) {
        resetCalls();
        await expect(helper.cmdSplit("agent", { pct })).rejects.toThrow(`--pct must be 1-99 (got ${pct})`);
        expect(listSessionsCalls).toBe(0);
        expect(resolveCalls).toEqual([]);
        expect(hostExecCalls).toEqual([]);
      }
    });

    test("splits an explicit session target with defaults anchored to TMUX_PANE", async () => {
      await helper.cmdSplit("alpha:2");

      expect(listSessionsCalls).toBe(0);
      expect(resolveCalls).toEqual([]);
      expect(hostExecCalls).toEqual([
        `tmux split-window -t '%7' -h -l 50% "TMUX= tmux attach-session -t alpha:2"`,
      ]);
      expect(stdout()).toContain("split beside — alpha:2 (50%)");
    });

    test("supports vertical no-attach panes and escapes explicit anchors", async () => {
      await helper.cmdSplit("alpha:2", {
        pct: 33,
        vertical: true,
        noAttach: true,
        anchorPane: "%a'b",
      });

      const escapedAnchor = "%a'b".replace(/'/g, "'\\''");
      expect(hostExecCalls).toEqual([`tmux split-window -t '${escapedAnchor}' -v -l 33% "bash"`]);
      expect(stdout()).toContain("split below — empty pane (33%) (anchored at %a'b)");
    });

    test("resolves bare targets to their window index and falls back to window zero", async () => {
      const seenSessions = [
        { name: "01-alpha", windows: [{ index: 4, name: "work" }] },
        { name: "02-beta", windows: [] },
      ];
      sessions = seenSessions;
      resolveResults.set("alpha", { kind: "match", match: seenSessions[0] });

      await helper.cmdSplit("alpha");

      expect(listSessionsCalls).toBe(1);
      expect(resolveCalls).toEqual([{ target: "alpha", sessions: seenSessions }]);
      expect(hostExecCalls).toEqual([
        `tmux split-window -t '%7' -h -l 50% "TMUX= tmux attach-session -t 01-alpha:4"`,
      ]);
      expect(stdout()).toContain("split beside — 01-alpha:4 (50%)");

      resetCalls();
      delete process.env.TMUX_PANE;
      resolveResults.set("beta", { kind: "match", match: seenSessions[1] });

      await helper.cmdSplit("beta");

      expect(listSessionsCalls).toBe(1);
      expect(resolveCalls).toEqual([{ target: "beta", sessions: seenSessions }]);
      expect(hostExecCalls).toEqual([
        `tmux split-window -h -l 50% "TMUX= tmux attach-session -t 02-beta:0"`,
      ]);
      expect(stdout()).toContain("split beside — 02-beta:0 (50%)");
    });

    test("reports ambiguous bare targets with candidates and no tmux side effects", async () => {
      sessions = [
        { name: "east-alpha", windows: [{ index: 0 }] },
        { name: "west-alpha", windows: [{ index: 1 }] },
      ];
      resolveResults.set("alpha", { kind: "ambiguous", candidates: sessions });

      await expect(helper.cmdSplit("alpha")).rejects.toThrow("'alpha' is ambiguous");

      expect(listSessionsCalls).toBe(1);
      expect(stderr()).toContain("'alpha' is ambiguous — matches 2 sessions");
      expect(stderr()).toContain("east-alpha");
      expect(stderr()).toContain("west-alpha");
      expect(stderr()).toContain("use the full name");
      expect(hostExecCalls).toEqual([]);
    });

    test("reports missing bare targets with and without hints", async () => {
      sessions = [{ name: "01-oracle", windows: [{ index: 0 }] }];
      resolveResults.set("ghost", { kind: "none", hints: sessions });

      await expect(helper.cmdSplit("ghost")).rejects.toThrow("session 'ghost' not found in fleet");

      expect(stderr()).toContain("session 'ghost' not found in fleet");
      expect(stderr()).toContain("did you mean:");
      expect(stderr()).toContain("01-oracle");
      expect(hostExecCalls).toEqual([]);

      resetCalls();
      resolveResults.set("nobody", { kind: "none", hints: [] });

      await expect(helper.cmdSplit("nobody")).rejects.toThrow("session 'nobody' not found in fleet");

      expect(stderr()).toContain("session 'nobody' not found in fleet");
      expect(stderr()).not.toContain("did you mean:");
      expect(stderr()).toContain("try: maw ls");
      expect(hostExecCalls).toEqual([]);
    });

    test("serializes locked splits and covers settle/no-settle branches", async () => {
      await helper.cmdSplit("alpha:2", { lock: true, settleMs: 0 });

      expect(lockEvents).toEqual(["lock:start", "lock:end"]);
      expect(hostExecCalls).toEqual([
        `tmux split-window -t '%7' -h -l 50% "TMUX= tmux attach-session -t alpha:2"`,
      ]);

      resetCalls();

      await helper.cmdSplit("alpha:2", { lock: true, settleMs: 1 });

      expect(lockEvents).toEqual(["lock:start", "lock:end"]);
      expect(hostExecCalls).toEqual([
        `tmux split-window -t '%7' -h -l 50% "TMUX= tmux attach-session -t alpha:2"`,
      ]);
    });

    test("wraps host exec failures with split context", async () => {
      hostExecFailure = "tmux refused";

      await expect(helper.cmdSplit("alpha:2")).rejects.toThrow("split failed: tmux refused");

      expect(hostExecCalls).toEqual([
        `tmux split-window -t '%7' -h -l 50% "TMUX= tmux attach-session -t alpha:2"`,
      ]);
    });
  });
}
