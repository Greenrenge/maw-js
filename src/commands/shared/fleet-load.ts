import { join } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";
import { FLEET_DIR, tmux } from "../../sdk";
import { fleetDirForWrite as coreFleetDirForWrite, fleetDirsForRead as coreFleetDirsForRead, uniqueDirs } from "../../core/fleet/paths";

export interface FleetWindow {
  name: string;
  repo: string;
}

export interface FleetSession {
  name: string;
  windows: FleetWindow[];
  skip_command?: boolean;
  /** Peer oracle names for soul-sync (flat, no hierarchy). */
  sync_peers?: string[];
  /** Project repos (org/repo) this oracle absorbs ψ/ from via `maw soul-sync --project`. */
  project_repos?: string[];
}

export interface FleetEntry {
  file: string;
  /** Absolute path of the config file that supplied this entry. */
  path?: string;
  num: number;
  groupName: string;
  session: FleetSession;
}

export function fleetDirsForRead(): string[] {
  return coreFleetDirsForRead({ legacyFleetDir: FLEET_DIR });
}

export function fleetDirForWrite(): string {
  return coreFleetDirForWrite();
}

function readFleetFiles(dirs: string[] = fleetDirsForRead()): Array<{ file: string; path: string }> {
  const byName = new Map<string, { file: string; path: string }>();
  for (const dir of uniqueDirs(dirs)) {
    if (!existsSync(dir)) continue;
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter(f => f.endsWith(".json") && !f.endsWith(".disabled"))
        .sort();
    } catch {
      continue;
    }
    for (const file of files) {
      if (!byName.has(file)) byName.set(file, { file, path: join(dir, file) });
    }
  }
  return [...byName.values()].sort((a, b) => a.file.localeCompare(b.file));
}

export function loadFleet(dirs: string[] = fleetDirsForRead()): FleetSession[] {
  return readFleetFiles(dirs).map(({ path }) => JSON.parse(readFileSync(path, "utf-8")) as FleetSession);
}


export function countDisabledFleetFiles(dirs: string[] = fleetDirsForRead()): number {
  const disabled = new Set<string>();
  for (const dir of uniqueDirs(dirs)) {
    if (!existsSync(dir)) continue;
    try {
      for (const file of readdirSync(dir)) {
        if (file.endsWith(".disabled")) disabled.add(file);
      }
    } catch {
      continue;
    }
  }
  return disabled.size;
}

export function loadFleetEntries(dirs: string[] = fleetDirsForRead()): FleetEntry[] {
  return readFleetFiles(dirs).map(({ file, path }) => {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    const match = file.match(/^(\d+)-(.+)\.json$/);
    return {
      file,
      path,
      num: match ? parseInt(match[1], 10) : 0,
      groupName: match ? match[2] : file.replace(".json", ""),
      session: raw as FleetSession,
    };
  });
}

export async function getSessionNames(): Promise<string[]> {
  try {
    const out = await tmux.run("list-sessions", "-F", "#{session_name}");
    return out.trim().split("\n").filter(Boolean);
  } catch { return []; }
}
