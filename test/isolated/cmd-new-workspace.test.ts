import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let sessions = new Set<string>();
let newSessionCalls: Array<{ name: string; opts: any }> = [];
let attached: string[] = [];
let firstPaneIds = new Map<string, string>();
let commandForClaude = "claude --model sonnet";

mock.module(join(import.meta.dir, "../../src/sdk"), () => ({
  tmux: {
    hasSession: async (name: string) => sessions.has(name),
    newSession: async (name: string, opts: any = {}) => {
      sessions.add(name);
      newSessionCalls.push({ name, opts });
      return opts.printFormat ? "%99\n" : "";
    },
    firstPaneId: async (target: string) => firstPaneIds.get(target),
  },
}));

mock.module(join(import.meta.dir, "../../src/commands/shared/wake-session"), () => ({
  attachToSession: async (name: string) => { attached.push(name); },
}));

mock.module(join(import.meta.dir, "../../src/config"), () => ({
  buildCommandInDir: (_name: string, _cwd: string, engine?: string) => {
    if (engine === "claude") return commandForClaude;
    return "not-claude";
  },
}));

const { cmdNew, decideNewWorkspaceAttach, isTruthyEnv, validateWorkspaceSessionName } = await import("../../src/cli/cmd-new");

beforeEach(() => {
  sessions = new Set<string>();
  newSessionCalls = [];
  attached = [];
  firstPaneIds = new Map<string, string>();
  commandForClaude = "claude --model sonnet";
});

describe("cmdNew workspace session factory", () => {
  test("pure helpers cover env truthiness, attach decisions, and reserved names", () => {
    expect(isTruthyEnv(undefined)).toBe(false);
    expect(isTruthyEnv("YES")).toBe(true);
    expect(isTruthyEnv("off")).toBe(false);
    expect(decideNewWorkspaceAttach({
      attach: false,
      noAttach: false,
      envNoPrompt: false,
      stdinIsTTY: true,
      stdoutIsTTY: true,
    })).toEqual({ action: "attach", reason: "interactive-tty" });
    expect(decideNewWorkspaceAttach({
      attach: true,
      noAttach: true,
      envNoPrompt: false,
      stdinIsTTY: true,
      stdoutIsTTY: true,
    })).toEqual({ action: "skip", reason: "no-attach-flag" });
    expect(() => validateWorkspaceSessionName("bad name")).toThrow("invalid session name");
    expect(() => validateWorkspaceSessionName("maw-view")).toThrow("reserved");
  });

  test("usage errors print help for missing, help, and flag-shaped session names", async () => {
    const errors: string[] = [];
    const errSpy = spyOn(console, "error").mockImplementation((line: string) => {
      errors.push(String(line));
    });
    try {
      await expect(cmdNew([])).rejects.toThrow("missing session name");
      await expect(cmdNew(["--help"])).rejects.toThrow("missing session name");
      await expect(cmdNew(["--bad"])).rejects.toThrow("invalid session name");
    } finally {
      errSpy.mockRestore();
    }
    expect(errors.filter((line) => line.startsWith("usage: maw new"))).toHaveLength(3);
    expect(newSessionCalls).toEqual([]);
    expect(attached).toEqual([]);
  });

  test("creates a detached tmux session with a lead shell window", async () => {
    await cmdNew(["my-project", "--no-attach"]);

    expect(newSessionCalls).toEqual([
      { name: "my-project", opts: { window: "lead", cwd: process.cwd() } },
    ]);
    expect(attached).toEqual([]);
  });

  test("starts the lead shell in --path and runs --cmd while staying maw-ls visible", async () => {
    const dir = mkdtempSync(join(tmpdir(), "maw-new-"));
    try {
      await cmdNew(["dev", "-p", dir, "-c", "bun dev", "--shell", "--no-attach"]);

      expect(newSessionCalls).toEqual([
        {
          name: "dev",
          opts: {
            window: "lead",
            cwd: dir,
            command: `bun dev; exec ${process.env.SHELL || "zsh"}`,
          },
        },
      ]);
      expect(sessions.has("dev")).toBe(true);
      expect(attached).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects invalid launch context before creating a session", async () => {
    const dir = mkdtempSync(join(tmpdir(), "maw-new-"));
    const file = join(dir, "not-a-directory");
    writeFileSync(file, "x");
    try {
      await expect(cmdNew(["missing-path", "--path", join(dir, "missing"), "--no-attach"]))
        .rejects.toThrow("path does not exist");
      await expect(cmdNew(["file-path", "--path", file, "--no-attach"]))
        .rejects.toThrow("path is not a directory");
      await expect(cmdNew(["empty-cmd", "--cmd", "", "--no-attach"]))
        .rejects.toThrow("--cmd cannot be empty");

      expect(newSessionCalls).toEqual([]);
      expect(attached).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--claude fills a configured Claude Code command with team env", async () => {
    const dir = mkdtempSync(join(tmpdir(), "maw-new-"));
    commandForClaude = "/Applications/Claude/claude.exe --model opus";
    try {
      await cmdNew(["claude-dev", "--path", dir, "--claude", "--print", "--no-attach"]);

      const command = "env CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 /Applications/Claude/claude.exe --model opus";
      expect(newSessionCalls).toEqual([
        {
          name: "claude-dev",
          opts: {
            window: "lead",
            cwd: dir,
            command: `${command}; exec ${process.env.SHELL || "zsh"}`,
            printFormat: "#{pane_id}",
          },
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects conflicting --claude and --cmd flags", async () => {
    await expect(cmdNew(["conflict", "--claude", "--cmd", "bun dev", "--no-attach"]))
      .rejects.toThrow("either --claude or --cmd");
    expect(newSessionCalls).toEqual([]);
  });

  test("prints machine-readable payloads for new and existing lead panes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "maw-new-"));
    const lines: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    try {
      await cmdNew(["script", "--path", dir, "--cmd", "bun test", "--print", "--no-attach"]);

      expect(newSessionCalls).toEqual([
        {
          name: "script",
          opts: {
            window: "lead",
            cwd: dir,
            command: `bun test; exec ${process.env.SHELL || "zsh"}`,
            printFormat: "#{pane_id}",
          },
        },
      ]);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toEqual({
        session: "script",
        window: "lead",
        pane_id: "%99",
        cwd: dir,
        command: "bun test",
        reused: false,
      });

      lines.length = 0;
      newSessionCalls = [];
      sessions.add("script");
      firstPaneIds.set("script:lead", "%42");
      await cmdNew(["script", "--path", dir, "--json", "--no-attach"]);
      expect(newSessionCalls).toEqual([]);
      expect(JSON.parse(lines[0])).toEqual({
        session: "script",
        window: "lead",
        pane_id: "%42",
        cwd: dir,
        reused: true,
      });
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reuses an existing workspace session and can attach", async () => {
    sessions.add("my-project");

    await cmdNew(["my-project", "--attach"]);

    expect(newSessionCalls).toEqual([]);
    expect(attached).toEqual(["my-project"]);
  });
});
