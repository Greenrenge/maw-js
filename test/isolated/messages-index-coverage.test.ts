import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as realChild from "child_process";
import type { FeedEvent } from "../../src/lib/feed";
import { buildMessageLifecycleFeedEvent } from "../../src/lib/message-events";
import { messageLedgerDbPath } from "../../src/vendor/mpr-plugins/messages/ledger";

let tmpHome = "";
const savedHome = process.env.MAW_HOME;
const savedEngineUrl = process.env.MAW_ENGINE_URL;
const savedPort = process.env.MAW_PORT;
const savedMessagesPort = process.env.MAW_MESSAGES_PORT;
const savedFetch = global.fetch;
const savedKill = process.kill;
const savedArgv = [...process.argv];

const spawnPid: { value: number | null } = { value: 1234 };
let spawnShouldThrow = false;

function ensureEngineDir() {
  mkdirSync(join(tmpHome, "engine-plugins"), { recursive: true });
}

function writeMessagesPid(pid: number | string) {
  ensureEngineDir();
  writeFileSync(join(tmpHome, "engine-plugins", "messages.pid"), `${pid}\n`, "utf-8");
}

mock.module("child_process", () => ({
  ...realChild,
  spawn: () => {
    if (spawnShouldThrow) throw new Error("spawn failure");
    return {
      pid: spawnPid.value,
      unref: () => {},
    } as any;
  },
}));

const { default: messagesHandler, messagesEngineFetch, onEvent } = await import("../../src/vendor/mpr-plugins/messages/index");

function makeEngineStub(options: {
  registrations?: Array<Record<string, unknown>>;
  onRegister?: (body: Record<string, unknown>) => void;
  onUnregister?: () => void;
}) {
  let registrations = [...(options.registrations ?? [])];
  return Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/api/_engine/registrations") {
        return Response.json({ ok: true, registrations });
      }
      if (req.method === "POST" && url.pathname === "/api/_engine/register") {
        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        registrations = [body as Record<string, unknown>];
        options.onRegister?.(body as Record<string, unknown>);
        return Response.json({ ok: true, received: true });
      }
      if (req.method === "POST" && url.pathname === "/api/_engine/unregister") {
        registrations = [];
        options.onUnregister?.();
        return Response.json({ ok: true, removed: true });
      }
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    },
  });
}

function mockKillStateful(sequence: Array<"alive" | "dead" | "throw" | "ephem" | "sigterm-noop">) {
  let calls = 0;
  return (pid: number, signal?: string | number) => {
    const state = sequence[Math.min(calls, sequence.length - 1)] ?? "dead";
    calls++;

    if (signal === "SIGTERM" || signal === "SIGINT") {
      if (state === "sigterm-noop" || state === "dead") return true;
      if (state === "throw") throw new Error("sigterm blocked");
      if (state === "ephem") {
        const err: NodeJS.ErrnoException = new Error("permission") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }
    }

    if (signal === 0 || signal === undefined) {
      if (state === "alive") return true;
      if (state === "ephem") {
        const err: NodeJS.ErrnoException = new Error("permission") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }
      const err: NodeJS.ErrnoException = new Error("not found") as NodeJS.ErrnoException;
      err.code = "ESRCH";
      throw err;
    }

    return true;
  };
}

function resetSpawnMocks() {
  spawnShouldThrow = false;
  spawnPid.value = 1234;
}

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "maw-messages-slice-"));
  process.env.MAW_HOME = tmpHome;
  delete process.env.MAW_ENGINE_URL;
  delete process.env.MAW_PORT;
  delete process.env.MAW_MESSAGES_PORT;
  resetSpawnMocks();
  process.kill = savedKill as typeof process.kill;
  global.fetch = savedFetch;
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.MAW_HOME;
  else process.env.MAW_HOME = savedHome;
  if (savedEngineUrl === undefined) delete process.env.MAW_ENGINE_URL;
  else process.env.MAW_ENGINE_URL = savedEngineUrl;
  if (savedPort === undefined) delete process.env.MAW_PORT;
  else process.env.MAW_PORT = savedPort;
  if (savedMessagesPort === undefined) delete process.env.MAW_MESSAGES_PORT;
  else process.env.MAW_MESSAGES_PORT = savedMessagesPort;
  process.argv = [...savedArgv];
  global.fetch = savedFetch;
  process.kill = savedKill;
  rmSync(tmpHome, { force: true, recursive: true });
});

describe("messages plugin coverage slice", () => {
  test("handler defaults to text output, formats rows, errors, and last-line annotations", async () => {
    const outbound = buildMessageLifecycleFeedEvent({
      id: "a-1",
      ts: "2026-05-16T01:00:00.000Z",
      direction: "outbound",
      state: "delivered",
      channel: "hey",
      route: "local",
      from: "u/a",
      to: "u/b",
      text: "hello from outbound",
      signed: true,
    });

    const inbound = buildMessageLifecycleFeedEvent({
      id: "a-2",
      ts: "2026-05-16T01:01:00.000Z",
      direction: "inbound",
      state: "failed",
      channel: "hey",
      route: "local",
      from: "u/c",
      to: "u/d",
      text: "received text with many words that should be collapsed and then potentially truncated if very long to test formatter behavior",
      error: "agent timeout",
      lastLine: "all good once more",
      signed: false,
    });

    const weirdTs = {
      event: "MessageSend",
      oracle: "t",
      host: "h",
      data: {
        id: "a-3",
        ts: "not-a-ts",
        direction: "forwarded",
        state: "queued",
        channel: "api",
        route: "mesh",
        from: "u/e",
        to: "u/f",
        target: "agent/f",
        text: "quick ping",
        signed: true,
      },
    } as FeedEvent;

    await onEvent(outbound);
    await onEvent(inbound);
    await onEvent(weirdTs);

    const result = await messagesHandler({ source: "cli", args: [] });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("message ledger:");
    expect(result.output).toContain("inbound/local/failed");
    expect(result.output).toContain("agent timeout");
    expect(result.output).toContain("all good once more");
    expect(result.output).toContain("not-a-ts");
  });

  test("api invocation with object args uses json and defaults json mode", async () => {
    const event = buildMessageLifecycleFeedEvent({
      id: "api-json",
      ts: "2026-05-16T02:00:00.000Z",
      direction: "outbound",
      state: "delivered",
      channel: "api",
      route: "local",
      from: "api/sender",
      to: "api/receiver",
      text: "API body",
      signed: true,
    });

    await onEvent(event);
    const result = await messagesHandler({
      source: "api",
      args: { from: "api/", json: "true" } as Record<string, unknown>,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("\"api-json\"");
    expect(result.output).toContain("\"channel\": \"api\"");
  });

  test("cli --json returns parseable payload string", async () => {
    const result = await messagesHandler({ source: "cli", args: ["--json"] });
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output!)).toEqual({ ok: true, messages: [], total: 0, dbPath: messageLedgerDbPath() });
  });

  test("messagesEngineFetch exposes health/events/messages endpoints and 404", async () => {
    const health = await messagesEngineFetch(new Request("http://plugin.local/health"));
    const healthBody = await health.json();
    expect(healthBody).toEqual(expect.objectContaining({ ok: true, plugin: "messages" }));

    const ignored = await messagesEngineFetch(new Request("http://plugin.local/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "Notification", message: "noop" }),
    }));
    expect(await ignored.json()).toEqual({ ok: true, recorded: false });

    const notFound = await messagesEngineFetch(new Request("http://plugin.local/other"));
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ ok: false, error: "not_found" });
  });

  test("serve command rejects invalid port before daemonizing", async () => {
    await expect(messagesHandler({ source: "cli", args: ["serve", "--port", "not-a-number"] })).rejects.toThrow("invalid --port");
  });

  test("serve --detach returns already-running message when pid + registration exist", async () => {
    const engine = makeEngineStub({
      registrations: [{ plugin: "messages", prefix: "/api/message-ledger", upstream: "unix:///running" }],
    });

    process.argv = ["node", "/usr/local/bin/maw"];
    process.kill = ((pid: number, signal?: string | number) => {
      return signal === 0 ? true : true;
    }) as typeof process.kill;
    writeMessagesPid(999);

    const result = await messagesHandler({
      source: "cli",
      args: ["serve", "--detach", "--engine", `http://127.0.0.1:${engine.port}`],
    });

    engine.stop(true);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("already running");
    expect(result.output).toContain(join(tmpHome, "engine-plugins", "messages.log"));
  });

  test("serve --detach errors when existing live PID lacks registration and does not exit", async () => {
    const engine = makeEngineStub({ registrations: [] });
    process.kill = ((pid: number, signal?: string | number) => {
      if (signal === "SIGTERM" || signal === "SIGINT") {
        const err: NodeJS.ErrnoException = new Error("still alive") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }
      return true;
    }) as typeof process.kill;
    writeMessagesPid(888);

    const result = await messagesHandler({
      source: "cli",
      args: ["serve", "--detach", "--engine", `http://127.0.0.1:${engine.port}`],
    });

    engine.stop(true);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("has a live PID 888");
    expect(existsSync(join(tmpHome, "engine-plugins", "messages.pid"))).toBe(false);
  });

  test("serve --detach reports spawn failure when child_process.spawn throws", async () => {
    spawnShouldThrow = true;
    const engine = makeEngineStub({ registrations: [] });
    writeMessagesPid(111);

    const result = await messagesHandler({
      source: "cli",
      args: ["serve", "--detach", "--engine", `http://127.0.0.1:${engine.port}`],
    });

    engine.stop(true);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("failed to spawn maw messages serve");
  });

  test("serve --detach waits for registration and succeeds", async () => {
    let registerBody: Record<string, unknown> | undefined;
    const engineWithRegister = makeEngineStub({
      registrations: [],
      onRegister(body) {
        registerBody = body;
      },
    });
    setTimeout(() => {
      if (registerBody === undefined) {
        void fetch(`http://127.0.0.1:${engineWithRegister.port}/api/_engine/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plugin: "messages", prefix: "/api/message-ledger", upstream: "http://127.0.0.1:0" }),
        }).catch(() => {});
      }
    }, 50);

    const resultPromise = messagesHandler({
      source: "cli",
      args: ["serve", "--detach", "--engine", `http://127.0.0.1:${engineWithRegister.port}`, "--port", "0"],
    });

    const result = await resultPromise;
    engineWithRegister.stop(true);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("maw messages serve detached");
    expect(result.output).toContain("registered: /api/message-ledger on http://127.0.0.1:");
    expect(registerBody?.plugin).toBe("messages");
  });

  test("status reports running when pid is alive and registration exists", async () => {
    process.kill = mockKillStateful(["alive"]);
    writeMessagesPid(98765);

    const engine = makeEngineStub({
      registrations: [{
        plugin: "messages",
        prefix: "/api/message-ledger",
        upstream: "unix:///tmp/maw-messages.sock",
      }],
    });

    const result = await messagesHandler({
      source: "cli",
      args: ["status", "--engine", `http://127.0.0.1:${engine.port}`],
    });

    engine.stop(true);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("maw messages serve: running");
    expect(result.output).toContain("registered: /api/message-ledger → unix:///tmp/maw-messages.sock");
  });

  test("stop sends SIGTERM, waits for exit, and removes pid file", async () => {
    let killCalls = 0;
    process.kill = ((pid: number, signal?: string | number) => {
      killCalls += 1;
      if (signal === 0) {
        if (killCalls > 1) {
          const err: NodeJS.ErrnoException = new Error("gone") as NodeJS.ErrnoException;
          err.code = "ESRCH";
          throw err;
        }
        return true;
      }
      return true;
    }) as typeof process.kill;

    writeMessagesPid(777);
    const engine = makeEngineStub({ registrations: [] });

    const result = await messagesHandler({
      source: "cli",
      args: ["stop", "--engine", `http://127.0.0.1:${engine.port}`],
    });

    engine.stop(true);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("sent SIGTERM to PID 777");
    expect(result.output).toContain("stopped PID 777");
    expect(existsSync(join(tmpHome, "engine-plugins", "messages.pid"))).toBe(false);
  });

  test("query string parsing can ignore --limit=non-int and use fallback", async () => {
    const event = buildMessageLifecycleFeedEvent({
      id: "q1",
      ts: "2026-05-16T03:01:00.000Z",
      direction: "outbound",
      state: "delivered",
      channel: "hey",
      route: "local",
      from: "u/limit",
      to: "u/q",
      text: "one",
      signed: true,
    });
    const event2 = buildMessageLifecycleFeedEvent({
      id: "q2",
      ts: "2026-05-16T03:02:00.000Z",
      direction: "outbound",
      state: "delivered",
      channel: "hey",
      route: "local",
      from: "u/limit",
      to: "u/q",
      text: "two",
      signed: true,
    });

    await onEvent(event);
    await onEvent(event2);

    const res = await messagesEngineFetch(new Request(`http://plugin.local/?limit=abc&from=u/limit`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.messages).toHaveLength(2);
  });
});
