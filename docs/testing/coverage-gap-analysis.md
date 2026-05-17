# Coverage gap analysis

Generated: 2026-05-17T20:31:56.969Z

Input: `coverage/lcov.info`

Coverage scope: Bun LCOV plus zero-coverage accounting for tracked `src/**/*.ts` files absent from LCOV.

Overall line coverage: **48.5%** (25049/51697)
Overall function coverage: **86.2%** (2738/3178)

## Module summary

| Module | Files | Missing from LCOV | Lines | Functions | Branches |
| --- | ---: | ---: | ---: | ---: | ---: |
| cli/dispatch | 91 | 8 | 77.0% (6317/8202) | 90.5% (660/729) | n/a (0/0) |
| config/runtime | 19 | 1 | 60.9% (833/1368) | 68.2% (73/107) | n/a (0/0) |
| fleet | 17 | 0 | 70.1% (788/1124) | 88.8% (79/89) | n/a (0/0) |
| matcher | 2 | 0 | 61.2% (41/67) | 100.0% (8/8) | n/a (0/0) |
| other | 180 | 52 | 62.6% (9093/14515) | 82.9% (922/1112) | n/a (0/0) |
| plugin dispatch | 15 | 1 | 81.1% (1082/1334) | 95.5% (85/89) | n/a (0/0) |
| routing/aliases | 4 | 0 | 83.2% (635/763) | 97.3% (71/73) | n/a (0/0) |
| transport | 28 | 1 | 78.8% (2317/2941) | 95.7% (418/437) | n/a (0/0) |
| vendor plugins | 245 | 209 | 18.4% (3943/21383) | 79.0% (422/534) | n/a (0/0) |

## Top 20 uncovered files by executable/source line count

| Rank | Risk | Module | File | Uncovered | Line coverage | Function coverage | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | low | vendor plugins | `src/vendor/mpr-plugins/pair/internal/probe.ts` | 200 | 0.0% | n/a | absent from LCOV |
| 2 | low | vendor plugins | `src/vendor/mpr-plugins/peers/probe.ts` | 200 | 0.0% | n/a | absent from LCOV |
| 3 | low | vendor plugins | `src/vendor/mpr-plugins/peers/impl.ts` | 199 | 0.0% | n/a | absent from LCOV |
| 4 | low | vendor plugins | `src/vendor/mpr-plugins/bud/from-repo.ts` | 198 | 0.0% | n/a | absent from LCOV |
| 5 | low | vendor plugins | `src/vendor/mpr-plugins/demo/impl.ts` | 198 | 0.0% | n/a | absent from LCOV |
| 6 | low | vendor plugins | `src/vendor/mpr-plugins/completions/impl.ts` | 185 | 0.0% | n/a | absent from LCOV |
| 7 | medium | config/runtime | `src/config/load.ts` | 179 | 37.4% | 47.6% | partial coverage |
| 8 | low | vendor plugins | `src/vendor/mpr-plugins/pair/internal/peers-impl.ts` | 179 | 0.0% | n/a | absent from LCOV |
| 9 | low | vendor plugins | `src/vendor/mpr-plugins/team/index.ts` | 178 | 41.8% | 33.3% | partial coverage |
| 10 | low | vendor plugins | `src/vendor/mpr-plugins/wake/index.ts` | 177 | 0.0% | n/a | absent from LCOV |
| 11 | medium | other | `src/commands/plugins/plugin/index.ts` | 174 | 15.1% | 30.0% | partial coverage |
| 12 | low | vendor plugins | `src/vendor/mpr-plugins/find/impl.ts` | 174 | 0.0% | n/a | absent from LCOV |
| 13 | critical | transport | `src/core/transport/tmux-class.ts` | 171 | 53.2% | 96.3% | partial coverage |
| 14 | critical | cli/dispatch | `src/commands/shared/wake-cmd.ts` | 170 | 66.1% | 78.8% | partial coverage |
| 15 | low | vendor plugins | `src/vendor/mpr-plugins/zenoh-scout/index.ts` | 169 | 0.0% | n/a | absent from LCOV |
| 16 | low | vendor plugins | `src/vendor/mpr-plugins/dream/impl.ts` | 160 | 82.4% | 92.6% | partial coverage |
| 17 | medium | other | `src/commands/plugins/tmux/impl.ts` | 159 | 75.5% | 68.2% | partial coverage |
| 18 | low | vendor plugins | `src/vendor/mpr-plugins/tab/internal/talk-to-impl.ts` | 155 | 0.0% | n/a | absent from LCOV |
| 19 | low | vendor plugins | `src/vendor/mpr-plugins/talk-to/impl.ts` | 155 | 0.0% | n/a | absent from LCOV |
| 20 | medium | other | `src/lib/peers/probe.ts` | 153 | 26.4% | 50.0% | partial coverage |

## Critical files at or above the 80% line target

| Module | File | Line coverage | Function coverage |
| --- | --- | ---: | ---: |
| cli/dispatch | `src/cli/cmd-version.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-match.ts` | 91.7% | 100.0% |
| cli/dispatch | `src/cli/command-registry-types.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry.ts` | 90.6% | 100.0% |
| cli/dispatch | `src/cli/dispatch-match.ts` | 85.3% | 90.0% |
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
| cli/dispatch | `src/commands/shared/fleet-doctor-fixer.ts` | 96.2% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor-stale-peers.ts` | 97.3% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-doctor.ts` | 86.8% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-manage.ts` | 83.8% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-resume.ts` | 100.0% | 100.0% |
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
| cli/dispatch | `src/commands/shared/wake-cmd-helpers.ts` | 88.4% | 90.9% |
| cli/dispatch | `src/commands/shared/wake-concurrency.ts` | 94.7% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-maybe-split.ts` | 96.8% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-resolve.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-session.ts` | 93.3% | 92.9% |
| cli/dispatch | `src/commands/shared/wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-agents.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-lifecycle.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-query.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-store.ts` | 94.4% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/claude-sessions.ts` | 100.0% | 94.4% |
| fleet | `src/core/fleet/leaf.ts` | 89.7% | 100.0% |
| fleet | `src/core/fleet/nicknames.ts` | 94.6% | 100.0% |
| fleet | `src/core/fleet/oracle-registry.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-scan-local.ts` | 86.0% | 100.0% |
| fleet | `src/core/fleet/registry-oracle-types.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/validate.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/worktree-window-match.ts` | 92.3% | 100.0% |
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
| transport | `src/core/transport/tmux-class.ts` | 171 | 53.2% |
| cli/dispatch | `src/commands/shared/wake-cmd.ts` | 170 | 66.1% |
| cli/dispatch | `src/commands/shared/comm-send.ts` | 149 | 77.0% |
| cli/dispatch | `src/cli/cmd-update.ts` | 148 | 65.9% |
| transport | `src/core/transport/curl-fetch.ts` | 101 | 45.7% |
| cli/dispatch | `src/cli/dispatch.ts` | 95 | 47.5% |
| fleet | `src/core/fleet/worktrees-cleanup.ts` | 88 | 7.4% |
| plugin dispatch | `src/plugin/types.ts` | 86 | 0.0% |
| cli/dispatch | `src/commands/shared/wake-resolve-impl.ts` | 85 | 78.3% |
| cli/dispatch | `src/commands/shared/wake-resolve-scan-suggest.ts` | 74 | 64.3% |

## Critical gaps to prioritize

- `src/core/transport/tmux-class.ts` (transport): 171 uncovered lines, 53.2% line coverage.
- `src/commands/shared/wake-cmd.ts` (cli/dispatch): 170 uncovered lines, 66.1% line coverage.

## Prioritization guidance

- High-signal gaps likely to catch real bugs: wake/bring dispatch (`wake-cmd.ts`, `wake-resolve-impl.ts`), message delivery/routing (`comm-send.ts`, `routing.ts`), tmux transport primitives (`tmux-class.ts`), peer discovery transports (`scout.ts`, `mdns.ts`), plugin invocation (`registry-invoke.ts`), and worktree/fleet scans (`worktrees-scan.ts`).
- Lower-signal/ceremony gaps: large vendored MPR plugin implementations, UI/cosmetic renderers, and plugin bodies where behavior is better covered by CLI smoke tests or end-to-end plugin tests.
- Portable-core candidates for #1612 fixture extraction: matcher, routing alias guards, calver, plugin tier/default-active policy, and pure transport-router selection/failover.

## Notes

- Critical = routing/aliases, CLI dispatch, transports, fleet, matcher, and plugin dispatch.
- Low-risk = vendor plugin surfaces and UI/cosmetic code where smoke/manual tests often provide better value than line-driven unit tests.
- Files absent from LCOV are counted as zero-covered using non-empty/non-comment source lines so the report exposes untouched modules, not only imported files.
