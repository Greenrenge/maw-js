import { writeSessionScript } from "../../config";
import { resolveOracle } from "./wake-resolve-impl";
import { normalizeTarget } from "../../core/matcher/normalize-target";
import { UserError } from "../../core/util/user-error";
import { readFileSync } from "fs";

export async function cmdShow(oracle: string): Promise<void> {
  if (!oracle) {
    console.error("usage: maw show <oracle>");
    throw new UserError("missing oracle name");
  }

  oracle = normalizeTarget(oracle);
  const { repoPath } = await resolveOracle(oracle);
  const windowName = `${oracle}-oracle`;

  const { getChannelPluginIds, getChannelEnv, getChannelPermissionMode } = await import("./channel-loader");
  const channelIds = getChannelPluginIds(oracle);
  const channelEnv = getChannelEnv(oracle);
  const permissionMode = getChannelPermissionMode(oracle);

  const opts = channelIds.length
    ? { channels: channelIds, channelEnv, permissionMode }
    : undefined;

  const scriptPath = writeSessionScript(windowName, repoPath, opts);
  process.stdout.write(readFileSync(scriptPath, "utf-8"));
}
