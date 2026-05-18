import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "path";

const srcRoot = join(import.meta.dir, "../..");

type Pane = { id: string; target: string; command?: string; title?: string; lastActivity?: number };

let hostCalls: string[] = [];
let hostFailures = new Map<string, Error>();
let hostResponses = new Map<string, string>();
let panes: Pane[] = [];
let fleetFiles: string[] = [];
let fleetWindows: Record<string, string[]> = {};
let ghqRepos: string[] = [];
let worktrees: any[] = [];

mock.module(join(srcRoot, "src/sdk"), () => ({
  hostExec: async (cmd: string) => {
    hostCalls.push(cmd);
    for (const [needle, err] of hostFailures) {
      if (cmd.includes(needle)) throw err;
    }
    for (const [needle, value] of hostResponses) {
      if (cmd.includes(needle)) return value;
    }
    if (cmd.includes("pane_current_command")) return "zsh\n";
    if (cmd.includes("list-panes -a -F")) return "";
    if (cmd.includes("display-message") && cmd.includes("session_name")) return "current-session\n";
    if (cmd.includes("list-sessions") && cmd.includes("session_created")) return "";
    if (cmd.includes("capture-pane")) return "captured\n";
    return "";
  },
  tmux: {
    listPanes: async () => panes,
    capture: async () => "",
  },
  tmuxCmd: () => "tmux",
}));

mock.module(join(srcRoot, "src/commands/shared/fleet-load"), () => ({
  loadFleetEntries: () => fleetFiles.map(file => {
    const sessionName = file.replace(/\.json$/, "");
    const windows = fleetWindows[file] ?? [sessionName];
    return {
      file,
      session: {
        windows: windows.map(name => ({ name, repo: `Org/${name.endsWith("-oracle") ? name : `${name}-oracle`}` })),
      },
    };
  }),
}));

mock.module(join(srcRoot, "src/core/ghq"), () => ({
  ghqList: async () => ghqRepos,
  ghqListSync: () => ghqRepos,
}));

mock.module(join(srcRoot, "src/core/fleet/worktrees-scan"), () => ({
  scanWorktrees: async () => worktrees,
}));

const impl = await import("../../src/commands/plugins/tmux/impl");
const {
  _sendTracker,
  cmdTmuxKill,
  cmdTmuxLayout,
  cmdTmuxLs,
  cmdTmuxPeek,
  cmdTmuxSend,
  cmdTmuxSplit,
  resolveTmuxTarget,
} = impl;

const original = {
  log: console.log,
  warn: console.warn,
  exit: process.exit,
  spawnSync: Bun.spawnSync,
  tmux: process.env.TMUX,
  dateNow: Date.now,
  tty: impl._tty.isStdoutTTY,
};

async function capture(fn: () => void | Promise<void>) {
  const logs: string[] = [];
  const warnings: string[] = [];
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
  }
  return { logs: logs.join("\n"), warnings: warnings.join("\n") };
}

beforeEach(() => {
  hostCalls = [];
  hostFailures = new Map();
  hostResponses = new Map();
  panes = [];
  fleetFiles = [];
  fleetWindows = {};
  ghqRepos = [];
  worktrees = [];
  _sendTracker.clear();
  delete process.env.TMUX;
  Date.now = original.dateNow;
  (Bun as any).spawnSync = (args: unknown[]) => {
    if (Array.isArray(args) && args[0] === "tmux" && args[1] === "list-sessions") {
      return { exitCode: 0, stdout: new TextEncoder().encode(""), stderr: new Uint8Array(), success: true };
    }
    return { exitCode: 0, stdout: new Uint8Array(), stderr: new Uint8Array(), success: true };
  };
});

afterEach(() => {
  console.log = original.log;
  console.warn = original.warn;
  (process as any).exit = original.exit;
  (Bun as any).spawnSync = original.spawnSync;
  Date.now = original.dateNow;
  impl._tty.isStdoutTTY = original.tty;
  if (original.tmux === undefined) delete process.env.TMUX;
  else process.env.TMUX = original.tmux;
});

describe("tmux impl extra coverage", () => {
  test("resolveTmuxTarget accepts unique same-word numbered fleet shorthand (#1794)", () => {
    fleetFiles = ["20-homekeeper.json"];
    expect(resolveTmuxTarget("homeke")).toEqual({
      resolved: "20-homekeeper",
      source: "fleet-stem (20-homekeeper)",
    });

    fleetFiles = ["114-mawjs-no2.json"];
    expect(resolveTmuxTarget("mawjs")).toEqual({
      resolved: "mawjs",
      source: "session-name",
    });
  });


  test("resolveTmuxTarget resolves fleet window aliases for role-suffixed sessions", () => {
    fleetFiles = ["23-discord-admin.json", "114-mawjs-no2.json"];
    fleetWindows = {
      "23-discord-admin.json": ["discord-oracle"],
      "114-mawjs-no2.json": ["mawjs-no2"],
    };

    expect(resolveTmuxTarget("discord-oracle")).toEqual({
      resolved: "23-discord-admin",
      source: "fleet-window (23-discord-admin)",
    });
    expect(resolveTmuxTarget("discord")).toEqual({
      resolved: "23-discord-admin",
      source: "fleet-window (23-discord-admin)",
    });
    expect(resolveTmuxTarget("mawjs")).toEqual({
      resolved: "mawjs",
      source: "session-name",
    });
  });

  test("resolveTmuxTarget accepts unique same-word live-session shorthand (#1794)", () => {
    (Bun as any).spawnSync = (args: unknown[]) => {
      if (Array.isArray(args) && args[0] === "tmux" && args[1] === "list-sessions") {
        return {
          exitCode: 0,
          stdout: new TextEncoder().encode("20-homekeeper\n"),
          stderr: new Uint8Array(),
          success: true,
        };
      }
      return { exitCode: 0, stdout: new Uint8Array(), stderr: new Uint8Array(), success: true };
    };

    expect(resolveTmuxTarget("homeke")).toEqual({
      resolved: "20-homekeeper",
      source: "live-session (20-homekeeper)",
    });
  });

  test("ls reports empty current-session and all-session states", async () => {
    const current = await capture(() => cmdTmuxLs());
    expect(current.logs).toContain("No panes in current session '(none)'");

    const all = await capture(() => cmdTmuxLs({ all: true }));
    expect(all.logs).toContain("No panes found");
  });

  test("compact ls renders stale status, worktrees, roster sleeping summary, and current-session filtering", async () => {
    process.env.TMUX = "/tmp/tmux,1,0";
    const now = Math.floor(Date.now() / 1000);
    panes = [
      { id: "%1", target: "current-session:0.0", command: "node", title: "agent", lastActivity: now - 400 },
      { id: "%2", target: "other-session:0.0", command: "zsh", title: "other", lastActivity: now },
    ];
    worktrees = [
      { mainRepo: "/opt/Code/current-session", name: "current-session.wt-1-scout", status: "active" },
      { mainRepo: "/opt/Code/current-session", name: "current-session.wt-2-old", status: "stale" },
    ];
    ghqRepos = [
      "/opt/Code/github.com/Soul-Brews-Studio/current-session-oracle",
      "/opt/Code/github.com/Soul-Brews-Studio/sleepy-oracle",
    ];

    const { logs } = await capture(() => cmdTmuxLs({ compact: true, roster: true }));

    expect(logs).toContain("current-session");
    expect(logs).not.toContain("other-session");
    expect(logs).toContain("current-session.wt-1-scout");
    expect(logs).toContain("worktree");
    expect(logs).toContain("current-session.wt-2-old");
    expect(logs).toContain("stale");
    expect(logs).toContain("sleepy-oracle");
    expect(logs).toContain("sleeping");
  });

  test("peek wraps capture-pane failures with target source", async () => {
    hostFailures.set("capture-pane", new Error("pane gone"));

    await expect(cmdTmuxPeek("%9")).rejects.toThrow("tmux capture-pane failed for '%9' (from pane-id): pane gone");
  });

  test("send validates command, destructive commands, pane lookup failures, quota, and send failures", async () => {
    await expect(cmdTmuxSend("%9", "")).rejects.toThrow("usage: maw tmux send");
    await expect(cmdTmuxSend("%9", "rm -rf /tmp/nope")).rejects.toThrow("refusing to send: command matches destructive patterns");
    _sendTracker.clear();

    hostFailures.set("pane_current_command", new Error("no pane"));
    await expect(cmdTmuxSend("%9", "echo hi")).rejects.toThrow("pane lookup failed for '%9' (from pane-id): no pane");
    hostFailures.clear();
    _sendTracker.clear();

    Date.now = () => 1_000_000;
    _sendTracker.set("%9", { lastTs: 1_000_000 - 1000, count: 100, windowStart: 1_000_000 - 10_000 });
    const quota = await capture(() => cmdTmuxSend("%9", "echo quota"));
    expect(quota.warnings).toContain("quota (100/min)");
    expect(hostCalls.filter(c => c.includes("send-keys"))).toEqual([]);

    _sendTracker.clear();
    hostFailures.set("send-keys", new Error("send failed"));
    await expect(cmdTmuxSend("%9", "echo hi", { force: true })).rejects.toThrow("send-keys failed for '%9': send failed");
  });

  test("expired send quota window resets and allows sending", async () => {
    Date.now = () => 2_000_000;
    _sendTracker.set("%9", { lastTs: 2_000_000 - 5_000, count: 100, windowStart: 2_000_000 - 70_000 });

    await capture(() => cmdTmuxSend("%9", "echo reset"));

    expect(_sendTracker.get("%9")).toMatchObject({ count: 1, windowStart: 2_000_000 });
    expect(hostCalls.at(-1)).toBe("tmux send-keys -t '%9' 'echo reset' Enter");
  });

  test("split and layout wrap hostExec failures", async () => {
    hostFailures.set("split-window", new Error("split denied"));
    await expect(cmdTmuxSplit("%9")).rejects.toThrow("split-window failed for '%9' (from pane-id): split denied");

    hostFailures.clear();
    hostFailures.set("select-layout", new Error("layout denied"));
    await expect(cmdTmuxLayout("demo:1.2", "tiled")).rejects.toThrow("select-layout failed for 'demo:1' (from session:w.p): layout denied");
  });

  test("kill resolves pane aliases, reports ambiguous aliases, and wraps kill failures", async () => {
    hostResponses.set("list-panes -a -F", "%101|||scratch:0.0|||worker|||tile-a|||/tmp/repo.wt-1-scout\n");
    const ok = await capture(() => cmdTmuxKill("scout"));
    expect(hostCalls).toContain("tmux kill-pane -t '%101'");
    expect(ok.logs).toContain("worktree-role (scout)");

    hostCalls = [];
    hostResponses.set("list-panes -a -F", "%101|||scratch:0.0|||dup|||role|||/tmp/a\n%102|||other:0.0|||dup|||role|||/tmp/b\n");
    await expect(cmdTmuxKill("dup")).rejects.toThrow("'dup' is ambiguous — matches 2 panes");
    expect(hostCalls.some(c => c.includes("kill-pane"))).toBe(false);

    hostCalls = [];
    hostResponses.set("list-panes -a -F", "%101|||scratch:0.0|||worker|||tile-a|||/tmp/repo.wt-1-scout\n");
    hostFailures.set("kill-pane", new Error("kill denied"));
    await expect(cmdTmuxKill("scout")).rejects.toThrow("kill failed for '%101' (from worktree-role (scout)): kill denied");
  });

  test("attach recovery auto-selects a single similar oracle candidate", () => {
    ghqRepos = ["/opt/Code/github.com/Soul-Brews-Studio/pulse-oracle"];
    impl._tty.isStdoutTTY = () => false;
    const logs: string[] = [];
    const exits: number[] = [];
    const spawnCalls: unknown[] = [];
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    (process as any).exit = (code?: number) => { exits.push(code ?? 0); throw new Error(`exit:${code ?? 0}`); };
    (Bun as any).spawnSync = (args: unknown[], opts?: unknown) => {
      if (Array.isArray(args) && args[0] === "tmux" && args[1] === "list-sessions") {
        return { exitCode: 0, stdout: new TextEncoder().encode(""), stderr: new Uint8Array(), success: true };
      }
      spawnCalls.push({ args, opts });
      return { exitCode: 7, stdout: new Uint8Array(), stderr: new Uint8Array(), success: false };
    };

    expect(() => impl.cmdTmuxAttach("pulse")).toThrow("exit:7");

    expect(logs.join("\n")).toContain("auto-selecting");
    expect(spawnCalls).toEqual([{ args: ["maw", "wake", "Soul-Brews-Studio/pulse-oracle", "-a"], opts: { stdio: ["inherit", "inherit", "inherit"] } }]);
    expect(exits).toEqual([7]);
  });
});
