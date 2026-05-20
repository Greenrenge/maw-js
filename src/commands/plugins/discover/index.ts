import type { InvokeContext, InvokeResult } from "../../../plugin/types";
import { loadConfig } from "../../../config";
import { listSessions } from "../../../core/transport/ssh";
import type { Session } from "../../../core/runtime/find-window";
import { getRepos } from "../../../core/repo-discovery";
import { loadManifestCached } from "../../../lib/oracle-manifest";
import type { OracleManifestEntry, OracleManifestSource } from "../../../lib/oracle-manifest";
import { discoverPackages } from "../../../plugin/registry";
import type { LoadedPlugin } from "../../../plugin/types";
import { loadFleetEntries } from "../../shared/fleet-load";
import type { FleetEntry } from "../../shared/fleet-load";
import {
  formatPeerSources,
  type PeerTarget,
  type PeerSourceResult,
  parsePeerSourceMode,
  resolvePeerSources,
} from "../../shared/peer-sources";
import type { MawConfig } from "../../../config";

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

interface FleetConfigRecord {
  source: "fleet-config";
  type: "workspace";
  file: string;
  slot: number;
  groupName: string;
  session: string;
  name: string;
  repo?: string;
  node: string;
  endpoint?: string;
  peerMatched: boolean;
}

interface FleetConfigState {
  source: "fleet-config";
  total: number;
  records: FleetConfigRecord[];
  warnings: string[];
}

interface RegisteredOracleRecord {
  source: "oracle-manifest";
  type: "oracle";
  name: string;
  sources: OracleManifestSource[];
  node?: string;
  session?: string;
  window?: string;
  repo?: string;
  localPath?: string;
  sessionId?: string;
  hasPsi?: boolean;
  hasFleetConfig?: boolean;
  buddedFrom?: string | null;
  buddedAt?: string | null;
  born?: OracleManifestEntry["born"];
  awake: boolean;
  ghqPath?: string;
  worktree: boolean;
  fleetMatched: boolean;
  peerUrls: string[];
}

interface OracleRegistrationState {
  source: "oracle-manifest";
  total: number;
  records: RegisteredOracleRecord[];
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

function peerIdentityKeys(peer: PeerTarget): string[] {
  return [peer.name, peer.node, peer.oracle].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function endpointForNode(node: string, peers: PeerTarget[]): PeerTarget | undefined {
  return peers.find((peer) => peerIdentityKeys(peer).includes(node));
}

function fleetWindowNode(config: MawConfig, name: string): string {
  return config.agents?.[name] ?? config.node ?? "local";
}

function fleetRecord(config: MawConfig, entry: FleetEntry, window: { name?: string; repo?: string }, peers: PeerTarget[]): FleetConfigRecord | null {
  if (!window.name) return null;
  const node = fleetWindowNode(config, window.name);
  const peer = endpointForNode(node, peers);
  return {
    source: "fleet-config",
    type: "workspace",
    file: entry.file,
    slot: entry.num,
    groupName: entry.groupName,
    session: entry.session.name,
    name: window.name,
    repo: window.repo,
    node,
    endpoint: peer?.url,
    peerMatched: Boolean(peer),
  };
}

function loadFleetConfigState(config: MawConfig, peers: PeerTarget[]): FleetConfigState {
  try {
    const seen = new Set<string>();
    const records: FleetConfigRecord[] = [];
    for (const entry of loadFleetEntries()) {
      for (const window of entry.session.windows ?? []) {
        const record = fleetRecord(config, entry, window, peers);
        if (!record) continue;
        const key = `${record.node}\0${record.name}\0${record.repo ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push(record);
      }
    }
    return {
      source: "fleet-config",
      total: records.length,
      records,
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "fleet-config",
      total: 0,
      records: [],
      warnings: [`fleet config unavailable (${message})`],
    };
  }
}

function oracleNameVariants(name: string): string[] {
  return [name, `${name}-oracle`];
}

function ghqRecordMatchesOracle(repo: GhqRepoRecord, oracle: OracleManifestEntry): boolean {
  if (oracle.localPath && normalizeRepoPath(oracle.localPath).toLowerCase() === repo.path.toLowerCase()) return true;
  if (oracle.repo && `${repo.owner ?? ""}/${repo.name}`.toLowerCase() === oracle.repo.toLowerCase()) return true;
  return oracleNameVariants(oracle.name).some((variant) => repo.name.toLowerCase() === variant.toLowerCase());
}

function fleetRecordMatchesOracle(record: FleetConfigRecord, oracle: OracleManifestEntry): boolean {
  return oracleNameVariants(oracle.name).some((variant) => record.name === variant || record.session.endsWith(`-${variant}`));
}

function peerMatchesOracle(peer: PeerTarget, oracle: OracleManifestEntry): boolean {
  const variants = oracleNameVariants(oracle.name);
  return peerIdentityKeys(peer).some((key) => variants.includes(key) || key === oracle.name);
}

function liveMatchesOracle(live: LiveRuntimeState | undefined, oracle: OracleManifestEntry): boolean {
  if (!live) return oracle.isLive === true;
  for (const session of live.sessions) {
    if (oracle.session && session.name === oracle.session) return true;
    for (const window of session.windows) {
      if (oracle.window && window.name === oracle.window) return true;
      if (oracleNameVariants(oracle.name).includes(window.name)) return true;
    }
  }
  return oracle.isLive === true;
}

function registeredOracleRecord(
  oracle: OracleManifestEntry,
  ghq: GhqState,
  fleet: FleetConfigState,
  peers: PeerTarget[],
  live?: LiveRuntimeState,
): RegisteredOracleRecord {
  const ghqMatch = ghq.repos.find((repo) => ghqRecordMatchesOracle(repo, oracle));
  const peerUrls = peers.filter((peer) => peerMatchesOracle(peer, oracle)).map((peer) => peer.url);
  return {
    source: "oracle-manifest",
    type: "oracle",
    name: oracle.name,
    sources: oracle.sources,
    node: oracle.node,
    session: oracle.session,
    window: oracle.window,
    repo: oracle.repo,
    localPath: oracle.localPath,
    sessionId: oracle.sessionId,
    hasPsi: oracle.hasPsi,
    hasFleetConfig: oracle.hasFleetConfig,
    buddedFrom: oracle.buddedFrom,
    buddedAt: oracle.buddedAt,
    born: oracle.born,
    awake: liveMatchesOracle(live, oracle),
    ghqPath: ghqMatch?.path,
    worktree: ghqMatch?.worktree ?? false,
    fleetMatched: fleet.records.some((record) => fleetRecordMatchesOracle(record, oracle)),
    peerUrls: [...new Set(peerUrls)],
  };
}

function loadOracleRegistrationState(ghq: GhqState, fleet: FleetConfigState, peers: PeerTarget[], live?: LiveRuntimeState): OracleRegistrationState {
  try {
    const seen = new Set<string>();
    const records: RegisteredOracleRecord[] = [];
    for (const oracle of loadManifestCached()) {
      const key = oracle.name.toLowerCase();
      if (!oracle.name || seen.has(key)) continue;
      seen.add(key);
      records.push(registeredOracleRecord(oracle, ghq, fleet, peers, live));
    }
    return {
      source: "oracle-manifest",
      total: records.length,
      records,
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "oracle-manifest",
      total: 0,
      records: [],
      warnings: [`oracle registry unavailable (${message})`],
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

function renderFleetConfig(fleet: FleetConfigState): string {
  if (fleet.records.length === 0) return "no configured fleet workspaces";
  const header = ["node", "name", "session", "endpoint", "repo"];
  const rows = fleet.records.map((record) => [
    record.node,
    record.name,
    record.session,
    record.endpoint ?? "offline",
    record.repo ?? "-",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [fmt(header), fmt(widths.map((w) => "-".repeat(w))), ...rows.map(fmt)].join("\n");
}

function renderRegisteredOracles(oracles: OracleRegistrationState): string {
  if (oracles.records.length === 0) return "no registered oracles";
  const header = ["name", "node", "awake", "sources", "repo", "ghq"];
  const rows = oracles.records.map((oracle) => [
    oracle.name,
    oracle.node ?? "-",
    oracle.awake ? "yes" : "no",
    oracle.sources.join("+") || "-",
    oracle.repo ?? "-",
    oracle.ghqPath ?? "-",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [fmt(header), fmt(widths.map((w) => "-".repeat(w))), ...rows.map(fmt)].join("\n");
}

function renderDiscoverTable(result: PeerSourceResult, plugins: PluginRegistryState, ghq: GhqState, fleet: FleetConfigState, oracles: OracleRegistrationState): string {
  const chunks = [formatPeerSources(result)];
  if (oracles.records.length > 0) chunks.push(`registered oracles\n${renderRegisteredOracles(oracles)}`);
  if (fleet.records.length > 0) chunks.push(`fleet config\n${renderFleetConfig(fleet)}`);
  if (plugins.records.length > 0) chunks.push(`plugin registry\n${renderPluginRecords(plugins)}`);
  if (ghq.repos.length > 0) chunks.push(`ghq repos\n${renderGhqRepos(ghq)}`);
  for (const warning of oracles.warnings) chunks.push(`warning: ${warning}`);
  for (const warning of fleet.warnings) chunks.push(`warning: ${warning}`);
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

function renderDiscoverTree(
  result: PeerSourceResult,
  live: LiveRuntimeState,
  plugins: PluginRegistryState,
  ghq: GhqState,
  fleet: FleetConfigState,
  oracles: OracleRegistrationState,
): string {
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
  lines.push(`  fleet config (${fleet.records.length} configured)`);
  for (const record of fleet.records) {
    const endpoint = record.endpoint ? ` endpoint=${record.endpoint}` : " offline";
    const repo = record.repo ? ` repo=${record.repo}` : "";
    lines.push(`    ${record.node}/${record.name} ${record.session}${endpoint}${repo}`);
  }
  lines.push(`  registered oracles (${oracles.records.length})`);
  for (const oracle of oracles.records) {
    const awake = oracle.awake ? " awake" : "";
    const ghq = oracle.ghqPath ? ` ghq=${oracle.ghqPath}` : "";
    const repo = oracle.repo ? ` repo=${oracle.repo}` : "";
    lines.push(`    ${oracle.name}${awake} sources=${oracle.sources.join("+") || "-"}${repo}${ghq}`);
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
  for (const warning of [...result.warnings, ...live.warnings, ...fleet.warnings, ...oracles.warnings, ...plugins.warnings, ...ghq.warnings]) lines.push(`warning: ${warning}`);
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

  const config = loadConfig();
  const result = await resolvePeerSources(config, mode);
  const fleet = loadFleetConfigState(config, result.peers);
  const plugins = loadPluginRegistryState();
  const ghq = await loadGhqState();
  let oracles = loadOracleRegistrationState(ghq, fleet, result.peers);

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
      fleet: {
        source: fleet.source,
        total: fleet.total,
        records: fleet.records,
      },
      oracles: {
        source: oracles.source,
        total: oracles.total,
        records: oracles.records,
      },
      ghq: {
        source: ghq.source,
        total: ghq.total,
        repos: ghq.repos,
      },
      warnings: [...result.warnings, ...fleet.warnings, ...oracles.warnings, ...plugins.warnings, ...ghq.warnings],
    }, null, 2) : renderDiscoverTable(result, plugins, ghq, fleet, oracles));
    return { ok: true, output: logs.join("\n") || undefined };
  }

  const live = await loadLiveRuntimeState();
  oracles = loadOracleRegistrationState(ghq, fleet, result.peers, live);
  const warnings = [...result.warnings, ...live.warnings, ...fleet.warnings, ...oracles.warnings, ...plugins.warnings, ...ghq.warnings];

  if (json) {
    emit(JSON.stringify({
      ok: true,
      mode: result.mode,
      total: tree
        ? result.peers.length + live.sessions.length + fleet.records.length + oracles.records.length + plugins.records.length + ghq.repos.length
        : live.sessions.length,
      awakeOnly: awake,
      peers: tree ? result.peers : [],
      fleet: {
        source: fleet.source,
        total: fleet.total,
        records: tree ? fleet.records : [],
      },
      oracles: {
        source: oracles.source,
        total: oracles.total,
        records: tree ? oracles.records : [],
      },
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
      ...(tree ? { tree: { live: live.sessions, peers: result.peers, fleet: fleet.records, oracles: oracles.records, plugins: plugins.records, ghq: ghq.repos } } : {}),
      warnings,
    }, null, 2));
  } else {
    emit(tree ? renderDiscoverTree(result, live, plugins, ghq, fleet, oracles) : renderLiveSessions(live));
  }
  return { ok: true, output: logs.join("\n") || undefined };
}
