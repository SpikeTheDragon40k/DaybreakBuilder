import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_FILE, newCampaignMeta, serializeCampaignMeta } from "../src/state/campaign";
import { archiveFileName, buildCampaignArchive, readCampaignArchive, safeArchivePath, type ArchivedCharacter } from "../src/state/campaignArchive";

const hero = { meta: { id: "c1", name: "Mira", summary: "Elf Wizard", level: 3, updatedAt: "2026-01-01T00:00:00.000Z" }, state: { name: "Mira" } } as unknown as ArchivedCharacter;

describe("campaign archives", () => {
  it("round-trips notes, images and characters", () => {
    const meta = newCampaignMeta("Curse of the Moon", { memberIds: ["c1"] });
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const data = buildCampaignArchive(
      {
        name: meta.name,
        files: [
          { path: CAMPAIGN_FILE, content: serializeCampaignMeta(meta) },
          { path: "Notes/Strahd.md", content: "# Strahd\n" },
        ],
        images: [{ path: "Images/map.png", data: png }],
        characters: [hero],
      },
      "2.0.0",
    );
    const back = readCampaignArchive(data, "fallback");
    expect(back.name).toBe("Curse of the Moon");
    expect(back.files.map((f) => f.path).sort()).toEqual(["Notes/Strahd.md", CAMPAIGN_FILE]);
    expect(back.images).toEqual([{ path: "Images/map.png", data: png }]);
    expect(back.characters).toEqual([hero]);
  });

  it("reads a zipped vault folder and skips hidden and unsafe entries", () => {
    const data = zipSync({
      "My Vault/Notes/Town.md": strToU8("Town"),
      "My Vault/.obsidian/app.json": strToU8("{}"),
      "My Vault/__MACOSX/x.md": strToU8("junk"),
      "My Vault/readme.txt": strToU8("ignored"),
    });
    const back = readCampaignArchive(data, "fallback");
    expect(back.name).toBe("My Vault");
    expect(back.files.map((f) => f.path)).toEqual(["Notes/Town.md"]);
    expect(back.characters).toEqual([]);
  });

  it("rejects things that aren't campaigns", () => {
    expect(() => readCampaignArchive(new Uint8Array([1, 2, 3]), "x")).toThrow(/zip/);
    expect(() => readCampaignArchive(zipSync({ "a.txt": strToU8("x") }), "x")).toThrow(/No notes/);
  });

  it("keeps paths inside the campaign", () => {
    expect(safeArchivePath("../etc/passwd")).toBeNull();
    expect(safeArchivePath("/abs.md")).toBeNull();
    expect(safeArchivePath("C:/x.md")).toBeNull();
    expect(safeArchivePath("Notes\\a.md")).toBe("Notes/a.md");
    expect(archiveFileName('Act 1: "Start"')).toBe("Act 1 Start.zip");
  });
});
