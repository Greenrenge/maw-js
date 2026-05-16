import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  pidFile,
  printServeStatus,
  printServeStatusWithPlugins,
  serveStatus,
  stopServe,
} from "../src/cli/instance-pid";

const originalHome = process.env.MAW_HOME;
const originalEngineUrl = process.env.MAW_ENGINE_URL;
const originalLog = console.log;
let tempHome = "";
let lines: string[] = [];

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "maw-instance-pid-default-"));
  process.env.MAW_HOME = tempHome;
  delete process.env.MAW_ENGINE_URL;
  lines = [];
  console.log = (...args: unknown[]) => { lines.push(args.join(" ")); };
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.MAW_HOME;
  else process.env.MAW_HOME = originalHome;
  if (originalEngineUrl === undefined) delete process.env.MAW_ENGINE_URL;
  else process.env.MAW_ENGINE_URL = originalEngineUrl;
  console.log = originalLog;
  rmSync(tempHome, { recursive: true, force: true });
});

describe("maw serve PID status helpers in the default suite", () => {
  test("pidFile resolves under MAW_HOME", () => {
    expect(pidFile()).toBe(join(tempHome, "maw.pid"));
  });

  test("serveStatus removes stale pid files", () => {
    writeFileSync(pidFile(), "99999999");

    expect(serveStatus()).toEqual({ pid: 99999999, alive: false, file: pidFile() });
    expect(existsSync(pidFile())).toBe(false);
    expect(serveStatus()).toEqual({ pid: null, alive: false, file: pidFile() });
  });

  test("printServeStatus renders stopped and running states", () => {
    printServeStatus();
    expect(lines.at(-1)).toBe(`maw serve: stopped (${pidFile()})`);

    writeFileSync(pidFile(), String(process.pid));
    printServeStatus();
    expect(lines.at(-1)).toContain(`maw serve: running (PID ${process.pid}`);
  });

  test("stopServe is a no-op with a clear message when no PID exists", () => {
    stopServe();

    expect(lines).toEqual(["maw serve: already stopped"]);
  });

  test("printServeStatusWithPlugins reports registered engine plugins for a live serve", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/api/_engine/registrations") {
          return Response.json({
            registrations: [{
              plugin: "ledger",
              prefix: "/api/ledger",
              upstream: "unix:///tmp/maw-ledger.sock",
              health: "/health",
              events: ["MessageSend", "MessageDeliver"],
            }],
          });
        }
        return Response.json({ ok: false }, { status: 404 });
      },
    });
    writeFileSync(pidFile(), String(process.pid));

    try {
      await printServeStatusWithPlugins(`http://127.0.0.1:${server.port}`);
    } finally {
      server.stop(true);
    }

    const output = lines.join("\n");
    expect(output).toContain(`maw serve: running (PID ${process.pid}`);
    expect(output).toContain("engine plugins (http://127.0.0.1:");
    expect(output).toContain("ledger: /api/ledger → unix:///tmp/maw-ledger.sock health=/health events=MessageSend,MessageDeliver");
  });

  test("printServeStatusWithPlugins reports unavailable and empty plugin registries", async () => {
    writeFileSync(pidFile(), String(process.pid));
    await printServeStatusWithPlugins("http://127.0.0.1:1");
    expect(lines.join("\n")).toContain("engine plugins: unavailable");

    lines = [];
    const server = Bun.serve({
      port: 0,
      fetch() { return Response.json({ registrations: [] }); },
    });
    try {
      await printServeStatusWithPlugins(`http://127.0.0.1:${server.port}`);
    } finally {
      server.stop(true);
    }

    expect(lines.join("\n")).toContain("engine plugins: none");
  });
});
