# Coverage gap analysis

Generated: 2026-05-18T12:53:45.529Z

Input: `coverage/lcov.info`

Coverage scope: source-line-normalized Bun LCOV plus zero-coverage accounting for tracked `src/**/*.ts` files absent from LCOV.
Excluded from Bun LCOV accounting: non-Bun-runtime AssemblyScript sources compiled to WebAssembly and covered by AssemblyScript harness tests instead of Bun line instrumentation.

Overall line coverage: **81.5%** (30450/37358)
Overall function coverage: **90.5%** (3866/4271)

## Module summary

| Module | Files | Missing from LCOV | Lines | Functions | Branches |
| --- | ---: | ---: | ---: | ---: | ---: |
| cli/dispatch | 91 | 6 | 92.3% (5841/6328) | 91.3% (703/770) | n/a (0/0) |
| config/runtime | 19 | 1 | 82.8% (777/938) | 76.6% (82/107) | n/a (0/0) |
| fleet | 17 | 0 | 93.1% (730/784) | 93.1% (94/101) | n/a (0/0) |
| matcher | 2 | 0 | 100.0% (73/73) | 100.0% (15/15) | n/a (0/0) |
| other | 176 | 35 | 85.2% (8851/10387) | 87.2% (1104/1266) | n/a (0/0) |
| plugin dispatch | 15 | 1 | 99.2% (889/896) | 96.6% (86/89) | n/a (0/0) |
| routing/aliases | 4 | 0 | 98.6% (492/499) | 97.3% (71/73) | n/a (0/0) |
| transport | 28 | 1 | 98.3% (1856/1888) | 95.9% (420/438) | n/a (0/0) |
| vendor plugins | 245 | 113 | 70.3% (10941/15565) | 91.4% (1291/1412) | n/a (0/0) |

## Source handled outside Bun LCOV

| Source root | Files | Source lines | Reason |
| --- | ---: | ---: | --- |
| `src/wasm/maw-plugin-sdk-assemblyscript/assembly/` | 5 | 232 | AssemblyScript SDK source is compiled with asc to WebAssembly; Bun LCOV cannot map wasm execution back to these TypeScript-like sources. |

## Top 20 uncovered files by executable/source line count

| Rank | Risk | Module | File | Uncovered | Line coverage | Function coverage | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | low | vendor plugins | `src/vendor/mpr-plugins/incubate/impl.ts` | 60 | 0.0% | n/a | absent from LCOV |
| 2 | low | vendor plugins | `src/vendor/mpr-plugins/contacts/impl.ts` | 59 | 0.0% | n/a | absent from LCOV |
| 3 | low | vendor plugins | `src/vendor/mpr-plugins/pulse/index.ts` | 58 | 0.0% | n/a | absent from LCOV |
| 4 | medium | other | `src/commands/plugins/tile/index.ts` | 57 | 0.0% | n/a | absent from LCOV |
| 5 | low | vendor plugins | `src/vendor/mpr-plugins/archive/impl.ts` | 57 | 0.0% | n/a | absent from LCOV |
| 6 | low | vendor plugins | `src/vendor/mpr-plugins/bud/smart-default-org.ts` | 57 | 0.0% | n/a | absent from LCOV |
| 7 | low | vendor plugins | `src/vendor/mpr-plugins/ls/index.ts` | 56 | 0.0% | n/a | absent from LCOV |
| 8 | low | vendor plugins | `src/vendor/mpr-plugins/bud/internal/split-impl.ts` | 53 | 0.0% | n/a | absent from LCOV |
| 9 | low | vendor plugins | `src/vendor/mpr-plugins/split/impl.ts` | 53 | 0.0% | n/a | absent from LCOV |
| 10 | low | vendor plugins | `src/vendor/mpr-plugins/view/internal/split-impl.ts` | 53 | 0.0% | n/a | absent from LCOV |
| 11 | medium | other | `src/commands/plugins/oracle/impl-scan.ts` | 51 | 7.3% | 0.0% | partial coverage |
| 12 | medium | other | `src/commands/plugins/tmux/layout-manager.ts` | 51 | 46.3% | 55.0% | partial coverage |
| 13 | critical | cli/dispatch | `src/commands/shared/fleet-sync.ts` | 51 | 0.0% | n/a | absent from LCOV |
| 14 | low | vendor plugins | `src/vendor/mpr-plugins/costs/index.ts` | 51 | 0.0% | n/a | absent from LCOV |
| 15 | medium | other | `src/commands/plugins/team/index.ts` | 50 | 87.6% | 78.9% | partial coverage |
| 16 | low | vendor plugins | `src/vendor/mpr-plugins/signals/index.ts` | 50 | 0.0% | n/a | absent from LCOV |
| 17 | low | vendor plugins | `src/vendor/mpr-plugins/team/team-comms.ts` | 50 | 21.9% | 25.0% | partial coverage |
| 18 | medium | other | `src/plugins/20_loader.ts` | 49 | 32.9% | 83.3% | partial coverage |
| 19 | low | vendor plugins | `src/vendor/mpr-plugins/demo/index.ts` | 49 | 0.0% | n/a | absent from LCOV |
| 20 | low | vendor plugins | `src/vendor/mpr-plugins/project/index.ts` | 49 | 0.0% | n/a | absent from LCOV |

## Critical files at or above the 80% line target

| Module | File | Line coverage | Function coverage |
| --- | --- | ---: | ---: |
| cli/dispatch | `src/cli/cmd-new.ts` | 82.4% | 83.3% |
| cli/dispatch | `src/cli/cmd-update.ts` | 100.0% | 95.0% |
| cli/dispatch | `src/cli/cmd-version.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-execute.ts` | 100.0% | 83.3% |
| cli/dispatch | `src/cli/command-registry-match.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-types.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/command-registry-wasm.ts` | 87.5% | 50.0% |
| cli/dispatch | `src/cli/command-registry.ts` | 96.4% | 100.0% |
| cli/dispatch | `src/cli/dispatch-match.ts` | 90.1% | 90.0% |
| cli/dispatch | `src/cli/dispatch.ts` | 93.6% | 85.7% |
| cli/dispatch | `src/cli/instance-pid.ts` | 96.2% | 84.2% |
| cli/dispatch | `src/cli/parse-args.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/plugin-bootstrap.ts` | 81.7% | 100.0% |
| cli/dispatch | `src/cli/update-lock.ts` | 100.0% | 71.4% |
| cli/dispatch | `src/cli/usage.ts` | 95.3% | 92.9% |
| cli/dispatch | `src/cli/verbosity.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/cli/wasm-bridge.ts` | 81.3% | 60.9% |
| cli/dispatch | `src/commands/shared/agents.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/artifacts.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-list.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/comm-log-feed.ts` | 86.4% | 80.0% |
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
| cli/dispatch | `src/commands/shared/fleet-validate.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-wake-failsoft.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/fleet-wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pane-target-resolver.ts` | 94.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-as.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-rust.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugin-create-scaffold.ts` | 82.1% | 75.0% |
| cli/dispatch | `src/commands/shared/plugin-create.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-ls-info.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-profile.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-toggle.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/plugins-ui.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/preflight.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pulse-cmd.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/pulse-thread.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/queue-store.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/receiver-inbox.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/scan-signals.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/scope-acl.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/should-auto-wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/target-cwd.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/triggers.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-cmd-helpers.ts` | 95.5% | 90.9% |
| cli/dispatch | `src/commands/shared/wake-cmd.ts` | 96.3% | 78.0% |
| cli/dispatch | `src/commands/shared/wake-concurrency.ts` | 94.1% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-maybe-split.ts` | 98.4% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-resolve-impl.ts` | 99.4% | 82.0% |
| cli/dispatch | `src/commands/shared/wake-resolve-scan-suggest.ts` | 87.7% | 83.3% |
| cli/dispatch | `src/commands/shared/wake-resolve.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/wake-session.ts` | 100.0% | 86.7% |
| cli/dispatch | `src/commands/shared/wake.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-agents.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-lifecycle.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-query.ts` | 100.0% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace-store.ts` | 95.1% | 100.0% |
| cli/dispatch | `src/commands/shared/workspace.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/claude-sessions.ts` | 98.6% | 94.7% |
| fleet | `src/core/fleet/leaf.ts` | 100.0% | 100.0% |
| fleet | `src/core/fleet/nicknames.ts` | 98.4% | 100.0% |
| fleet | `src/core/fleet/oracle-registry.ts` | 100.0% | 100.0% |
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
| routing/aliases | `src/core/routing.ts` | 100.0% | 91.7% |
| transport | `src/core/transport/curl-fetch.ts` | 100.0% | 85.7% |
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
| transport | `src/transports/scout-pair.ts` | 80.9% | 50.0% |
| transport | `src/transports/scout-protocol.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout-state.ts` | 100.0% | 100.0% |
| transport | `src/transports/scout.ts` | 100.0% | 100.0% |
| transport | `src/transports/tmux.ts` | 100.0% | 100.0% |
| transport | `src/transports/zenoh-scout.ts` | 100.0% | 100.0% |
| transport | `src/transports/zenoh.ts` | 100.0% | 100.0% |

## Critical files below the 80% line target (next queue)

| Module | File | Uncovered | Line coverage |
| --- | --- | ---: | ---: |
| cli/dispatch | `src/commands/shared/fleet-sync.ts` | 51 | 0.0% |
| cli/dispatch | `src/commands/shared/plugins-install.ts` | 40 | 48.7% |
| cli/dispatch | `src/commands/shared/wake-resolve-github.ts` | 39 | 9.3% |
| cli/dispatch | `src/commands/shared/plugin-create-cmd.ts` | 34 | 37.0% |
| cli/dispatch | `src/cli/auto-restore.ts` | 32 | 0.0% |
| cli/dispatch | `src/commands/shared/transport.ts` | 31 | 0.0% |
| cli/dispatch | `src/commands/shared/audit.ts` | 27 | 6.9% |
| fleet | `src/core/fleet/registry-oracle-orchestrate.ts` | 23 | 17.9% |
| cli/dispatch | `src/cli/instance-preset.ts` | 21 | 16.0% |
| cli/dispatch | `src/commands/shared/plugins.ts` | 21 | 58.0% |

## Critical gaps to prioritize

- `src/commands/shared/fleet-sync.ts` (cli/dispatch): 51 uncovered lines, 0.0% line coverage.

## Prioritization guidance

- High-signal gaps likely to catch real bugs: wake/bring dispatch (`wake-cmd.ts`, `wake-resolve-impl.ts`), message delivery/routing (`comm-send.ts`, `routing.ts`), tmux transport primitives (`tmux-class.ts`), peer discovery transports (`scout.ts`, `mdns.ts`), plugin invocation (`registry-invoke.ts`), and worktree/fleet scans (`worktrees-scan.ts`).
- Lower-signal/ceremony gaps: large vendored MPR plugin implementations, UI/cosmetic renderers, and plugin bodies where behavior is better covered by CLI smoke tests or end-to-end plugin tests.
- Portable-core candidates for #1612 fixture extraction: matcher, routing alias guards, calver, plugin tier/default-active policy, and pure transport-router selection/failover.

## Notes

- Critical = routing/aliases, CLI dispatch, transports, fleet, matcher, and plugin dispatch.
- Low-risk = vendor plugin surfaces and UI/cosmetic code where smoke/manual tests often provide better value than line-driven unit tests.
- Bun DA entries are source-line-normalized to ignore comments, syntactic separators, and type-only declarations that cannot be exercised at runtime.
- Files absent from LCOV are counted as zero-covered using the same source-line normalization so the report exposes untouched modules, not only imported files.
- AssemblyScript SDK sources under `src/wasm/maw-plugin-sdk-assemblyscript/assembly/` are not counted as zero-covered Bun TypeScript because their runtime is asc-compiled WebAssembly. Keep covering them with AssemblyScript wasm harness tests and compiler checks.
