import { beforeEach, describe, expect, test } from "bun:test";
import {
  classifySnapshots,
  collectFollowSnapshot,
  cmdActivity,
  isStuckSnapshot,
  normalizeSnapshot,
  parseActivityOptions,
  sampleActivity,
  sampleAllActivity,
  type ActivityDeps,
} from "../../src/vendor/mpr-plugins/activity/impl.ts?activity-impl-coverage";

type Session = { name: string; windows: Array<{ name: string }> };
type FleetEntry = { file: string; path: string; num: number; groupName: string; session: { name: string; windows: Array<{ name: string; repo: string }> } };
type TimerHandle = { fn: () => void; active: boolean; ms?: number };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

let socketScript: ((ws: FakeWebSocket) => void) | null = null;

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
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.({});
      socketScript?.(this);
    });
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

let sessions: Session[];
let fleetEntries: FleetEntry[];
let snapshots: string[];
let out: string[];
let err: string[];
let now: number;
let timers: TimerHandle[];
let handlers: Partial<Record<"SIGINT" | "SIGTERM", () => void>>;

function deps(overrides: Partial<ActivityDeps> = {}): Partial<ActivityDeps> {
  return {
    WebSocketCtor: FakeWebSocket as unknown as ActivityDeps["WebSocketCtor"],
    loadConfig: (() => ({ port: 4567 })) as ActivityDeps["loadConfig"],
    listSessions: async () => sessions as any,
    loadFleet: (() => []) as ActivityDeps["loadFleet"],
    loadFleetEntries: (() => fleetEntries as any) as ActivityDeps["loadFleetEntries"],
    stdoutWrite: (chunk) => { out.push(chunk); },
    stderrWrite: (chunk) => { err.push(chunk); },
    now: () => now,
    setTimeout: ((fn: () => void, ms?: number) => {
      const timer = { fn, active: true, ms };
      timers.push(timer);
      return timer as any;
    }) as typeof setTimeout,
    clearTimeout: ((timer: TimerHandle | null) => {
      if (timer) timer.active = false;
    }) as typeof clearTimeout,
    sleep: async (ms) => { now += ms; },
    processOn: (signal, handler) => { handlers[signal] = handler; },
    processOff: (signal, handler) => {
      if (handlers[signal] === handler) delete handlers[signal];
    },
    snapshotPane: async () => snapshots.shift() ?? "",
    snapshotSettleMs: 0,
    snapshotTimeoutMs: 1_000,
    ...overrides,
  };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  socketScript = null;
  sessions = [{ name: "50-mawjs", windows: [{ name: "mawjs-features" }] }];
  fleetEntries = [
    { file: "50-mawjs.json", path: "/fleet/50-mawjs.json", num: 50, groupName: "mawjs", session: { name: "mawjs", windows: [{ name: "mawjs-features", repo: "Soul-Brews-Studio/maw-js" }] } },
  ];
  snapshots = [];
  out = [];
  err = [];
  now = 1_000_000;
  timers = [];
  handlers = {};
});

describe("maw activity impl", () => {
  test("parses duration and sample options with validation", () => {
    expect(parseActivityOptions({ window: "1m30s", samples: 5 })).toEqual({ windowMs: 90_000, samples: 5 });
    expect(parseActivityOptions({})).toEqual({ windowMs: 30_000, samples: 3 });
    expect(() => parseActivityOptions({ window: "nope" })).toThrow("invalid --window");
    expect(() => parseActivityOptions({ samples: 1 })).toThrow("--samples");
    expect(() => parseActivityOptions({ samples: 51 })).toThrow("--samples");
  });

  test("classifies busy, idle, and stuck snapshots", () => {
    expect(normalizeSnapshot("\u001b[31mhello\u001b[0m\r\n")).toBe("hello");
    expect(isStuckSnapshot("\n› ")).toBe(true);

    const busy = classifySnapshots("pane", [
      { text: "one", at: 1_000 },
      { text: "two", at: 2_000 },
      { text: "three", at: 3_000 },
    ], 30_000);
    expect(busy).toMatchObject({ state: "busy", confidence: "high", diff_samples: 3, samples: 3 });

    const idle = classifySnapshots("pane", [
      { text: "same", at: 1_000 },
      { text: "same", at: 16_000 },
      { text: "same", at: 31_000 },
    ], 30_000);
    expect(idle).toMatchObject({ state: "idle", diff_samples: 0, last_change_ago_seconds: 30 });

    const stuck = classifySnapshots("pane", [
      { text: "\n❯ ", at: 1_000 },
      { text: "\n❯ ", at: 31_000 },
    ], 30_000);
    expect(stuck).toMatchObject({ state: "stuck", confidence: "medium", diff_samples: 0 });
  });

  test("samples a pane through follow target resolution", async () => {
    snapshots = ["one", "two", "three"];

    const result = await sampleActivity("mawjs-features", { window: "2s", samples: 3 }, deps());

    expect(result).toMatchObject({
      pane: "50-mawjs:mawjs-features",
      state: "busy",
      diff_samples: 3,
      sample_window_seconds: 2,
    });
  });

  test("surveys fleet targets and skips unresolved panes", async () => {
    fleetEntries = [
      { file: "50-mawjs.json", path: "/fleet/50-mawjs.json", num: 50, groupName: "mawjs", session: { name: "mawjs", windows: [{ name: "mawjs-features", repo: "Soul-Brews-Studio/maw-js" }, { name: "ghost-pane", repo: "Ghost/repo" }] } },
    ];
    snapshots = ["same", "same"];

    const results = await sampleAllActivity({ window: "1s", samples: 2 }, deps());

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ pane: "50-mawjs:mawjs-features", state: "idle" });
  });

  test("surveys fleet targets with bounded parallelism", async () => {
    sessions = [{ name: "50-mawjs", windows: [{ name: "pane-a" }, { name: "pane-b" }] }];
    fleetEntries = [
      { file: "50-mawjs.json", path: "/fleet/50-mawjs.json", num: 50, groupName: "mawjs", session: { name: "mawjs", windows: [{ name: "pane-a", repo: "Soul-Brews-Studio/maw-js" }, { name: "pane-b", repo: "Soul-Brews-Studio/maw-js" }] } },
    ];
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await sampleAllActivity({ window: "1s", samples: 2 }, deps({
      allConcurrency: 2,
      snapshotPane: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return "same";
      },
    }));

    expect(results).toHaveLength(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  test("emits JSON for one-shot and transition-only watch output", async () => {
    snapshots = ["same", "same"];
    await cmdActivity("mawjs-features", { json: true, window: "1s", samples: 2 }, deps());
    expect(JSON.parse(out[0])).toMatchObject({ pane: "50-mawjs:mawjs-features", state: "idle" });

    out = [];
    snapshots = ["idle", "idle", "one", "two", "still", "moving"];
    await cmdActivity("mawjs-features", {
      json: true,
      watch: true,
      watchIterations: 3,
      window: "1s",
      samples: 2,
    }, deps());

    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0])).toMatchObject({ state: "busy" });
    expect(handlers).toEqual({});
  });

  test("human watch mode explains that it only emits transitions", async () => {
    snapshots = ["same", "same"];

    await cmdActivity("mawjs-features", {
      watch: true,
      watchIterations: 1,
      window: "1s",
      samples: 2,
    }, deps());

    expect(out).toEqual([]);
    expect(err.join("")).toContain("activity: watching mawjs-features transitions only");
  });

  test("collects a bounded snapshot from the follow/PTTY websocket attach protocol", async () => {
    socketScript = (ws) => {
      ws.message(new TextEncoder().encode("hello\n"));
      ws.message(JSON.stringify({ type: "attached" }));
      ws.message("world\n");
      ws.message(JSON.stringify({ type: "detached" }));
    };

    const promise = collectFollowSnapshot("50-mawjs:mawjs-features", 2_000, deps() as ActivityDeps);
    await flush();

    await expect(promise).resolves.toBe("hello\nworld\n");
    expect(FakeWebSocket.instances[0].url).toBe("ws://127.0.0.1:4567/ws/pty");
    expect(JSON.parse(FakeWebSocket.instances[0].sent[0])).toMatchObject({
      type: "attach",
      target: "50-mawjs:mawjs-features",
      replayLines: 2,
    });
  });
});
