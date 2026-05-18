# Coverage gap analysis

Generated: 2026-05-18T18:19:57.386Z

Input: `coverage/lcov.info`

Coverage scope: source-line-normalized Bun LCOV plus zero-coverage accounting for tracked `src/**/*.ts` files absent from LCOV.
Excluded from Bun LCOV accounting: non-Bun-runtime AssemblyScript sources compiled to WebAssembly and covered by AssemblyScript harness tests instead of Bun line instrumentation.

Overall line coverage: **98.3%** (36611/37235)
Overall function coverage: **94.5%** (4695/4968)

## Module summary

| Module | Files | Missing from LCOV | Lines | Functions | Branches |
| --- | ---: | ---: | ---: | ---: | ---: |
| cli/dispatch | 91 | 2 | 98.6% (6252/6340) | 94.0% (742/789) | n/a (0/0) |
| config/runtime | 19 | 0 | 99.0% (933/942) | 97.7% (130/133) | n/a (0/0) |
| fleet | 17 | 0 | 99.0% (778/786) | 99.0% (102/103) | n/a (0/0) |
| matcher | 3 | 0 | 100.0% (89/89) | 100.0% (18/18) | n/a (0/0) |
| other | 172 | 12 | 98.5% (10193/10350) | 94.2% (1337/1420) | n/a (0/0) |
| plugin dispatch | 15 | 1 | 99.2% (889/896) | 96.6% (86/89) | n/a (0/0) |
| routing/aliases | 4 | 0 | 98.6% (499/506) | 97.3% (73/75) | n/a (0/0) |
| transport | 28 | 0 | 99.6% (1880/1888) | 95.7% (422/441) | n/a (0/0) |
| vendor plugins | 245 | 7 | 97.8% (15098/15438) | 93.9% (1785/1900) | n/a (0/0) |

## Source handled outside Bun LCOV

| Source root | Files | Source lines | Reason |
| --- | ---: | ---: | --- |
| `src/wasm/examples/hello-as/assembly/` | 2 | 20 | AssemblyScript example source is compiled with asc to WebAssembly as a plugin template; Bun LCOV cannot map wasm execution back to these TypeScript-like sources. |
| `src/wasm/examples/hello-package/assembly/` | 2 | 44 | AssemblyScript packaged example source is compiled with asc to WebAssembly as a plugin template; Bun LCOV cannot map wasm execution back to these TypeScript-like sources. |
| `src/wasm/maw-plugin-sdk-assemblyscript/assembly/` | 5 | 232 | AssemblyScript SDK source is compiled with asc to WebAssembly; Bun LCOV cannot map wasm execution back to these TypeScript-like sources. |

## Top 20 uncovered files by executable/source line count

| Rank | Risk | Module | File | Uncovered | Line coverage | Function coverage | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | low | vendor plugins | `src/vendor/mpr-plugins/messages/index.ts` | 21 | 92.8% | 83.3% | partial coverage |
| 2 | medium | other | `src/commands/plugins/oracle/impl-prune.ts` | 12 | 90.1% | 80.0% | partial coverage |
| 3 | medium | other | `src/commands/plugins/tmux/impl.ts` | 12 | 97.6% | 81.1% | partial coverage |
| 4 | medium | other | `src/commands/plugins/team/ensure-config.ts` | 8 | 27.3% | 0.0% | partial coverage |
| 5 | critical | cli/dispatch | `src/commands/shared/fleet-load.ts` | 8 | 60.0% | 60.0% | partial coverage |
| 6 | low | vendor plugins | `src/vendor/mpr-plugins/doctor/internal/duplicate-detect.ts` | 8 | 75.0% | 60.0% | partial coverage |
| 7 | low | vendor plugins | `src/vendor/mpr-plugins/doctor/internal/stale-peers.ts` | 8 | 85.2% | 100.0% | partial coverage |
| 8 | low | vendor plugins | `src/vendor/mpr-plugins/inbox/impl.ts` | 8 | 95.6% | 100.0% | partial coverage |
| 9 | low | vendor plugins | `src/vendor/mpr-plugins/peers/probe.ts` | 8 | 93.1% | 85.7% | partial coverage |
| 10 | low | vendor plugins | `src/vendor/mpr-plugins/restart/impl.ts` | 8 | 89.5% | 100.0% | partial coverage |
| 11 | low | vendor plugins | `src/vendor/mpr-plugins/team/team-lifecycle.ts` | 8 | 95.1% | 100.0% | partial coverage |
| 12 | critical | cli/dispatch | `src/cli/command-registry-wasm.ts` | 7 | 87.5% | 50.0% | partial coverage |
| 13 | medium | other | `src/commands/plugins/team/team-lifecycle.ts` | 7 | 96.3% | 94.4% | partial coverage |
| 14 | critical | cli/dispatch | `src/commands/shared/wake-cmd.ts` | 7 | 98.5% | 79.1% | partial coverage |
| 15 | critical | cli/dispatch | `src/commands/shared/wake-target.ts` | 7 | 76.7% | 80.0% | partial coverage |
| 16 | low | vendor plugins | `src/vendor/mpr-plugins/panes/impl.ts` | 7 | 89.2% | 100.0% | partial coverage |
| 17 | low | vendor plugins | `src/vendor/mpr-plugins/ping/impl.ts` | 7 | 82.9% | 100.0% | partial coverage |
| 18 | low | vendor plugins | `src/vendor/mpr-plugins/wake/index.ts` | 7 | 95.3% | 83.3% | partial coverage |
| 19 | low | vendor plugins | `src/vendor/mpr-plugins/whoami/impl.ts` | 7 | 0.0% | n/a | absent from LCOV |
| 20 | medium | other | `src/cli.ts` | 6 | 85.0% | 100.0% | partial coverage |

## Critical files at or above the 80% line target

| Module | File | Line coverage | Function coverage |
| --- | --- | ---: | ---: |
| cli/dispatch | `src/cli/auto-restore.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/cmd-new.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/cmd-update.ts` | 100.0% | 95.0% |
| cli/dispatch | `src/cli/cmd-version.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-execute.ts` | 100.0% | 83.3% |
| cli/dispatch | `src/cli/command-registry-match.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-types.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-wasm.ts` | 87.5% | 50.0% |
| cli/dispatch | `src/cli/command-registry.ts` | 96.4% | 100.0% |
| cli/dispatch | `src/cli/dispatch-match.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/dispatch.ts` | 100.0% | 92.9% |
| cli/dispatch | `src/cli/error-handler.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/instance-pid.ts` | 96.2% | 84.2% |
| cli/dispatch | `src/cli/instance-preset.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/parse-args.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/plugin-bootstrap.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/update-lock.ts` | 100.0% | 71.4% |
| cli/dispatch | `src/cli/usage.ts` | 95.3% | 92.9% |
| cli/dispatch | `src/cli/verbosity.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/wasm-bridge.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/agents.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/artifacts.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/audit.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-list.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-log-feed.ts` | 100.0% | 83.3% |
| cli/dispatch | `src/commands/shared/comm-peek.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-send.ts` | 99.5% | 94.4% |
| cli/dispatch | `src/commands/shared/comm.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/context-limit.ts` | 96.2% | 81.8% |
| cli/dispatch | `src/commands/shared/done.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-apply.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-diff.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-fetch.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-identity.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-sync-cli.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-sync.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-checks-repo.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-checks.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-fixer.ts` | 95.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-stale-peers.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-manage.ts` | 98.8% | 96.8% |
| cli/dispatch | `src/commands/shared/fleet-resume.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-sync.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-validate.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-wake-failsoft.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pane-target-resolver.ts` | 94.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-as.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-cmd.ts` | 96.3% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-rust.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-scaffold.ts` | 87.2% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-install.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-ls-info.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-profile.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-toggle.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-ui.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/preflight.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pulse-cmd.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pulse-thread.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/queue-store.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/receiver-inbox.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/scan-signals.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/scope-acl.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/should-auto-wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/target-cwd.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/transport.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/triggers.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-cmd-helpers.ts` | 95.5% | 90.9% |
| cli/dispatch | `src/commands/shared/wake-cmd.ts` | 98.5% | 79.1% |
| cli/dispatch | `src/commands/shared/wake-concurrency.ts` | 94.1% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-maybe-split.ts` | 98.4% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-resolve-github.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-resolve-impl.ts` | 99.4% | 79.2% |
| cli/dispatch | `src/commands/shared/wake-resolve-scan-suggest.ts` | 97.4% | 88.9% |
| cli/dispatch | `src/commands/shared/wake-resolve.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-session.ts` | 100.0% | 86.7% |
| cli/dispatch | `src/commands/shared/wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-agents.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-lifecycle.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-query.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-store.ts` | 95.1% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/audit.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/claude-sessions.ts` | 98.6% | 94.7% |
| fleet | `src/core/fleet/leaf.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/nicknames.ts` | 98.4% | 100.0% |
| fleet | `src/core/fleet/oracle-registry.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-cache.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-orchestrate.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-scan-local.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-scan-remote.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-types.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/snapshot.ts` | 91.8% | 100.0% |
| fleet | `src/core/fleet/tab-order.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/validate.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/worktree-window-match.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/worktrees-cleanup.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/worktrees-scan.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/worktrees.ts` | 100.0% | 100.0% |
| matcher | `src/core/matcher/channel-session.ts` | 100.0% | 100.0% |
| matcher | `src/core/matcher/normalize-target.ts` | 100.0% | 100.0% |
| matcher | `src/core/matcher/resolve-target.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/cap-infer-ast.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/default-active.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/dependencies.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/lifecycle.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest-constants.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest-load.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest-parse.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest-validate.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/registry-helpers.ts` | 93.7% | 88.9% |
| plugin dispatch | `src/plugin/registry-invoke.ts` | 100.0% | 83.3% |
| plugin dispatch | `src/plugin/registry-semver.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/registry.ts` | 99.0% | 100.0% |
| plugin dispatch | `src/plugin/tier.ts` | 100.0% | 100.0% |
| routing/aliases | `src/cli/route-comm.ts` | 85.0% | 100.0% |
| routing/aliases | `src/cli/route-tools.ts` | 100.0% | 100.0% |
| routing/aliases | `src/cli/top-aliases.ts` | 99.4% | 100.0% |
| routing/aliases | `src/core/routing.ts` | 100.0% | 92.0% |
| transport | `src/core/transport/curl-fetch.ts` | 100.0% | 85.7% |
| transport | `src/core/transport/mqtt-publish.ts` | 100.0% | 66.7% |
| transport | `src/core/transport/peers.ts` | 100.0% | 100.0% |
| transport | `src/core/transport/pty.ts` | 100.0% | 100.0% |
| transport | `src/core/transport/ssh.ts` | 100.0% | 95.5% |
| transport | `src/core/transport/tmux-class.ts` | 100.0% | 97.5% |
| transport | `src/core/transport/tmux-pane-lock.ts` | 100.0% | 87.5% |
| transport | `src/core/transport/tmux-pane-tags.ts` | 100.0% | 100.0% |
| transport | `src/core/transport/tmux-types.ts` | 80.0% | 66.7% |
| transport | `src/core/transport/tmux.ts` | 100.0% | 100.0% |
| transport | `src/core/transport/transport.ts` | 100.0% | 96.4% |
| transport | `src/transports/http.ts` | 100.0% | 100.0% |
| transport | `src/transports/hub-config.ts` | 89.2% | 100.0% |
| transport | `src/transports/hub-connection.ts` | 99.2% | 93.8% |
| transport | `src/transports/hub-transport.ts` | 98.9% | 92.0% |
| transport | `src/transports/hub.ts` | 100.0% | 100.0% |
| transport | `src/transports/index.ts` | 100.0% | 58.3% |
| transport | `src/transports/lora.ts` | 100.0% | 90.9% |
| transport | `src/transports/mdns.ts` | 100.0% | 100.0% |
| transport | `src/transports/nanoclaw.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout-pair-proof.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout-pair.ts` | 100.0% | 50.0% |
| transport | `src/transports/scout-protocol.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout-state.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout.ts` | 100.0% | 100.0% |
| transport | `src/transports/tmux.ts` | 100.0% | 100.0% |
| transport | `src/transports/zenoh-scout.ts` | 100.0% | 100.0% |
| transport | `src/transports/zenoh.ts` | 100.0% | 100.0% |

## Critical files below the 80% line target (next queue)

| Module | File | Uncovered | Line coverage |
| --- | --- | ---: | ---: |
| cli/dispatch | `src/commands/shared/fleet-load.ts` | 8 | 60.0% |
| cli/dispatch | `src/commands/shared/wake-target.ts` | 7 | 76.7% |
| cli/dispatch | `src/commands/shared/wake-pane-size.ts` | 5 | 44.4% |
| cli/dispatch | `src/commands/shared/fleet.ts` | 4 | 0.0% |
| cli/dispatch | `src/commands/shared/pulse.ts` | 2 | 0.0% |
| plugin dispatch | `src/plugin/types.ts` | 2 | 0.0% |

## Critical gaps to prioritize

- `src/commands/shared/fleet-load.ts` (cli/dispatch): 8 uncovered lines, 60.0% line coverage.
- `src/cli/command-registry-wasm.ts` (cli/dispatch): 7 uncovered lines, 87.5% line coverage.
- `src/commands/shared/wake-cmd.ts` (cli/dispatch): 7 uncovered lines, 98.5% line coverage.
- `src/commands/shared/wake-target.ts` (cli/dispatch): 7 uncovered lines, 76.7% line coverage.

## Prioritization guidance

- High-signal gaps likely to catch real bugs: wake/bring dispatch (`wake-cmd.ts`, `wake-resolve-impl.ts`), message delivery/routing (`comm-send.ts`, `routing.ts`), tmux transport primitives (`tmux-class.ts`), peer discovery transports (`scout.ts`, `mdns.ts`), plugin invocation (`registry-invoke.ts`), and worktree/fleet scans (`worktrees-scan.ts`).
- Lower-signal/ceremony gaps: large vendored MPR plugin implementations, UI/cosmetic renderers, and plugin bodies where behavior is better covered by CLI smoke tests or end-to-end plugin tests.
- Portable-core candidates for #1612 fixture extraction: matcher, routing alias guards, calver, plugin tier/default-active policy, and pure transport-router selection/failover.

## Notes

- Critical = routing/aliases, CLI dispatch, transports, fleet, matcher, and plugin dispatch.
- Low-risk = vendor plugin surfaces and UI/cosmetic code where smoke/manual tests often provide better value than line-driven unit tests.
- Bun DA entries are source-line-normalized to ignore comments, syntactic separators, and type-only declarations that cannot be exercised at runtime.
- Files absent from LCOV are counted as zero-covered using the same source-line normalization so the report exposes untouched modules, not only imported files.
- AssemblyScript sources under `src/wasm/maw-plugin-sdk-assemblyscript/assembly/` and `src/wasm/examples/*/assembly/` are not counted as zero-covered Bun TypeScript because their runtime is asc-compiled WebAssembly. Keep covering them with AssemblyScript wasm harness tests and compiler checks.
