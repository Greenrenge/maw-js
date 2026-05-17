/** Extra isolated coverage for src/vendor/mpr-plugins/doctor/impl.ts install/smoke paths. */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as realChildProcess from "child_process";
import * as realFs from "fs";
import { join } from "path";

const C = { green: "", red: "", yellow: "", gray: "", reset: "" };
const HOME = "/tmp/doctor-impl-second-pass-home";
const BIN = `${HOME}/.bun/bin/maw`;
const PLUGINS_DIR = `${HOME}/.maw/plugins`;

type FsMode =
  | "healthy"
  | "missing-bin"
  | "broken-link"
  | "smoke-broken"
  | "smoke-clean"
  | "smoke-read-error";

let logs: string[] = [];
let execCalls: string[] = [];
let fsMode: FsMode = "healthy";
let bunLinkCheckout: string | null = null;
let spawnCalls: string[][] = [];

const originalLog = console.log;
const originalSpawn = Bun.spawn;

function fakeProc(code: number, stdout = "", stderr = "") {
  return {
    exited: Promise.resolve(code),
    stdout: new Response(stdout).body,
    stderr: new Response(stderr).body,
  } as unknown as ReturnType<typeof Bun.spawn>;
}

mock.module("os", () => ({ homedir: () => HOME }));

mock.module("child_process", () => ({
  ...realChildProcess,
  execSync: (cmd: string) => {
    execCalls.push(cmd);
    if (cmd.includes("bun add -g github:Soul-Brews-Studio/maw-js")) {
      return "";
    }
    throw new Error(`unexpected execSync: ${cmd}`);
  },
}));

mock.module("fs", () => ({
  ...realFs,
  existsSync: (path: string) => {
    if (path === BIN) return fsMode !== "missing-bin";
    if (path === "/broken/target") return false;
    if (path === "/linked/real/maw") return true;
    if (path.startsWith(`${PLUGINS_DIR}/`)) {
      const entry = path.slice(PLUGINS_DIR.length + 1);
      if (entry === "broken") return false;
      return true;
    }
    return true;
  },
  readFileSync: () => JSON.stringify({ version: "0.0.0-test" }),
  readlinkSync: (path: string) => {
    if (path !== BIN) throw new Error(`unexpected readlinkSync: ${path}`);
    if (fsMode === "broken-link") return "/broken/target";
    if (fsMode === "healthy") return "/linked/real/maw";
    throw new Error("not a symlink");
  },
  readdirSync: (dir: string) => {
    if (dir !== PLUGINS_DIR) throw new Error(`unexpected readdirSync: ${dir}`);
    if (fsMode === "smoke-read-error") throw new Error("plugins dir unreadable");
    if (fsMode === "smoke-clean") return ["good", "plain"];
    if (fsMode === "smoke-broken") return ["good", "broken", "plain"];
    return [];
  },
  lstatSync: (path: string) => ({
    isSymbolicLink: () => path.endsWith("/good") || path.endsWith("/broken"),
  }),
}));

mock.module("maw-js/commands/shared/fleet-doctor-fixer", () => ({ C }));
mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/bun-link-detect"), () => ({
  detectBunLinkedCheckout: () => bunLinkCheckout,
}));
mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/stale-peers"), () => ({
  checkStalePeers: () => ({ name: "peers:stale", ok: true, message: "no stale peers" }),
  cmdFixStalePeers: async () => ({ ok: true, checks: [{ name: "peers:fix-stale", ok: true, message: "removed 0 stale peers" }] }),
}));
mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/maw-js-branch-check"), () => ({
  checkMawJsBranch: async () => ({ name: "maw-js:branch", ok: true, message: "on alpha" }),
}));
mock.module(import.meta.resolve("../../src/vendor/mpr-plugins/doctor/internal/stillborn-worktrees"), () => ({
  checkStillbornWorktrees: () => ({ name: "worktrees:stillborn", ok: true, message: "no .wt-* directories found" }),
}));

const { cmdDoctor } = await import("../../src/vendor/mpr-plugins/doctor/impl.ts?doctor-impl-second-pass-coverage");

beforeEach(() => {
  logs = [];
  execCalls = [];
  spawnCalls = [];
  fsMode = "healthy";
  bunLinkCheckout = null;
  realFs.rmSync(HOME, { recursive: true, force: true });
  realFs.mkdirSync(PLUGINS_DIR, { recursive: true });
  console.log = (line?: unknown) => {
    logs.push(String(line ?? ""));
  };
  (Bun as unknown as { spawn: typeof Bun.spawn }).spawn = ((cmd: string[]) => {
    spawnCalls.push(cmd);
    const label = cmd.slice(1).join(" ");
    if (label === "ls") return fakeProc(0, "one\ntwo\n");
    if (label === "oracle ls --json") return fakeProc(1, "", "oracle ls boom\ntrace");
    if (label === "oracle search maw") return fakeProc(0, "search ok\n");
    if (label === "--version") return fakeProc(0, "1.2.3\n");
    if (label === "fleet ls") return fakeProc(0, "fleet\n");
    throw new Error(`unexpected Bun.spawn: ${label}`);
  }) as typeof Bun.spawn;
});

afterEach(() => {
  console.log = originalLog;
  (Bun as unknown as { spawn: typeof Bun.spawn }).spawn = originalSpawn;
});

describe("doctor impl second-pass coverage", () => {
  test("install check prefers bun-link recovery guidance when the global maw binary is missing", async () => {
    fsMode = "missing-bin";
    bunLinkCheckout = "/repo/dev/maw-js";

    const result = await cmdDoctor(["install"]);

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual([
      {
        name: "install",
        ok: false,
        message: "dev bun-link at /repo/dev/maw-js — run bun link to restore",
      },
    ]);
    expect(execCalls).toEqual([]);
    expect(logs.join("\n")).toContain("maw binary missing");
    expect(logs.join("\n")).toContain("run: cd /repo/dev/maw-js && bun link");
  });

  test("install check reports a broken maw symlink target", async () => {
    fsMode = "broken-link";

    const result = await cmdDoctor(["install"]);

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual([
      {
        name: "install",
        ok: false,
        message: "binary is a broken symlink → /broken/target",
      },
    ]);
    expect(execCalls).toEqual([]);
  });

  test("smoke suite reports command failures, broken plugin symlinks, and summary counts", async () => {
    realFs.writeFileSync(join(HOME, "good-target"), "ok");
    realFs.symlinkSync(join(HOME, "good-target"), join(PLUGINS_DIR, "good"));
    realFs.symlinkSync(join(HOME, "missing-target"), join(PLUGINS_DIR, "broken"));
    realFs.writeFileSync(join(PLUGINS_DIR, "plain"), "plain");

    const result = await cmdDoctor(["--smoke"]);

    expect(result.ok).toBe(false);
    expect(result.checks.map(c => c.name)).toEqual([
      "smoke:ls",
      "smoke:oracle ls",
      "smoke:oracle search",
      "smoke:--version",
      "smoke:fleet ls",
      "smoke:plugins",
      "smoke:symlinks",
    ]);
    expect(result.checks[0]).toEqual({ name: "smoke:ls", ok: true, message: "exit 0 (2 lines)" });
    expect(result.checks[1]).toEqual({ name: "smoke:oracle ls", ok: false, message: "oracle ls boom" });
    expect(result.checks[5]).toEqual({ name: "smoke:plugins", ok: false, message: `1 broken symlink in ${PLUGINS_DIR}` });
    expect(result.checks[6]).toEqual({ name: "smoke:symlinks", ok: false, message: "broken: broken" });
    expect(spawnCalls).toHaveLength(5);
    expect(logs.join("\n")).toContain("4/7 passed");
  });
});
