import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tempDirs: string[] = [];
const originalProjectsDir = process.env.MAW_CLAUDE_PROJECTS_DIR;
const originalSkipPidScan = process.env.MAW_CLAUDE_SKIP_PID_SCAN;

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mawclaudesessions"));
  tempDirs.push(dir);
  return dir;
}

function encodeProjectPath(path: string): string {
  return path.replace(/^\//, "-").replace(/[/.]/g, "-");
}

async function freshModule(): Promise<typeof import("../src/core/fleet/claude-sessions")> {
  return import(`../src/core/fleet/claude-sessions.ts?test=${Date.now()}-${Math.random()}`);
}

afterEach(() => {
  if (originalProjectsDir === undefined) delete process.env.MAW_CLAUDE_PROJECTS_DIR;
  else process.env.MAW_CLAUDE_PROJECTS_DIR = originalProjectsDir;
  if (originalSkipPidScan === undefined) delete process.env.MAW_CLAUDE_SKIP_PID_SCAN;
  else process.env.MAW_CLAUDE_SKIP_PID_SCAN = originalSkipPidScan;
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("Claude Code session discovery", () => {
  test("decodeProjectDir reverses Claude's dash path encoding and leaves plain names alone", async () => {
    const { decodeProjectDir } = await freshModule();

    expect(decodeProjectDir("-opt-Code-repo")).toBe("/opt/Code/repo");
    expect(decodeProjectDir("plain-name")).toBe("plain-name");
  });

  test("listClaudeSessions reads recent JSONL sessions from HOME without exposing old or subagent files", async () => {
    const home = tempDir();
    const projectsRoot = join(home, ".claude", "projects");
    process.env.MAW_CLAUDE_PROJECTS_DIR = projectsRoot;
    process.env.MAW_CLAUDE_SKIP_PID_SCAN = "1";
    const projectPath = join(home, "projects", "mawrepo");
    mkdirSync(projectPath, { recursive: true });

    const encoded = encodeProjectPath(projectPath);
    const claudeProjectDir = join(projectsRoot, encoded);
    mkdirSync(claudeProjectDir, { recursive: true });

    const freshSession = join(claudeProjectDir, "session-1.jsonl");
    writeFileSync(freshSession, [
      JSON.stringify({ type: "user", message: { content: "hello from user" } }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hello from assistant" }] } }),
      "{bad json",
    ].join("\n"));

    const oldSession = join(claudeProjectDir, "old-session.jsonl");
    writeFileSync(oldSession, JSON.stringify({ type: "user", message: { content: "too old" } }));
    const old = new Date(Date.now() - 2 * 86_400_000);
    utimesSync(oldSession, old, old);

    writeFileSync(
      join(claudeProjectDir, "session-1-subagents.jsonl"),
      JSON.stringify({ type: "user", message: { content: "subagent" } }),
    );

    const { listClaudeSessions } = await freshModule();
    const sessions = await listClaudeSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: "session-1",
      projectPath,
      repo: null,
      worktree: null,
      pid: null,
      ppid: null,
      parentChain: [],
      tmuxTarget: null,
      triggeredFrom: "unknown",
      status: "ended",
      lastUserMessage: "hello from user",
      lastAssistantMessage: "hello from assistant",
    });
    expect(sessions[0].sizeBytes).toBeGreaterThan(0);
    expect(Date.parse(sessions[0].lastActivityAt)).not.toBeNaN();
  });

  test("listClaudeSessions returns [] when the Claude projects directory is absent", async () => {
    const home = tempDir();
    process.env.MAW_CLAUDE_PROJECTS_DIR = join(home, ".claude", "projects");
    process.env.MAW_CLAUDE_SKIP_PID_SCAN = "1";
    const { listClaudeSessions } = await freshModule();

    await expect(listClaudeSessions()).resolves.toEqual([]);
  });
});
