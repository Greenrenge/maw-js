import { isUserError } from "../core/util/user-error";
import { AmbiguousMatchError } from "../core/runtime/find-window";
import { HostExecError } from "../core/transport/ssh";
import { renderAmbiguousMatch } from "../core/util/render-ambiguous";

/**
 * Top-level error handler for `main()`. Always exits — never returns.
 *
 * - UserError: output already printed at throw site, exit 1 silently
 *   (no bun stack trace).
 * - AmbiguousMatchError: escapes from findWindow via resolver chains
 *   (cmdSend, cmdPeek, talk-to, view, etc.). Render as actionable CLI
 *   output instead of a minified stack trace.
 * - HostExecError: transport-level failure (duplicate session, SSH error).
 *   Print clean message, not minified stack (#1187).
 * - Anything else: print the error normally and exit 1.
 */
export function handleTopLevelError(e: unknown, args: string[]): never {
  if (isUserError(e)) {
    process.exit(1);
  }
  if (e instanceof AmbiguousMatchError) {
    console.error(renderAmbiguousMatch(e, args));
    process.exit(1);
  }
  if (e instanceof HostExecError) {
    console.error(`\x1b[31merror\x1b[0m: ${e.underlying.message}`);
    process.exit(e.exitCode ?? 1);
  }
  console.error(e);
  process.exit(1);
}
