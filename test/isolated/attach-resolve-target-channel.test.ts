import { describe, expect, test } from "bun:test";

const { resolveAttachTarget } = await import("../../src/vendor/mpr-plugins/attach/resolve-attach-target.ts?channel-regression");

describe("attach resolver channel-session filtering", () => {
  test("filters discord channel helper sessions so the oracle admin session wins", async () => {
    const result = await resolveAttachTarget("discord", {
      listSessions: async () => [
        { name: "01-mawjs-discord", windows: [{ name: "mawjs-oracle-discord" }] },
        { name: "02-homekeeper-discord", windows: [{ name: "homekeeper-oracle-discord" }] },
        { name: "03-random-oracle-discord", windows: [{ name: "random" }] },
        { name: "23-discord-admin", windows: [{ name: "discord-oracle" }] },
      ],
      loadFleet: () => [],
    });

    expect(result).toEqual({ tier: 1, sessionName: "23-discord-admin" });
  });

  test("does not treat channel helpers as ambiguous matches when no oracle session exists", async () => {
    const result = await resolveAttachTarget("discord", {
      listSessions: async () => [
        { name: "01-mawjs-discord", windows: [{ name: "mawjs-oracle-discord" }] },
        { name: "02-homekeeper-discord", windows: [{ name: "homekeeper-oracle-discord" }] },
        { name: "14-random-oracle-discord", windows: [{ name: "random" }] },
      ],
      loadFleet: () => [],
    });

    expect(result).toBeNull();
  });

  test("keeps the oracle own numbered discord-oracle session visible", async () => {
    const result = await resolveAttachTarget("discord", {
      listSessions: async () => [
        { name: "01-mawjs-discord", windows: [{ name: "mawjs-oracle-discord" }] },
        { name: "24-discord-oracle", windows: [{ name: "discord-oracle" }] },
      ],
      loadFleet: () => [],
    });

    expect(result).toEqual({ tier: 1, sessionName: "24-discord-oracle" });
  });
});
