import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { ContentRegistry } from "../src/index.js";

export const repoRoot = join(import.meta.dirname, "..", "..", "..");
export const coreDir = join(repoRoot, "content", "core");
export const srdDir = join(repoRoot, "content", "srd");
/** Optional local checkout of github.com/AuroraLegacy/elements (not committed). */
export const auroraLegacyDir = process.env.AURORA_LEGACY_DIR ?? join(repoRoot, "fixtures", "external", "aurora-legacy");
export const hasAuroraLegacy = existsSync(join(auroraLegacyDir, "core"));

export function xmlFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".xml")) out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

export function loadDirs(registry: ContentRegistry, ...dirs: string[]): ContentRegistry {
  for (const dir of dirs) {
    for (const f of xmlFiles(dir)) registry.addXml(readFileSync(f, "utf8"), relative(repoRoot, f));
  }
  registry.finalize();
  return registry;
}
