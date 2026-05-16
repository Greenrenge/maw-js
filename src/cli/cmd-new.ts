/**
 * `maw new` — shared workspace tmux session factory (#1616).
 *
 * Creates a named tmux session with a plain shell lead window. It does not
 * create, wake, bud, or awaken an oracle. Use it as the first step in a shared
 * workspace:
 *
 *   maw new my-project
 *   maw team oracle-invite volt odin --team my-project
 *   maw team bring my-project
 */

import { parseFlags } from "./parse-args";
import { UserError } from "../core/util/user-error";
import { tmux } from "../sdk";
import { attachToSession } from "../commands/shared/wake-session";

/** Truthy env values: "1", "true", "yes", "on" (case-insensitive). */
export function isTruthyEnv(v: string | undefined): boolean {
  if (!v) return false;
  const norm = v.toLowerCase();
  return norm === "1" || norm === "true" || norm === "yes" || norm === "on";
}

export interface NewWorkspaceAttachOpts {
  attach: boolean;
  noAttach: boolean;
  envNoPrompt: boolean;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}

export type NewWorkspaceAttachDecision =
  | { action: "attach"; reason: "attach-flag" | "interactive-tty" }
  | { action: "skip"; reason: "no-attach-flag" | "env-no-prompt" | "non-tty" };

/**
 * Pure attach/switch decision for `maw new`.
 *
 * Defaults are intentionally ergonomic but automation-safe:
 * - `--no-attach` and `MAW_NO_PROMPT=1` always print-only.
 * - `--attach` forces attach/switch.
 * - interactive shells attach/switch by default.
 * - non-TTY scripts print instructions instead of blocking on tmux attach.
 */
export function decideNewWorkspaceAttach(opts: NewWorkspaceAttachOpts): NewWorkspaceAttachDecision {
  if (opts.noAttach) return { action: "skip", reason: "no-attach-flag" };
  if (opts.envNoPrompt) return { action: "skip", reason: "env-no-prompt" };
  if (opts.attach) return { action: "attach", reason: "attach-flag" };
  if (opts.stdinIsTTY && opts.stdoutIsTTY) return { action: "attach", reason: "interactive-tty" };
  return { action: "skip", reason: "non-tty" };
}

export function validateWorkspaceSessionName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(name)) {
    throw new UserError(
      `new: invalid session name '${name}' — use letters, numbers, dot, underscore, or dash`,
    );
  }
  if (name.endsWith("-view")) {
    throw new UserError("new: session names ending in '-view' are reserved for maw view");
  }
}

function printUsage(write: (line: string) => void = console.log): void {
  write("usage: maw new <session-name> [--attach|-a] [--no-attach]");
  write("  Create a plain tmux workspace session with a lead shell window.");
  write("  Then bring oracles in with: maw team bring <team> [--session <session>]");
  write("  Oracle creation remains: maw awaken <name> (or maw bud <name>).");
}

/** Implementation of `maw new <name>` as a workspace/session factory. */
export async function cmdNew(argv: string[]): Promise<void> {
  const flags = parseFlags(argv, {
    "--attach": Boolean,
    "-a": "--attach",
    "--no-attach": Boolean,
  }, 0);

  const name = (flags._ as string[])[0];
  if (!name || name === "--help" || name === "-h") {
    printUsage(console.error);
    throw new UserError("new: missing session name");
  }
  if (name.startsWith("-")) {
    printUsage(console.error);
    throw new UserError(`new: invalid session name '${name}'`);
  }
  validateWorkspaceSessionName(name);

  const existed = await tmux.hasSession(name);
  if (!existed) {
    await tmux.newSession(name, { window: "lead", cwd: process.cwd() });
    console.log(`\x1b[32m✓\x1b[0m created workspace session '${name}' (lead shell)`);
  } else {
    console.log(`\x1b[36m→\x1b[0m session exists: ${name}`);
  }

  const decision = decideNewWorkspaceAttach({
    attach: !!flags["--attach"],
    noAttach: !!flags["--no-attach"],
    envNoPrompt: isTruthyEnv(process.env.MAW_NO_PROMPT),
    stdinIsTTY: !!process.stdin.isTTY,
    stdoutIsTTY: !!process.stdout.isTTY,
  });

  if (decision.action === "attach") {
    await attachToSession(name);
    return;
  }

  console.log(`\x1b[36mRun:\x1b[0m maw a ${name}`);
  console.log(`\x1b[90m  next: maw team bring ${name}\x1b[0m`);
}
