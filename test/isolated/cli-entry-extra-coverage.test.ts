import { beforeEach, describe, expect, mock, test } from "bun:test";

const instancePresetPath = import.meta.resolve("../../src/cli/instance-preset.ts");
const auditPath = import.meta.resolve("../../src/core/fleet/audit.ts");
const usagePath = import.meta.resolve("../../src/cli/usage.ts");
const registryPath = import.meta.resolve("../../src/cli/command-registry.ts");
const verbosityPath = import.meta.resolve("../../src/cli/verbosity.ts");
const versionPath = import.meta.resolve("../../src/cli/cmd-version.ts");
const updatePath = import.meta.resolve("../../src/cli/cmd-update.ts");
const bootstrapPath = import.meta.resolve("../../src/cli/plugin-bootstrap.ts");
const autoRestorePath = import.meta.resolve("../../src/cli/auto-restore.ts");
const dispatchPath = import.meta.resolve("../../src/cli/dispatch.ts");
const errorHandlerPath = import.meta.resolve("../../src/cli/error-handler.ts");

const calls: Record<string, unknown[][]> = {
  applyInstancePreset: [],
  logAudit: [],
  usage: [],
  scanCommands: [],
  setVerbosityFlags: [],
  getVersionString: [],
  runUpdate: [],
  runBootstrap: [],
  maybeAutoRestore: [],
  dispatchCommand: [],
  handleTopLevelError: [],
};

let dispatchError: Error | null = null;
let updateError: Error | null = null;
let logs: string[] = [];

function resetCalls() {
  for (const key of Object.keys(calls)) calls[key] = [];
}

mock.module(instancePresetPath, () => ({
  applyInstancePreset: (...args: unknown[]) => calls.applyInstancePreset.push(args),
}));

mock.module(auditPath, () => ({
  logAudit: (...args: unknown[]) => calls.logAudit.push(args),
}));

mock.module(usagePath, () => ({
  usage: (...args: unknown[]) => calls.usage.push(args),
}));

mock.module(registryPath, () => ({
  scanCommands: async (...args: unknown[]) => calls.scanCommands.push(args),
}));

mock.module(verbosityPath, () => ({
  setVerbosityFlags: (...args: unknown[]) => calls.setVerbosityFlags.push(args),
}));

mock.module(versionPath, () => ({
  getVersionString: (...args: unknown[]) => {
    calls.getVersionString.push(args);
    return "maw-test-version";
  },
}));

mock.module(updatePath, () => ({
  runUpdate: async (...args: unknown[]) => {
    calls.runUpdate.push(args);
    if (updateError) throw updateError;
  },
}));

mock.module(bootstrapPath, () => ({
  runBootstrap: async (...args: unknown[]) => calls.runBootstrap.push(args),
}));

mock.module(autoRestorePath, () => ({
  maybeAutoRestore: async (...args: unknown[]) => calls.maybeAutoRestore.push(args),
}));

mock.module(dispatchPath, () => ({
  dispatchCommand: async (...args: unknown[]) => {
    calls.dispatchCommand.push(args);
    if (dispatchError) throw dispatchError;
  },
}));

mock.module(errorHandlerPath, () => ({
  handleTopLevelError: (...args: unknown[]) => calls.handleTopLevelError.push(args),
}));

async function importCli(label: string, args: string[]) {
  process.argv = ["bun", "src/cli.ts", ...args];
  await import(`../../src/cli.ts?cli-entry-extra-${label}`);
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  resetCalls();
  dispatchError = null;
  updateError = null;
  logs = [];
  console.log = (...args: any[]) => logs.push(args.map(String).join(" "));
  delete process.env.MAW_PLUGINS_DIR;
  delete process.env.MAW_CLI;
});

describe("cli entrypoint side-effect flow", () => {
  test("applies preset, strips verbosity, logs audit, and prints version before bootstrap", async () => {
    await importCli("version", ["--quiet", "--version"]);

    expect(process.env.MAW_CLI).toBe("1");
    expect(calls.applyInstancePreset).toHaveLength(1);
    expect(calls.setVerbosityFlags).toEqual([[{ quiet: true }]]);
    expect(calls.logAudit).toEqual([["--version", ["--version"]]]);
    expect(calls.getVersionString).toHaveLength(1);
    expect(logs).toEqual(["maw-test-version"]);
    expect(calls.runBootstrap).toEqual([]);
  });

  test("routes update aliases and reports top-level update errors", async () => {
    updateError = new Error("update failed");
    await importCli("update", ["--silent", "upgrade", "--channel", "alpha"]);

    expect(calls.setVerbosityFlags).toEqual([[{ silent: true }]]);
    expect(calls.runUpdate).toEqual([[["upgrade", "--channel", "alpha"]]]);
    expect(calls.handleTopLevelError).toEqual([[updateError, ["upgrade", "--channel", "alpha"]]]);
  });

  test("bootstraps, scans, auto-restores, and shows usage for help/no-command", async () => {
    process.env.MAW_PLUGINS_DIR = "/tmp/maw-plugins-test";
    await importCli("help", ["--help"]);

    expect(calls.runBootstrap[0]?.[0]).toBe("/tmp/maw-plugins-test");
    expect(String(calls.runBootstrap[0]?.[1])).toContain("/src");
    expect(calls.scanCommands).toEqual([["/tmp/maw-plugins-test", "user"]]);
    expect(calls.maybeAutoRestore).toEqual([["--help"]]);
    expect(calls.usage).toHaveLength(1);
    expect(calls.dispatchCommand).toEqual([]);

    resetCalls();
    await importCli("empty", []);
    expect(calls.maybeAutoRestore).toEqual([[undefined]]);
    expect(calls.usage).toHaveLength(1);
  });

  test("dispatches regular commands and forwards dispatch failures to the top-level handler", async () => {
    await importCli("dispatch-ok", ["wake", "mawjs"]);
    expect(calls.dispatchCommand).toEqual([["wake", ["wake", "mawjs"]]]);
    expect(calls.handleTopLevelError).toEqual([]);

    resetCalls();
    dispatchError = new Error("dispatch failed");
    await importCli("dispatch-bad", ["wake", "broken"]);
    expect(calls.dispatchCommand).toEqual([["wake", ["wake", "broken"]]]);
    expect(calls.handleTopLevelError).toEqual([[dispatchError, ["wake", "broken"]]]);
  });
});
