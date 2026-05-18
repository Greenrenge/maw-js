/** Targeted isolated coverage for thin re-export modules absent from LCOV. */
import { describe, expect, test } from "bun:test";

describe("thin re-export module coverage", () => {
  test("shared thin modules expose their re-exported command surfaces", async () => {
    const split = await import("../../src/commands/plugins/split/impl");
    const fleet = await import("../../src/commands/shared/fleet");
    const pulse = await import("../../src/commands/shared/pulse");

    expect(typeof split.cmdSplit).toBe("function");
    expect(typeof fleet.cmdFleetLs).toBe("function");
    expect(typeof fleet.cmdFleetRename).toBe("function");
    expect(typeof fleet.cmdFleetRenumber).toBe("function");
    expect(typeof fleet.cmdFleetValidate).toBe("function");
    expect(typeof fleet.cmdFleetSync).toBe("function");
    expect(typeof fleet.cmdFleetSyncConfigs).toBe("function");
    expect(typeof fleet.cmdSleep).toBe("function");
    expect(typeof fleet.cmdWakeAll).toBe("function");
    expect(typeof pulse.todayDate).toBe("function");
    expect(typeof pulse.todayLabel).toBe("function");
    expect(typeof pulse.timePeriod).toBe("function");
    expect(typeof pulse.cmdPulseAdd).toBe("function");
    expect(typeof pulse.cmdPulseLs).toBe("function");
  });
});
