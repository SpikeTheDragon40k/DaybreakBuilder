import { parseNote } from "@daybreakbuilder/engine";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_FILE, campaignFromParty, campaignParty, newCampaignMeta, parseCampaignMeta, serializeCampaignMeta, withParty } from "../src/state/campaign";
import { newEncounter, type Party } from "../src/state/party";

const party: Party = {
  id: "p1",
  name: "The Lost Mine",
  memberIds: ["a", "b"],
  notes: "  Hooks: the mine, the dragon.\n",
  encounter: { ...newEncounter(), monsters: [{ id: "m", name: "Goblin", cr: "1/4", xp: 0, count: 4 }] },
  combat: { round: 2, turnId: null, combatants: [], log: ["Round 2."] },
  updatedAt: "2026-01-02T03:04:05.000Z",
};

describe("campaigns", () => {
  it("turns a saved party into a campaign with its notes", () => {
    const { name, files } = campaignFromParty(party);
    expect(name).toBe("The Lost Mine");
    expect(files.map((f) => f.path)).toEqual([CAMPAIGN_FILE, "Notes/Party notes.md"]);
    const meta = parseCampaignMeta(files[0].content, "x");
    expect(meta.name).toBe("The Lost Mine");
    expect(meta.createdAt).toBe(party.updatedAt);
    expect(meta.party).toEqual({ memberIds: ["a", "b"], encounter: party.encounter, combat: party.combat });
    expect(parseNote(files[1].path, files[1].content).body).toBe("Hooks: the mine, the dragon.\n");
    expect(campaignFromParty({ ...party, notes: " " }).files).toHaveLength(1);
  });

  it("reads hand-edited or missing campaign files", () => {
    expect(parseCampaignMeta(undefined, "Folder").name).toBe("Folder");
    expect(parseCampaignMeta("not json", "Folder").party.memberIds).toEqual([]);
    expect(parseCampaignMeta('{"name":"X","party":{"memberIds":["a",3]}}', "F").party.memberIds).toEqual(["a"]);
  });

  it("maps the campaign's party to and from the party view", () => {
    const meta = newCampaignMeta("C", { memberIds: ["a"] });
    const p = campaignParty("id", meta);
    expect(p.name).toBe("C");
    const back = withParty(meta, { ...p, memberIds: ["a", "b"] });
    expect(back.party.memberIds).toEqual(["a", "b"]);
    expect(JSON.parse(serializeCampaignMeta(back)).format).toBe("daybreakbuilder-campaign");
  });
});
