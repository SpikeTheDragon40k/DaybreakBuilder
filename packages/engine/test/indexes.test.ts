/** Content indexes: the 2024 rules index and how indexes are downloaded. */
import { describe, expect, it } from "vitest";
import { AURORA_LEGACY_2024_INDEX, downloadIndex } from "../src/index.js";

describe("2024 rules index", () => {
  it("is the dnd-2024 branch of the project's AuroraLegacy fork", () => {
    expect(AURORA_LEGACY_2024_INDEX).toBe("https://raw.githubusercontent.com/SpikeTheDragon40k/elements/dnd-2024/AuroraLegacy.index");
  });
});

describe("downloadIndex", () => {
  it("returns files in the order the indexes list them, however fast each download is", async () => {
    const index = (files: string[]) =>
      `<index><files>${files.map((f) => `<file name="${f}" url="https://x.test/${f}" />`).join("")}</files></index>`;
    const sites: Record<string, string> = {
      "https://x.test/root.index": index(["a.xml", "nested.index", "d.xml"]),
      "https://x.test/nested.index": index(["b.xml", "c.xml"]),
    };
    const delay: Record<string, number> = { "a.xml": 30, "nested.index": 20, "b.xml": 25, "c.xml": 1, "d.xml": 5 };
    const fetchText = async (url: string) => {
      const name = url.slice(url.lastIndexOf("/") + 1);
      await new Promise((r) => setTimeout(r, delay[name] ?? 0));
      return sites[url] ?? `<elements><!-- ${name} --></elements>`;
    };
    const result = await downloadIndex("https://x.test/root.index", { fetchText, concurrency: 4 });
    expect(result.errors).toEqual([]);
    expect(result.files.map((f) => f.path)).toEqual(["a.xml", "b.xml", "c.xml", "d.xml"]);
  });
});
