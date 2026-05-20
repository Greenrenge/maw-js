import type { InvokeContext, InvokeResult } from "../../../plugin/types";
import { loadConfig } from "../../../config";
import { listSessions } from "../../../core/transport/ssh";
import type { Session } from "../../../core/runtime/find-window";
import { getRepos } from "../../../core/repo-discovery";
import { discoverPackages } from "../../../plugin/registry";
import type { LoadedPlugin } from "../../../plugin/types";
import {
  formatPeerSources,
  type PeerSourceResult,
  parsePeerSourceMode,
  resolvePeerSources,
} from "../../shared/peer-sources";

export const command = {
  name: "discover",
  description: "List configured and discovered federation peers.",
};

const USAGE = "usage: maw discover [--peers config|scout|both] [--json] [--tree] [--awake]";

function cliArgs(ctx: InvokeContext): string[] {
  return ctx.source === "cli" && Array.isArray(ctx.args) ? ctx.args : [];
}

function argsObject(ctx: InvokeContext): Record<string, unknown> {
  return ctx.source !== "cli" && ctx.args && !Array.isArray(ctx.args)
    ? ctx.args as Record<string, unknown>
    : {};
}

function readOption(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  const value = args[idx + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function boolish(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
    if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  }
  return undefined;
}

function hasFlag(args: string[], name: string, value: unknown): boolean {
  return args.includes(name) || boolish(value) === true;
}

interface LiveWindow {
  index: number;
  name: string;
  active: boolean;
  target: string;
}

interface LiveSession {
  source: "tmux";
  name: string;
  awake: true;
  windowCount: number;
  windows: LiveWindow[];
}

interface LiveRuntimeState {
  source: "tmux";
  total: number;
  sessions: LiveSession[];
  warnings: string[];
}

interface PluginRecord {
  source: "plugin-registry";
  type: "plugin";
  name: string;
  version: string;
  kind: LoadedPlugin["kind"];
  tier: string;
  weight: number;
  disabled: boolean;
  dir: string;
  command?: string;
  aliases: string[];
  capabilities: string[];
  dependencies: string[];
}

interface PluginRegistryState {
  source: "plugin-registry";
  total: number;
  records: PluginRecord[];
  warnings: string[];
}

interface GhqRepoRecord {
  source: "ghq";
  type: "repo";
  path: string;
  name: string;
  owner?: string;
  host?: string;
  oracleLike: boolean;
  worktree: boolean;
}

interface GhqState {
  source: "ghq";
  total: number;
  repos: GhqRepoRecord[];
  warnings: string[];
}

function liveSession(session: Session): LiveSession {
  return {
    source: "tmux",
    name: session.name,
    awake: true,
    windowCount: session.windows.length,
    windows: session.windows.map((window) => ({
      index: window.index,
      name: window.name,
      active: window.active,
      target: `${session.name}:${window.index}`,
    })),
  };
}

async function loadLiveRuntimeState(): Promise<LiveRuntimeState> {
  try {
    const sessions = await listSessions();
    return {
      source: "tmux",
      total: sessions.length,
      sessions: sessions.map(liveSession),
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "tmux",
      total: 0,
      sessions: [],
      warnings: [`tmux unavailable (${message})`],
    };
  }
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function repoRecord(path: string): GhqRepoRecord {
  const normalized = normalizeRepoPath(path);
  const parts = normalized.split("/").filter(Boolean);
  const name = parts.at(-1) ?? normalized;
  const hostIndex = parts.findIndex((part) => part.includes("."));
  const host = hostIndex >= 0 ? parts[hostIndex] : undefined;
  const owner = hostIndex >= 0 ? parts[hostIndex + 1] : parts.at(-2);
  return {
    source: "ghq",
    type: "repo",
    path: normalized,
    name,
    owner,
    host,
    oracleLike: /(^|[-_])oracle($|[-_])/.test(name) || name.includes("oracle"),
    worktree: /\.wt[-/.]/.test(normalized) || /\.wt-[^/]+$/.test(normalized),
  };
}

async function loadGhqState(): Promise<GhqState> {
  try {
    const seen = new Set<string>();
    const repos: GhqRepoRecord[] = [];
    for (const raw of await getRepos().list()) {
      const path = normalizeRepoPath(raw);
      const key = path.toLowerCase();
      if (!path || seen.has(key)) continue;
      seen.add(key);
      repos.push(repoRecord(path));
    }
    return {
      source: "ghq",
      total: repos.length,
      repos,
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "ghq",
      total: 0,
      repos: [],
      warnings: [`ghq unavailable (${message})`],
    };
  }
}

function pluginRecord(plugin: LoadedPlugin): PluginRecord {
  const manifest = plugin.manifest;
  return {
    source: "plugin-registry",
    type: "plugin",
    name: manifest.name,
    version: manifest.version,
    kind: plugin.kind,
    tier: manifest.tier ?? "core",
    weight: manifest.weight ?? 50,
    disabled: plugin.disabled === true,
    dir: plugin.dir,
    command: manifest.cli?.command,
    aliases: manifest.cli?.aliases ?? [],
    capabilities: manifest.capabilities ?? [],
    dependencies: manifest.dependencies?.plugins ?? [],
  };
}

function loadPluginRegistryState(): PluginRegistryState {
  try {
    const records = discoverPackages().map(pluginRecord);
    return {
      source: "plugin-registry",
      total: records.length,
      records,
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "plugin-registry",
      total: 0,
      records: [],
      warnings: [`plugin registry unavailable (${message})`],
    };
  }
}

function renderPluginRecords(plugins: PluginRegistryState): string {
  if (plugins.records.length === 0) return "no registered plugins";
  const header = ["name", "version", "kind", "tier", "command", "disabled"];
  const rows = plugins.records.map((plugin) => [
    plugin.name,
    plugin.version,
    plugin.kind,
    plugin.tier,
    plugin.command ?? "-",
    plugin.disabled ? "yes" : "no",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [fmt(header), fmt(widths.map((w) => "-".repeat(w))), ...rows.map(fmt)].join("\n");
}

function renderGhqRepos(ghq: GhqState): string {
  if (ghq.repos.length === 0) return "no ghq repos discovered";
  const header = ["name", "owner", "oracle", "worktree", "path"];
  const rows = ghq.repos.map((repo) => [
    repo.name,
    repo.owner ?? "-",
    repo.oracleLike ? "yes" : "no",
    repo.worktree ? "yes" : "no",
    repo.path,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [fmt(header), fmt(widths.map((w) => "-".repeat(w))), ...rows.map(fmt)].join("\n");
}

function renderDiscoverTable(result: PeerSourceResult, plugins: PluginRegistryState, ghq: GhqState): string {
  const chunks = [formatPeerSources(result)];
  if (plugins.records.length > 0) chunks.push(`plugin registry\n${renderPluginRecords(plugins)}`);
  if (ghq.repos.length > 0) chunks.push(`ghq repos\n${renderGhqRepos(ghq)}`);
  for (const warning of plugins.warnings) chunks.push(`warning: ${warning}`);
  for (const warning of ghq.warnings) chunks.push(`warning: ${warning}`);
  return chunks.join("\n\n");
}

function renderLiveSessions(live: LiveRuntimeState): string {
  if (live.sessions.length === 0) return "no live tmux sessions";
  const header = ["session", "windows"];
  const rows = live.sessions.map((session) => [session.name, String(session.windowCount)]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [fmt(header), fmt(widths.map((w) => "-".repeat(w))), ...rows.map(fmt)].join("\n");
}

function renderDiscoverTree(result: PeerSourceResult, live: LiveRuntimeState, plugins: PluginRegistryState, ghq: GhqState): string {
  const lines = ["discover"];
  lines.push(`  tmux (${live.sessions.length} live session${live.sessions.length === 1 ? "" : "s"})`);
  for (const session of live.sessions) {
    lines.push(`    ${session.name}`);
    for (const window of session.windows) {
      const active = window.active ? " *" : "";
      lines.push(`      ${window.index}:${window.name}${active}`);
    }
  }
  lines.push(`  federation peers (${result.peers.length})`);
  for (const peer of result.peers) {
    const label = peer.name ?? peer.node ?? peer.oracle ?? "-";
    lines.push(`    ${peer.source} ${label} -> ${peer.url}`);
  }
  lines.push(`  plugins (${plugins.records.length} registered)`);
  for (const plugin of plugins.records) {
    const command = plugin.command ? ` command=${plugin.command}` : "";
    const disabled = plugin.disabled ? " disabled" : "";
    lines.push(`    ${plugin.name}@${plugin.version} ${plugin.kind}/${plugin.tier}${command}${disabled}`);
  }
  lines.push(`  ghq (${ghq.repos.length} repos)`);
  for (const repo of ghq.repos) {
    const oracle = repo.oracleLike ? " oracle-like" : "";
    const worktree = repo.worktree ? " worktree" : "";
    lines.push(`    ${repo.name}${oracle}${worktree} -> ${repo.path}`);
  }
  for (const warning of [...result.warnings, ...live.warnings, ...plugins.warnings, ...ghq.warnings]) lines.push(`warning: ${warning}`);
  return lines.join("\n");
}

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  const args = cliArgs(ctx);
  const query = argsObject(ctx);
  const logs: string[] = [];
  const emit = (...values: unknown[]) => {
    if (ctx.writer) ctx.writer(...values);
    else logs.push(values.map(String).join(" "));
  };

  const peerSourceRaw = readOption(args, "--peers")
    ?? (typeof query.peers === "string" ? query.peers : undefined);
  const mode = parsePeerSourceMode(peerSourceRaw, "both");
  if (!mode) {
    return {
      ok: false,
      error: "invalid_peer_source",
      output: USAGE,
    };
  }

  const json = hasFlag(args, "--json", query.json);
  const tree = hasFlag(args, "--tree", query.tree);
  const awake = hasFlag(args, "--awake", query.awake);

  if (awake && !tree) {
    const live = await loadLiveRuntimeState();
    if (json) {
      emit(JSON.stringify({
        ok: true,
        mode,
        total: live.sessions.length,
        awakeOnly: true,
        peers: [],
        live: {
          source: live.source,
          total: live.total,
          sessions: live.sessions,
        },
        warnings: live.warnings,
      }, null, 2));
    } else {
      emit(renderLiveSessions(live));
    }
    return { ok: true, output: logs.join("\n") || undefined };
  }

  const result = await resolvePeerSources(loadConfig(), mode);
  const plugins = loadPluginRegistryState();
  const ghq = await loadGhqState();

  if (!tree && !awake) {
    emit(json ? JSON.stringify({
      ok: true,
      mode: result.mode,
      total: result.peers.length,
      peers: result.peers,
      plugins: {
        source: plugins.source,
        total: plugins.total,
        records: plugins.records,
      },
      ghq: {
        source: ghq.source,
        total: ghq.total,
        repos: ghq.repos,
      },
      warnings: [...result.warnings, ...plugins.warnings, ...ghq.warnings],
    }, null, 2) : renderDiscoverTable(result, plugins, ghq));
    return { ok: true, output: logs.join("\n") || undefined };
  }

  const live = await loadLiveRuntimeState();
  const warnings = [...result.warnings, ...live.warnings, ...plugins.warnings, ...ghq.warnings];

  if (json) {
    emit(JSON.stringify({
      ok: true,
      mode: result.mode,
      total: tree
        ? result.peers.length + live.sessions.length + plugins.records.length + ghq.repos.length
        : live.sessions.length,
      awakeOnly: awake,
      peers: tree ? result.peers : [],
      plugins: {
        source: plugins.source,
        total: plugins.total,
        records: tree ? plugins.records : [],
      },
      ghq: {
        source: ghq.source,
        total: ghq.total,
        repos: tree ? ghq.repos : [],
      },
      live: {
        source: live.source,
        total: live.total,
        sessions: live.sessions,
      },
      ...(tree ? { tree: { live: live.sessions, peers: result.peers, plugins: plugins.records, ghq: ghq.repos } } : {}),
      warnings,
    }, null, 2));
  } else {
    emit(tree ? renderDiscoverTree(result, live, plugins, ghq) : renderLiveSessions(live));
  }
  return { ok: true, output: logs.join("\n") || undefined };
}
