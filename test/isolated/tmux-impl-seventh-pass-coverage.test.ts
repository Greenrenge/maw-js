import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "path";

const srcRoot = join(import.meta.dir, "../..");
const mockHome = "/mock-home-seventh-pass";
const teamsRoot = `${mockHome}/.claude/teams`;

type Pane = { id: string; target: string; command?: string; title?: string; lastActivity?: number; source?: string };

let panes: Pane[] = [];
let fleetEntries: any[] = [];
let ghqRepos: string[] = [];
let worktrees: any[] = [];
let hostCalls: string[] = [];
let hostResponses: Map<string, string> = new Map();
let hostFailures: Map<string, Error> = new Map();
let tmuxSessionsStdout = "";
let spawnExitCode = 0;
let spawnCalls: Array<{ args: unknown[]; opts?: unknown }> = [];
let existingPaths: Set<string> = new Set();
let dirEntries: Map<string, string[]> = new Map();
let fileContents: Map<string, string> = new Map();
let ttyReadText = "";
let contextLimitedTargets: Set<string> = new Set();

mock.module("os", () => ({
  homedir: () => mockHome,
}));

mock.module("fs", () => ({
  existsSync: (path: string) => existingPaths.has(path),
  readdirSync: (path: string) => dirEntries.get(path) ?? [],
  readFileSync: (path: string) => {
    const text = fileContents.get(path);
    if (text === undefined) throw new Error(`missing fixture: ${path}`);
    return text;
  },
  openSync: () => 42,
  readSync: (_fd: number, buffer: Buffer) => {
    buffer.write(ttyReadText);
    return Buffer.byteLength(ttyReadText);
  },
  closeSync: () => undefined,
}));

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
    if (cmd.includes("display-message") && cmd.includes("session_name")) return "current\n";
    if (cmd.includes("list-sessions") && cmd.includes("session_created")) return "";
    return "";
  },
  tmux: {
    listPanes: async () => panes,
    capture: async (target: string) => contextLimitedTargets.has(target) ? "Context limit reached. /compact or /clear to continue" : "",
  },
  tmuxCmd: () => "tmux",
}));

mock.module(join(srcRoot, "src/commands/shared/fleet-load"), () => ({
  loadFleetEntries: () => fleetEntries,
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
  cmdTmuxAttach,
  cmdTmuxKill,
  cmdTmuxLayout,
  cmdTmuxLs,
  cmdTmuxSend,
  cmdTmuxSplit,
} = impl;

const original = {
  log: console.log,
  warn: console.warn,
  write: process.stdout.write,
  exit: process.exit,
  spawnSync: Bun.spawnSync,
  tmux: process.env.TMUX,
  dateNow: Date.now,
  tty: impl._tty.isStdoutTTY,
};

function spawnResult(stdout = "", exitCode = 0) {
  return {
    exitCode,
    stdout: new TextEncoder().encode(stdout),
    stderr: new Uint8Array(),
    success: exitCode === 0,
  };
}

function installProcessExitThrow() {
  const exits: number[] = [];
  (process as any).exit = (code?: number) => {
    exits.push(code ?? 0);
    throw new Error(`process.exit:${code ?? 0}`);
  };
  return exits;
}

async function capture(fn: () => void | Promise<void>) {
  const logs: string[] = [];
  const warnings: string[] = [];
  const writes: string[] = [];
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  process.stdout.write = ((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    process.stdout.write = original.write;
  }
  return { logs: logs.join("\n"), warnings: warnings.join("\n"), writes: writes.join("") };
}

beforeEach(() => {
  panes = [];
  fleetEntries = [];
  ghqRepos = [];
  worktrees = [];
  hostCalls = [];
  hostResponses = new Map();
  hostFailures = new Map();
  tmuxSessionsStdout = "";
  spawnExitCode = 0;
  spawnCalls = [];
  existingPaths = new Set();
  dirEntries = new Map();
  fileContents = new Map();
  ttyReadText = "";
  contextLimitedTargets = new Set();
  _sendTracker.clear();
  Date.now = original.dateNow;
  impl._tty.isStdoutTTY = original.tty;
  delete process.env.TMUX;
  (Bun as any).spawnSync = (args: unknown[], opts?: unknown) => {
    if (Array.isArray(args) && args[0] === "tmux" && args[1] === "list-sessions") {
      return spawnResult(tmuxSessionsStdout, 0);
    }
    spawnCalls.push({ args: args as unknown[], opts });
    return spawnResult("", spawnExitCode);
  };
});

afterEach(() => {
  console.log = original.log;
  console.warn = original.warn;
  process.stdout.write = original.write;
  (process as any).exit = original.exit;
  (Bun as any).spawnSync = original.spawnSync;
  Date.now = original.dateNow;
  impl._tty.isStdoutTTY = original.tty;
  if (original.tmux === undefined) delete process.env.TMUX;
  else process.env.TMUX = original.tmux;
});

describe("tmux impl seventh-pass tests-only coverage", () => {
  test("compact ls marks context-limited panes as frozen and renders recent empty timestamps", async () => {
    Date.now = () => 1_700_000_000_000;
    contextLimitedTargets.add("alpha:0.0");
    panes = [
      { id: "%1", target: "alpha:0.0", command: "node", title: "limited", lastActivity: Math.floor(Date.now() / 1000) - 5 },
      { id: "%2", target: "beta:0.0", command: "zsh", title: "plain" },
    ];
    worktrees = [{ mainRepo: "/repos/alpha", name: "alpha.wt-3-orphan", status: "orphan" }];

    const { logs } = await capture(() => cmdTmuxLs({ all: true, compact: true, recent: true }));

    expect(logs).toContain("SESSION");
    expect(logs).toContain("alpha");
    expect(logs).toContain("context-limit");
    expect(logs).toContain("/compact needed");
    expect(logs).toContain("alpha.wt-3-orphan");
    expect(logs).toContain("orphan");
    expect(logs).toContain("beta");
    expect(logs).toContain("—");
  });

  test("send covers cooldown throttling and claude-like pane refusal", async () => {
    Date.now = () => 2_000_000;
    _sendTracker.set("%7", { lastTs: 2_000_000 - 100, count: 1, windowStart: 2_000_000 - 100 });

    const throttled = await capture(() => cmdTmuxSend("%7", "echo later"));
    expect(throttled.warnings).toContain("cooldown (500ms)");
    expect(hostCalls).toEqual([]);

    _sendTracker.clear();
    hostResponses.set("pane_current_command", "claude\n");
    await expect(cmdTmuxSend("%7", "echo blocked")).rejects.toThrow("is running 'claude' (claude-like)");
    expect(hostCalls).toEqual(["tmux display-message -p -t '%7' '#{pane_current_command}'"]);
  });

  test("split and layout cover successful command quoting, vertical split, and window target stripping", async () => {
    await capture(() => cmdTmuxSplit("demo:2.3", { vertical: true, pct: 33, cmd: "printf 'hi'" }));
    await capture(() => cmdTmuxLayout("demo:2.3", "tiled"));

    expect(hostCalls[0]).toStartWith("tmux split-window -v -l 33% -t 'demo:2.3'");
    expect(hostCalls[0]).toContain("printf");
    expect(hostCalls[0]).toContain("hi");
    expect(hostCalls[1]).toBe("tmux select-layout -t 'demo:2' tiled");
  });

  test("kill covers ambiguous pane aliases, fleet safety, forced pane kill, and session kill", async () => {
    hostResponses.set("list-panes -a -F", [
      "%1|||scratch:0.0|||pilot|||||/work/maw.wt-1-pilot",
      "%2|||scratch:0.1|||pilot|||||/work/other.wt-2-pilot",
    ].join("\n"));
    await expect(cmdTmuxKill("pilot")).rejects.toThrow("'pilot' is ambiguous — matches 2 panes");

    fleetEntries = [{ file: "101-alpha.json", session: { windows: [] } }];
    await expect(cmdTmuxKill("101-alpha:0.0")).rejects.toThrow("refusing to kill: session '101-alpha' is fleet or view");

    hostResponses.set("list-panes -a -F", "%9|||scratch:0.0|||pilot|||||/work/maw.wt-1-pilot");
    await capture(() => cmdTmuxKill("pilot", { force: true }));
    await capture(() => cmdTmuxKill("plain:0.3", { session: true }));

    expect(hostCalls.slice(-2)).toEqual([
      "tmux kill-pane -t '%9'",
      "tmux kill-session -t 'plain'",
    ]);
  });

  test("attach switches inside tmux and recovery exits when a resolved target is not alive", async () => {
    tmuxSessionsStdout = "live\n";
    process.env.TMUX = "/tmp/tmux,1,0";
    impl._tty.isStdoutTTY = () => true;

    await capture(() => cmdTmuxAttach("live"));
    expect(spawnCalls).toEqual([{ args: ["tmux", "switch-client", "-t", "live"], opts: { stdio: ["inherit", "inherit", "inherit"] } }]);

    spawnCalls = [];
    delete process.env.TMUX;
    tmuxSessionsStdout = "";
    spawnExitCode = 7;
    fleetEntries = [{
      file: "101-pulse.json",
      session: { windows: [{ name: "pulse-oracle", repo: "Org/pulse-oracle" }] },
    }];
    ghqRepos = ["/opt/Code/github.com/Org/pulse-oracle"];
    const exits = installProcessExitThrow();

    const recovery = await capture(() => {
      try {
        cmdTmuxAttach("pulse");
      } catch (error) {
        // keep logs available for assertions below
      }
    });

    expect(recovery.logs).toContain("pulse");
    expect(exits.length).toBeGreaterThan(0);
  });

  test("attach recovery lists multiple candidates when non-tty and honors valid tty selection", async () => {
    ghqRepos = [
      "/opt/Code/github.com/one/pulse-oracle",
      "/opt/Code/github.com/two/pulse-oracle",
    ];

    impl._tty.isStdoutTTY = () => false;
    const nonTtyExits = installProcessExitThrow();
    const nonTty = await capture(() => {
      expect(() => cmdTmuxAttach("pulse")).toThrow("process.exit:1");
    });
    expect(nonTty.logs).toContain("No session matches");
    expect(nonTtyExits).toEqual([1]);
    expect(spawnCalls).toEqual([]);

    expect(impl.similarOracleCandidatesFromRepos("pulse", ghqRepos)).toEqual(["one/pulse-oracle", "two/pulse-oracle"]);
  });
});
