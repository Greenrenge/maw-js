# Coverage gap analysis

Generated: 2026-05-18T10:20:23.028Z

Input: `coverage/lcov.info`

Coverage scope: Bun LCOV plus zero-coverage accounting for tracked `src/**/*.ts` files absent from LCOV.

Overall line coverage: **71.8%** (36565/50959)
Overall function coverage: **90.0%** (3769/4187)

## Module summary

| Module | Files | Missing from LCOV | Lines | Functions | Branches |
| --- | ---: | ---: | ---: | ---: | ---: |
| cli/dispatch | 91 | 7 | 80.9% (6886/8509) | 90.6% (688/759) | n/a (0/0) |
| config/runtime | 19 | 1 | 68.8% (943/1371) | 76.6% (82/107) | n/a (0/0) |
| fleet | 17 | 0 | 79.4% (911/1148) | 93.1% (94/101) | n/a (0/0) |
| matcher | 2 | 0 | 73.6% (89/121) | 100.0% (15/15) | n/a (0/0) |
| other | 181 | 40 | 76.2% (11145/14627) | 87.2% (1104/1266) | n/a (0/0) |
| plugin dispatch | 15 | 1 | 80.7% (1077/1334) | 95.5% (85/89) | n/a (0/0) |
| routing/aliases | 4 | 0 | 83.2% (637/766) | 97.3% (71/73) | n/a (0/0) |
| transport | 28 | 1 | 80.4% (2365/2942) | 95.7% (419/438) | n/a (0/0) |
| vendor plugins | 245 | 121 | 62.1% (12512/20141) | 90.4% (1211/1339) | n/a (0/0) |

## Top 20 uncovered files by executable/source line count

| Rank | Risk | Module | File | Uncovered | Line coverage | Function coverage | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | critical | transport | `src/core/transport/tmux-class.ts` | 166 | 54.5% | 96.3% | partial coverage |
| 2 | low | vendor plugins | `src/vendor/mpr-plugins/dream/impl.ts` | 157 | 82.8% | 97.2% | partial coverage |
| 3 | medium | other | `src/wasm/maw-plugin-sdk-assemblyscript/assembly/api.ts` | 143 | 0.0% | n/a | absent from LCOV |
| 4 | critical | cli/dispatch | `src/commands/shared/comm-send.ts` | 139 | 78.5% | 94.4% | partial coverage |
| 5 | medium | other | `src/commands/plugins/plugin/install-handlers.ts` | 120 | 72.6% | 100.0% | partial coverage |
| 6 | critical | cli/dispatch | `src/commands/shared/wake-cmd.ts` | 115 | 81.3% | 78.0% | partial coverage |
| 7 | medium | other | `src/commands/plugins/tmux/impl.ts` | 112 | 83.2% | 70.6% | partial coverage |
| 8 | critical | cli/dispatch | `src/commands/shared/wake-resolve-impl.ts` | 105 | 76.7% | 80.0% | partial coverage |
| 9 | low | vendor plugins | `src/vendor/mpr-plugins/token/lib.ts` | 98 | 52.9% | 100.0% | partial coverage |
| 10 | medium | other | `src/wasm/maw-plugin-sdk-assemblyscript/assembly/memory.ts` | 96 | 0.0% | n/a | absent from LCOV |
| 11 | critical | cli/dispatch | `src/cli/cmd-update.ts` | 94 | 78.4% | 90.0% | partial coverage |
| 12 | medium | other | `src/lib/federation-auth.ts` | 93 | 69.9% | 76.2% | partial coverage |
| 13 | low | vendor plugins | `src/vendor/mpr-plugins/bg/src/index.ts` | 87 | 20.9% | 27.3% | partial coverage |
| 14 | low | vendor plugins | `src/vendor/mpr-plugins/team/impl.ts` | 87 | 13.0% | 0.0% | partial coverage |
| 15 | critical | plugin dispatch | `src/plugin/types.ts` | 86 | 0.0% | n/a | absent from LCOV |
| 16 | low | vendor plugins | `src/vendor/mpr-plugins/bud/smart-default-org.ts` | 83 | 0.0% | n/a | absent from LCOV |
| 17 | medium | other | `src/commands/plugins/oracle/impl-scan.ts` | 82 | 4.7% | 0.0% | partial coverage |
| 18 | low | vendor plugins | `src/vendor/mpr-plugins/doctor/impl.ts` | 82 | 74.2% | 70.8% | partial coverage |
| 19 | low | vendor plugins | `src/vendor/mpr-plugins/incubate/impl.ts` | 81 | 0.0% | n/a | absent from LCOV |
| 20 | medium | other | `src/lib/peers/impl.ts` | 80 | 62.3% | 66.7% | partial coverage |

## Critical files at or above the 80% line target

| Module | File | Line coverage | Function coverage |
| --- | --- | ---: | ---: |
| cli/dispatch | `src/cli/cmd-version.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-match.ts` | 91.7% | 100.0% |
| cli/dispatch | `src/cli/command-registry-types.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry.ts` | 90.6% | 100.0% |
| cli/dispatch | `src/cli/dispatch-match.ts` | 85.3% | 90.0% |
| cli/dispatch | `src/cli/dispatch.ts` | 93.4% | 85.7% |
| cli/dispatch | `src/cli/instance-pid.ts` | 88.3% | 84.2% |
| cli/dispatch | `src/cli/parse-args.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/update-lock.ts` | 82.9% | 71.4% |
| cli/dispatch | `src/cli/usage.ts` | 95.8% | 92.9% |
| cli/dispatch | `src/commands/shared/artifacts.ts` | 80.3% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-list.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-log-feed.ts` | 80.6% | 80.0% |
| cli/dispatch | `src/commands/shared/comm-peek.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/context-limit.ts` | 91.5% | 81.8% |
| cli/dispatch | `src/commands/shared/done.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-apply.ts` | 86.7% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-diff.ts` | 83.3% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-fetch.ts` | 97.8% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-identity.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-sync-cli.ts` | 86.7% | 100.0% |
| cli/dispatch | `src/commands/shared/federation-sync.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/federation.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-checks-repo.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-checks.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-fixer.ts` | 88.4% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-stale-peers.ts` | 97.3% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor.ts` | 86.8% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-manage.ts` | 84.5% | 96.8% |
| cli/dispatch | `src/commands/shared/fleet-resume.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-validate.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-wake-failsoft.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-wake.ts` | 96.4% | 100.0% |
| cli/dispatch | `src/commands/shared/pane-target-resolver.ts` | 83.3% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-as.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-rust.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-scaffold.ts` | 82.7% | 75.0% |
| cli/dispatch | `src/commands/shared/plugin-create.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-ls-info.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-profile.ts` | 82.4% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-toggle.ts` | 89.5% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-ui.ts` | 86.2% | 100.0% |
| cli/dispatch | `src/commands/shared/preflight.ts` | 82.8% | 100.0% |
| cli/dispatch | `src/commands/shared/pulse-cmd.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pulse-thread.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/queue-store.ts` | 91.6% | 100.0% |
| cli/dispatch | `src/commands/shared/receiver-inbox.ts` | 86.9% | 100.0% |
| cli/dispatch | `src/commands/shared/scan-signals.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/target-cwd.ts` | 85.2% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-cmd-helpers.ts` | 84.6% | 90.9% |
| cli/dispatch | `src/commands/shared/wake-cmd.ts` | 81.3% | 78.0% |
| cli/dispatch | `src/commands/shared/wake-concurrency.ts` | 94.7% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-maybe-split.ts` | 95.7% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-resolve.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-session.ts` | 92.7% | 86.7% |
| cli/dispatch | `src/commands/shared/wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-agents.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-lifecycle.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-query.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-store.ts` | 94.4% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/claude-sessions.ts` | 92.4% | 94.7% |
| fleet | `src/core/fleet/leaf.ts` | 89.7% | 100.0% |
| fleet | `src/core/fleet/nicknames.ts` | 94.6% | 100.0% |
| fleet | `src/core/fleet/oracle-registry.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-scan-local.ts` | 86.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-types.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/validate.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/worktree-window-match.ts` | 92.3% | 100.0% |
| fleet | `src/core/fleet/worktrees-cleanup.ts` | 80.2% | 100.0% |
| fleet | `src/core/fleet/worktrees.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/cap-infer-ast.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/default-active.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/dependencies.ts` | 88.9% | 100.0% |
| plugin dispatch | `src/plugin/lifecycle.ts` | 91.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest-constants.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/manifest-parse.ts` | 82.8% | 100.0% |
| plugin dispatch | `src/plugin/manifest-validate.ts` | 98.6% | 100.0% |
| plugin dispatch | `src/plugin/manifest.ts` | 100.0% | 100.0% |
| plugin dispatch | `src/plugin/registry-helpers.ts` | 92.5% | 88.9% |
| plugin dispatch | `src/plugin/registry-semver.ts` | 90.7% | 100.0% |
| plugin dispatch | `src/plugin/tier.ts` | 100.0% | 100.0% |
| routing/aliases | `src/cli/route-comm.ts` | 86.7% | 100.0% |
| routing/aliases | `src/cli/route-tools.ts` | 99.5% | 100.0% |
| transport | `src/core/transport/peers.ts` | 84.4% | 100.0% |
| transport | `src/core/transport/pty.ts` | 100.0% | 100.0% |
| transport | `src/core/transport/ssh.ts` | 91.8% | 95.5% |
| transport | `src/core/transport/tmux-pane-lock.ts` | 100.0% | 87.5% |
| transport | `src/core/transport/tmux-pane-tags.ts` | 100.0% | 100.0% |
| transport | `src/core/transport/tmux.ts` | 100.0% | 100.0% |
| transport | `src/transports/hub-connection.ts` | 89.5% | 93.8% |
| transport | `src/transports/hub-transport.ts` | 80.9% | 92.0% |
| transport | `src/transports/hub.ts` | 100.0% | 100.0% |
| transport | `src/transports/index.ts` | 82.0% | 58.3% |
| transport | `src/transports/mdns.ts` | 86.9% | 100.0% |
| transport | `src/transports/nanoclaw.ts` | 80.8% | 100.0% |
| transport | `src/transports/scout-pair-proof.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout-protocol.ts` | 82.5% | 100.0% |
| transport | `src/transports/scout-state.ts` | 91.6% | 100.0% |
| transport | `src/transports/scout.ts` | 85.2% | 100.0% |
| transport | `src/transports/zenoh-scout.ts` | 83.8% | 100.0% |
| transport | `src/transports/zenoh.ts` | 100.0% | 100.0% |

## Critical files below the 80% line target (next queue)

| Module | File | Uncovered | Line coverage |
| --- | --- | ---: | ---: |
| transport | `src/core/transport/tmux-class.ts` | 166 | 54.5% |
| cli/dispatch | `src/commands/shared/comm-send.ts` | 139 | 78.5% |
| cli/dispatch | `src/commands/shared/wake-resolve-impl.ts` | 105 | 76.7% |
| cli/dispatch | `src/cli/cmd-update.ts` | 94 | 78.4% |
| plugin dispatch | `src/plugin/types.ts` | 86 | 0.0% |
| cli/dispatch | `src/commands/shared/wake-resolve-scan-suggest.ts` | 74 | 64.3% |
| plugin dispatch | `src/plugin/registry-invoke.ts` | 68 | 68.4% |
| cli/dispatch | `src/commands/shared/agents.ts` | 65 | 33.7% |
| cli/dispatch | `src/commands/shared/triggers.ts` | 65 | 0.0% |
| routing/aliases | `src/core/routing.ts` | 62 | 73.7% |

## Critical gaps to prioritize

- `src/core/transport/tmux-class.ts` (transport): 166 uncovered lines, 54.5% line coverage.
- `src/commands/shared/comm-send.ts` (cli/dispatch): 139 uncovered lines, 78.5% line coverage.
- `src/commands/shared/wake-cmd.ts` (cli/dispatch): 115 uncovered lines, 81.3% line coverage.
- `src/commands/shared/wake-resolve-impl.ts` (cli/dispatch): 105 uncovered lines, 76.7% line coverage.
- `src/cli/cmd-update.ts` (cli/dispatch): 94 uncovered lines, 78.4% line coverage.
- `src/plugin/types.ts` (plugin dispatch): 86 uncovered lines, 0.0% line coverage.

## Prioritization guidance

- High-signal gaps likely to catch real bugs: wake/bring dispatch (`wake-cmd.ts`, `wake-resolve-impl.ts`), message delivery/routing (`comm-send.ts`, `routing.ts`), tmux transport primitives (`tmux-class.ts`), peer discovery transports (`scout.ts`, `mdns.ts`), plugin invocation (`registry-invoke.ts`), and worktree/fleet scans (`worktrees-scan.ts`).
- Lower-signal/ceremony gaps: large vendored MPR plugin implementations, UI/cosmetic renderers, and plugin bodies where behavior is better covered by CLI smoke tests or end-to-end plugin tests.
- Portable-core candidates for #1612 fixture extraction: matcher, routing alias guards, calver, plugin tier/default-active policy, and pure transport-router selection/failover.

## Notes

- Critical = routing/aliases, CLI dispatch, transports, fleet, matcher, and plugin dispatch.
- Low-risk = vendor plugin surfaces and UI/cosmetic code where smoke/manual tests often provide better value than line-driven unit tests.
- Files absent from LCOV are counted as zero-covered using non-empty/non-comment source lines so the report exposes untouched modules, not only imported files.
