/** Indexes the app ships alongside its content. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AURORA_LEGACY_2024_INDEX, parseIndexFile } from "../src/index.js";
import { repoRoot } from "./helpers.js";

describe("aurora-legacy-2024.index", () => {
  const path = join(repoRoot, "content", "indexes", "aurora-legacy-2024.index");
  const index = parseIndexFile(readFileSync(path, "utf8"));

  it("is published where the app expects it", () => {
    expect(AURORA_LEGACY_2024_INDEX.endsWith("/content/indexes/aurora-legacy-2024.index")).toBe(true);
    expect(index.info.updateUrl).toBe(AURORA_LEGACY_2024_INDEX);
  });

  it("only links to AuroraLegacy files", () => {
    for (const f of index.files) expect(f.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/AuroraLegacy\/elements\/master\//);
  });

  it("lists the shared files and only the 2024 books", () => {
    const names = index.files.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["internal.xml", "players-handbook-2024.index", "dungeon-masters-guide-2024.index"]));
    expect(names).not.toContain("players-handbook.index");
    expect(names).not.toContain("supplements.index");
  });
});
