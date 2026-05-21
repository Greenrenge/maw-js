import { loadConfig } from "maw-js/config";
import { listSessions } from "maw-js/sdk";
import { loadFleet, loadFleetEntries, type FleetEntry } from "maw-js/commands/shared/fleet-load";
import {
  followUrlFromConfig,
  parseDurationMs,
  replayLinesForDuration,
  resolveFollowTarget,
  type FollowDeps,
} from "../follow/impl";

export const ACTIVITY_USAGE = "usage: maw activity <pane> [--watch] [--json] [--window=<dur>] [--samples=N] | maw activity --all [--watch] [--json] [--window=<dur>] [--samples=N]";

export type ActivityState = "busy" | "idle" | "stuck";
export type ActivityConfidence = "low" | "medium" | "high";

export interface ActivityOptions {
  all?: boolean;
  watch?: boolean;
  json?: boolean;
  window?: string;
  samples?: number;
  watchIterations?: number;
}

export interface ActivityResult {
  pane: string;
  state: ActivityState;
  confidence: ActivityConfidence;
  samples: number;
  diff_samples: number;
  last_change_ago_seconds: number;
  sample_window_seconds: number;
}

type WebSocketLike = {
  readyState: number;
  binaryType?: BinaryType;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

type WebSocketCtor = new (url: string) => WebSocketLike;
type Timer = ReturnType<typeof setTimeout>;

export interface ActivityDeps {
  WebSocketCtor: WebSocketCtor;
  loadConfig: typeof loadConfig;
  listSessions: typeof listSessions;
  loadFleet: typeof loadFleet;
  loadFleetEntries: typeof loadFleetEntries;
  stdoutWrite: (chunk: string) => void;
  stderrWrite: (chunk: string) => void;
  now: () => number;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  sleep: (ms: number) => Promise<void>;
  processOn: (signal: "SIGINT" | "SIGTERM", handler: () => void) => void;
  processOff: (signal: "SIGINT" | "SIGTERM", handler: () => void) => void;
  snapshotPane: (pane: string, windowMs: number, deps: ActivityDeps) => Promise<string>;
  snapshotSettleMs: number;
  snapshotTimeoutMs: number;
  allConcurrency: number;
}

export function activityDeps(overrides: Partial<ActivityDeps> = {}): ActivityDeps {
  const base: Pick<FollowDeps, "WebSocketCtor" | "loadConfig" | "listSessions" | "loadFleet" | "stdoutWrite" | "stderrWrite" | "now" | "setTimeout" | "clearTimeout" | "processOn" | "processOff"> = {
    WebSocketCtor: WebSocket as unknown as WebSocketCtor,
    loadConfig,
    listSessions,
    loadFleet,
    stdoutWrite: (chunk) => { process.stdout.write(chunk); },
    stderrWrite: (chunk) => { process.stderr.write(chunk); },
    now: Date.now,
    setTimeout,
    clearTimeout,
    processOn: (signal, handler) => { process.on(signal, handler); },
    processOff: (signal, handler) => { process.off(signal, handler); },
  };
  return {
    ...base,
    loadFleetEntries,
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    snapshotPane: collectFollowSnapshot,
    snapshotSettleMs: 150,
    snapshotTimeoutMs: 1_000,
    allConcurrency: 8,
    ...overrides,
  };
}

async function frameToText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) return await data.text();
  return String(data ?? "");
}

function parseControlFrame(text: string): { type?: string; target?: string; message?: string } | null {
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function collectFollowSnapshot(pane: string, windowMs: number, deps: ActivityDeps = activityDeps()): Promise<string> {
  const url = followUrlFromConfig(deps);
  const ws = new deps.WebSocketCtor(url);
  ws.binaryType = "arraybuffer";
  const chunks: string[] = [];
  const replayLines = replayLinesForDuration(windowMs);

  return await new Promise<string>((resolve, reject) => {
    let done = false;
    let settleTimer: Timer | null = null;
    let hardTimer: Timer | null = null;

    const clearTimers = () => {
      if (settleTimer) deps.clearTimeout(settleTimer);
      if (hardTimer) deps.clearTimeout(hardTimer);
      settleTimer = null;
      hardTimer = null;
    };
    const detach = () => {
      try { ws.send(JSON.stringify({ type: "detach" })); } catch { /* socket may already be closed */ }
    };
    const close = () => {
      try { ws.close(); } catch { /* socket may already be closed */ }
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimers();
      detach();
      close();
      resolve(chunks.join(""));
    };
    const fail = (err: Error) => {
      if (done) return;
      done = true;
      clearTimers();
      detach();
      close();
      reject(err);
    };
    const armSettle = () => {
      if (settleTimer) deps.clearTimeout(settleTimer);
      settleTimer = deps.setTimeout(finish, deps.snapshotSettleMs);
    };

    hardTimer = deps.setTimeout(finish, deps.snapshotTimeoutMs);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "attach", target: pane, cols: 120, rows: 40, replayLines }));
    };
    ws.onmessage = (event) => {
      void (async () => {
        const text = await frameToText(event.data);
        const control = parseControlFrame(text);
        if (control?.type === "attached") {
          armSettle();
          return;
        }
        if (control?.type === "detached") {
          finish();
          return;
        }
        if (control?.type === "error") {
          fail(new Error(control.message || "PTY activity error"));
          return;
        }
        chunks.push(text);
        armSettle();
      })().catch((e: any) => fail(e instanceof Error ? e : new Error(String(e))));
    };
    ws.onerror = () => fail(new Error(`activity: websocket error: ${url}`));
    ws.onclose = () => finish();
  });
}

interface ParsedActivityOptions {
  windowMs: number;
  samples: number;
}

export function parseActivityOptions(opts: ActivityOptions = {}): ParsedActivityOptions {
  const windowMs = opts.window === undefined ? 30_000 : parseDurationMs(opts.window);
  if (!windowMs || windowMs <= 0) throw new Error(`activity: invalid --window duration: ${opts.window}`);
  const samples = opts.samples ?? 3;
  if (!Number.isInteger(samples) || samples < 2 || samples > 50) {
    throw new Error("activity: --samples must be an integer from 2 to 50");
  }
  return { windowMs, samples };
}

function stripAnsi(input: string): string {
  return input
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b[P^_].*?\x1b\\/gs, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[()][A-Za-z0-9]/g, "")
    .replace(/\r/g, "\n");
}

export function normalizeSnapshot(input: string): string {
  return stripAnsi(input)
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .trim();
}

export function isStuckSnapshot(input: string): boolean {
  const normalized = normalizeSnapshot(input);
  const lines = normalized.split("\n").map(line => line.trim()).filter(Boolean).slice(-10);
  if (lines.some(line => /^(?:[>$#]|[❯›λ])\s*(?:[▌█_])?$/.test(line))) return true;
  return /(type a message|send a message|ask codex|ask claude|what can i help with)\??\s*$/i.test(normalized);
}

function confidenceFor(samples: number): ActivityConfidence {
  if (samples >= 3) return "high";
  if (samples === 2) return "medium";
  return "low";
}

interface SnapshotSample {
  text: string;
  at: number;
}

export function classifySnapshots(pane: string, rawSamples: SnapshotSample[], windowMs: number): ActivityResult {
  const normalized = rawSamples.map(sample => normalizeSnapshot(sample.text));
  const changedIndexes = new Set<number>();
  let lastChangeAt: number | null = null;
  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i] !== normalized[i - 1]) {
      changedIndexes.add(i - 1);
      changedIndexes.add(i);
      lastChangeAt = rawSamples[i].at;
    }
  }

  const end = rawSamples.at(-1)?.at ?? Date.now();
  const state: ActivityState = changedIndexes.size > 0
    ? "busy"
    : isStuckSnapshot(rawSamples.at(-1)?.text ?? "") ? "stuck" : "idle";
  const sampleWindowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const lastChangeAgoSeconds = lastChangeAt === null
    ? sampleWindowSeconds
    : Math.max(0, Math.round((end - lastChangeAt) / 1000));

  return {
    pane,
    state,
    confidence: confidenceFor(rawSamples.length),
    samples: rawSamples.length,
    diff_samples: changedIndexes.size,
    last_change_ago_seconds: lastChangeAgoSeconds,
    sample_window_seconds: sampleWindowSeconds,
  };
}

export async function sampleActivity(target: string, opts: ActivityOptions = {}, overrides: Partial<ActivityDeps> = {}): Promise<ActivityResult> {
  const deps = activityDeps(overrides);
  const parsed = parseActivityOptions(opts);
  const pane = await resolveFollowTarget(target, deps);
  const intervalMs = parsed.samples === 1 ? 0 : Math.round(parsed.windowMs / (parsed.samples - 1));
  const samples: SnapshotSample[] = [];

  for (let i = 0; i < parsed.samples; i += 1) {
    if (i > 0) await deps.sleep(intervalMs);
    const text = await deps.snapshotPane(pane, parsed.windowMs, deps);
    samples.push({ text, at: deps.now() });
  }

  return classifySnapshots(pane, samples, parsed.windowMs);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R | undefined>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workerCount = Math.max(1, Math.min(items.length, Math.floor(limit) || 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const item = items[next++];
      const result = await fn(item);
      if (result !== undefined) results.push(result);
    }
  });
  await Promise.all(workers);
  return results;
}

function allTargets(entries: FleetEntry[]): string[] {
  const targets: string[] = [];
  for (const entry of entries) {
    const windows = entry.session.windows?.length ? entry.session.windows : [{ name: entry.session.name, repo: "" }];
    for (const window of windows) targets.push(window.name || entry.session.name);
  }
  return [...new Set(targets)].sort((a, b) => a.localeCompare(b));
}

export async function sampleAllActivity(opts: ActivityOptions = {}, overrides: Partial<ActivityDeps> = {}): Promise<ActivityResult[]> {
  const deps = activityDeps(overrides);
  const targets = allTargets(deps.loadFleetEntries());
  const results = await mapLimit(targets, deps.allConcurrency, async (target) => {
    try {
      return await sampleActivity(target, opts, deps);
    } catch {
      // Fleet-wide scans skip sleeping, ambiguous, or otherwise unresolvable panes.
      return undefined;
    }
  });
  return results.sort((a, b) => a.pane.localeCompare(b.pane));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

function samplingDescription(opts: ActivityOptions): string {
  const parsed = parseActivityOptions(opts);
  return `window=${formatDuration(Math.max(1, Math.round(parsed.windowMs / 1000)))}, samples=${parsed.samples}`;
}

export function formatActivityHuman(result: ActivityResult): string {
  const icon = result.state === "busy" ? "🟢" : result.state === "stuck" ? "🔴" : "🟡";
  const age = result.state === "busy"
    ? `last change ${formatDuration(result.last_change_ago_seconds)} ago`
    : `no change in ${formatDuration(result.last_change_ago_seconds)}`;
  return `${result.pane}: ${icon} ${result.state.toUpperCase()} (${age}, ${result.diff_samples}/${result.samples} samples diff)`;
}

function emit(result: ActivityResult, opts: ActivityOptions, deps: Pick<ActivityDeps, "stdoutWrite">) {
  deps.stdoutWrite(opts.json ? `${JSON.stringify(result)}\n` : `${formatActivityHuman(result)}\n`);
}

async function cmdActivityOnce(target: string | undefined, opts: ActivityOptions, deps: ActivityDeps): Promise<ActivityResult[]> {
  if (opts.all) {
    if (!opts.json) deps.stderrWrite(`activity: surveying fleet (${samplingDescription(opts)})...\n`);
    const results = await sampleAllActivity(opts, deps);
    deps.stdoutWrite(opts.json ? `${JSON.stringify(results)}\n` : results.map(formatActivityHuman).join("\n") + (results.length ? "\n" : ""));
    return results;
  }
  if (!target) throw new Error(ACTIVITY_USAGE);
  const result = await sampleActivity(target, opts, deps);
  emit(result, opts, deps);
  return [result];
}

async function cmdActivityWatch(target: string | undefined, opts: ActivityOptions, deps: ActivityDeps): Promise<ActivityResult[]> {
  if (!opts.all && !target) throw new Error(ACTIVITY_USAGE);
  if (!opts.json) {
    const scope = opts.all ? "fleet" : target;
    deps.stderrWrite(`activity: watching ${scope} transitions only (${samplingDescription(opts)}); press Ctrl-C to stop\n`);
  }
  const emitted: ActivityResult[] = [];
  const previous = new Map<string, ActivityState>();
  let stopped = false;
  const onSignal = () => { stopped = true; };
  deps.processOn("SIGINT", onSignal);
  deps.processOn("SIGTERM", onSignal);
  try {
    const max = opts.watchIterations ?? Number.POSITIVE_INFINITY;
    for (let i = 0; i < max && !stopped; i += 1) {
      const results = opts.all
        ? await sampleAllActivity(opts, deps)
        : [await sampleActivity(target || "", opts, deps)];
      for (const result of results) {
        const prev = previous.get(result.pane);
        previous.set(result.pane, result.state);
        if (prev !== undefined && prev !== result.state) {
          emit(result, opts, deps);
          emitted.push(result);
        }
      }
    }
  } finally {
    deps.processOff("SIGINT", onSignal);
    deps.processOff("SIGTERM", onSignal);
  }
  return emitted;
}

export async function cmdActivity(target: string | undefined, opts: ActivityOptions = {}, overrides: Partial<ActivityDeps> = {}): Promise<ActivityResult[]> {
  const deps = activityDeps(overrides);
  if (opts.watch) return await cmdActivityWatch(target, opts, deps);
  return await cmdActivityOnce(target, opts, deps);
}
