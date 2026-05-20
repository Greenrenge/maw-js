import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let sessions = new Set<string>();
let newSessionCalls: Array<{ name: string; opts: any }> = [];
let attached: string[] = [];

mock.module(join(import.meta.dir, "../../src/sdk"), () => ({
  tmux: {
    hasSession: async (name: string) => sessions.has(name),
    newSession: async (name: string, opts: any = {}) => {
      sessions.add(name);
      newSessionCalls.push({ name, opts });
    },
  },
}));

mock.module(join(import.meta.dir, "../../src/commands/shared/wake-session"), () => ({
  attachToSession: async (name: string) => { attached.push(name); },
}));

const { cmdNew, decideNewWorkspaceAttach, isTruthyEnv, validateWorkspaceSessionName } = await import("../../src/cli/cmd-new");

beforeEach(() => {
  sessions = new Set<string>();
  newSessionCalls = [];
  attached = [];
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

  test("reuses an existing workspace session and can attach", async () => {
    sessions.add("my-project");

    await cmdNew(["my-project", "--attach"]);

    expect(newSessionCalls).toEqual([]);
    expect(attached).toEqual(["my-project"]);
  });
});
