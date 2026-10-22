/** Indexes the app ships alongside its content. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AURORA_LEGACY_2024_INDEX, downloadIndex, parseIndexFile } from "../src/index.js";
import { repoRoot } from "./helpers.js";

describe("aurora-legacy-2024.index", () => {
  const path = join(repoRoot, "content", "indexes", "aurora-legacy-2024.index");
  const index = parseIndexFile(readFileSync(path, "utf8"));

  it("is published where the app expects it", () => {
    expect(AURORA_LEGACY_2024_INDEX.endsWith("/content/indexes/aurora-legacy-2024.index")).toBe(true);
    expect(index.info.updateUrl).toBe(AURORA_LEGACY_2024_INDEX);
  });

  it("only links to AuroraLegacy files, released ones on master and pull requests at a fixed commit", () => {
    for (const f of index.files) {
      expect(f.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/AuroraLegacy\/elements\/(master|[0-9a-f]{40})\//);
    }
  });

  it("lists the shared files and only the 2024 books", () => {
    const names = index.files.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["internal.xml", "players-handbook-2024.index", "dungeon-masters-guide-2024.index"]));
    expect(names).not.toContain("players-handbook.index");
    expect(names).not.toContain("supplements.index");
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
