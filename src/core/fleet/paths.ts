import { FLEET_DIR } from "../paths";
import { mawStatePath } from "../xdg";

export function uniqueDirs(dirs: string[]): string[] {
  return [...new Set(dirs.filter(Boolean))];
}

export function fleetDirsForRead(): string[] {
  return uniqueDirs([mawStatePath("fleet"), FLEET_DIR]);
}

export function fleetDirForWrite(): string {
  return mawStatePath("fleet");
}

export function fleetDirsFromOverrides(fleetDir?: string, fleetDirs?: string[]): string[] {
  return fleetDirs?.length ? uniqueDirs(fleetDirs) : fleetDir ? [fleetDir] : fleetDirsForRead();
}
