import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cmdStream,
  parseDurationMs,
  replayLinesForDuration,
  resolveStreamTarget,
  streamUrlFromConfig,
  type StreamDeps,
} from "../../src/vendor/mpr-plugins/stream/impl";

type Session = { name: string; windows: Array<{ name: string }> };
type TimerHandle = { fn: () => void; active: boolean; ms?: number };

const encode = (text: string) => new TextEncoder().encode(text);
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  binaryType?: BinaryType;
  sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  message(data: unknown) {
    this.onmessage?.({ data });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

const originalEngineUrl = process.env.MAW_ENGINE_URL;
const originalPort = process.env.MAW_PORT;

let sessions: Session[];
let out: string[];
let err: string[];
let timers: TimerHandle[];
let handlers: Partial<Record<"SIGINT" | "SIGTERM", () => void>>;

function deps(overrides: Partial<StreamDeps> = {}): Partial<StreamDeps> {
  return {
    WebSocketCtor: FakeWebSocket as unknown as StreamDeps["WebSocketCtor"],
    loadConfig: (() => ({ port: 4567 })) as StreamDeps["loadConfig"],
    listSessions: async () => sessions as any,
    loadFleet: (() => []) as StreamDeps["loadFleet"],
    stdoutWrite: (chunk) => { out.push(chunk); },
    stderrWrite: (chunk) => { err.push(chunk); },
    now: () => Date.parse("2026-05-21T14:23:45.000Z"),
    setTimeout: ((fn: () => void, ms?: number) => {
      const timer = { fn, active: true, ms };
      timers.push(timer);
      return timer as any;
    }) as typeof setTimeout,
    clearTimeout: ((timer: TimerHandle | null) => {
      if (timer) timer.active = false;
    }) as typeof clearTimeout,
    processOn: (signal, handler) => { handlers[signal] = handler; },
    processOff: (signal, handler) => {
      if (handlers[signal] === handler) delete handlers[signal];
    },
    ...overrides,
  };
}

function restoreEnv() {
  if (originalEngineUrl === undefined) delete process.env.MAW_ENGINE_URL;
  else process.env.MAW_ENGINE_URL = originalEngineUrl;
  if (originalPort === undefined) delete process.env.MAW_PORT;
  else process.env.MAW_PORT = originalPort;
}

beforeEach(() => {
  restoreEnv();
  FakeWebSocket.instances = [];
  sessions = [{ name: "mawjs-codex-oracle", windows: [{ name: "main" }] }];
  out = [];
  err = [];
  timers = [];
  handlers = {};
});

afterEach(() => {
  restoreEnv();
});

describe("maw stream plugin", () => {
  test("parses duration flags, derives replay depth, and builds the PTY websocket URL", () => {
    expect(parseDurationMs("1m30s")).toBe(90_000);
    expect(parseDurationMs("2")).toBe(2_000);
    expect(parseDurationMs("250ms")).toBe(250);
    expect(parseDurationMs("1x")).toBeNull();
    expect(replayLinesForDuration(10 * 60_000)).toBe(600);

    delete process.env.MAW_ENGINE_URL;
    delete process.env.MAW_PORT;
    expect(streamUrlFromConfig({ loadConfig: (() => ({ port: 4567 })) as StreamDeps["loadConfig"] })).toBe("ws://127.0.0.1:4567/ws/pty");

    process.env.MAW_PORT = "4568";
    expect(streamUrlFromConfig({ loadConfig: (() => ({ port: 4567 })) as StreamDeps["loadConfig"] })).toBe("ws://127.0.0.1:4568/ws/pty");

    process.env.MAW_ENGINE_URL = "https://engine.example:9443/base?token=ignored";
    expect(streamUrlFromConfig({ loadConfig: (() => ({ port: 4567 })) as StreamDeps["loadConfig"] })).toBe("wss://engine.example:9443/ws/pty");
  });

  test("resolves attach-style names while preserving explicit tmux pane suffixes", async () => {
    sessions = [{ name: "50-codex", windows: [{ name: "main" }] }];
    expect(await resolveStreamTarget("codex", deps() as any)).toBe("50-codex");
    expect(await resolveStreamTarget("codex:1.2", deps() as any)).toBe("50-codex:1.2");
    expect(await resolveStreamTarget("raw:window", deps() as any)).toBe("raw:window");
  });

  test("follows live chunks by default without requesting scrollback replay", async () => {
    const stream = cmdStream("mawjs-codex-oracle", {}, deps());
    await flush();

    const ws = FakeWebSocket.instances[0];
    ws.open();
    expect(JSON.parse(ws.sent[0])).toMatchObject({
      type: "attach",
      target: "mawjs-codex-oracle",
      replayLines: 0,
    });

    ws.message(encode("hello\n"));
    await flush();
    expect(out.join("")).toBe("hello\n");

    ws.message(JSON.stringify({ type: "detached", target: "mawjs-codex-oracle" }));
    await expect(stream).resolves.toEqual({ pane: "mawjs-codex-oracle", reason: "detached", chunks: 1 });
    expect(handlers).toEqual({});
  });

  test("streams structured JSON chunks and uses --since as bounded replay depth", async () => {
    const stream = cmdStream("mawjs-codex-oracle", { since: "10m", json: true }, deps());
    await flush();

    const ws = FakeWebSocket.instances[0];
    ws.open();
    expect(JSON.parse(ws.sent[0])).toMatchObject({ replayLines: 600 });

    ws.message(encode("history\n"));
    await flush();
    ws.message(JSON.stringify({ type: "detached", target: "mawjs-codex-oracle" }));

    await expect(stream).resolves.toMatchObject({ reason: "detached", chunks: 1 });
    expect(JSON.parse(out[0])).toEqual({
      ts: "2026-05-21T14:23:45Z",
      pane: "mawjs-codex-oracle",
      chunk: "history\n",
    });
  });

  test("applies grep filtering and exits cleanly after idle", async () => {
    const stream = cmdStream("mawjs-codex-oracle", { grep: "keep", quitOnIdle: "5s" }, deps());
    await flush();

    const ws = FakeWebSocket.instances[0];
    ws.open();
    expect(timers.at(-1)?.ms).toBe(5_000);

    ws.message(encode("drop\n"));
    await flush();
    ws.message(encode("keep\n"));
    await flush();
    expect(out).toEqual(["keep\n"]);

    const activeTimer = [...timers].reverse().find(t => t.active);
    activeTimer?.fn();

    await expect(stream).resolves.toEqual({ pane: "mawjs-codex-oracle", reason: "idle", chunks: 1 });
    expect(ws.sent.at(-1)).toBe(JSON.stringify({ type: "detach" }));
    expect(handlers).toEqual({});
  });

  test("detaches and resolves cleanly on Ctrl-C", async () => {
    const stream = cmdStream("mawjs-codex-oracle", {}, deps());
    await flush();

    const ws = FakeWebSocket.instances[0];
    ws.open();
    handlers.SIGINT?.();

    await expect(stream).resolves.toEqual({ pane: "mawjs-codex-oracle", reason: "signal", chunks: 0 });
    expect(ws.sent.at(-1)).toBe(JSON.stringify({ type: "detach" }));
    expect(handlers).toEqual({});
  });

  test("cleans up signal handlers on network close", async () => {
    const stream = cmdStream("mawjs-codex-oracle", {}, deps());
    await flush();

    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.close();

    await expect(stream).resolves.toEqual({ pane: "mawjs-codex-oracle", reason: "closed", chunks: 0 });
    expect(handlers).toEqual({});
  });

  test("surfaces bridge error frames on stderr", async () => {
    const stream = cmdStream("mawjs-codex-oracle", {}, deps());
    await flush();

    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.message(JSON.stringify({ type: "error", message: "Failed to create PTY session" }));

    await expect(stream).rejects.toThrow("Failed to create PTY session");
    expect(err).toEqual(["stream: Failed to create PTY session\n"]);
  });
});
