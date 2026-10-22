import { parseIndexFile, type ElementsFileInfo } from "./parser.js";

export interface DownloadedFile {
  /** Path relative to the source root, e.g. "core/players-handbook/races/race-dwarf.xml". */
  path: string;
  url: string;
  content: string;
}

export interface IndexDownloadResult {
  info: ElementsFileInfo;
  files: DownloadedFile[];
  errors: { url: string; message: string }[];
}

export interface DownloadOptions {
  fetchText: (url: string) => Promise<string>;
  onProgress?: (done: number, total: number, url: string) => void;
  /** Limit on parallel requests (default 6). */
  concurrency?: number;
}

/**
 * Walk an Aurora *.index file and everything it references (nested indexes
 * and element XML files), downloading all element files. Files come back in
 * the order the indexes list them, so a later file overrides an earlier one
 * deterministically (the registry keeps the last element with a given id).
 */
export async function downloadIndex(indexUrl: string, opts: DownloadOptions): Promise<IndexDownloadResult> {
  const errors: { url: string; message: string }[] = [];
  const seenIndexes = new Set<string>();
  let rootInfo: ElementsFileInfo = {};

  type Job = { url: string; path: string };
  const walk = async (url: string, isRoot: boolean): Promise<Job[]> => {
    if (seenIndexes.has(url)) return [];
    seenIndexes.add(url);
    let text: string;
    try {
      text = await opts.fetchText(url);
    } catch (e) {
      errors.push({ url, message: (e as Error).message });
      return [];
    }
    let parsed;
    try {
      parsed = parseIndexFile(text);
    } catch (e) {
      errors.push({ url, message: `invalid index: ${(e as Error).message}` });
      return [];
    }
    if (isRoot) rootInfo = parsed.info;
    // Nested indexes are fetched in parallel but keep their place in the list.
    const parts = await Promise.all(
      parsed.files.map((f) =>
        f.name.toLowerCase().endsWith(".index") || f.url.toLowerCase().endsWith(".index")
          ? walk(f.url, false)
          : Promise.resolve([{ url: f.url, path: relativePath(indexUrl, f.url, f.name) }]),
      ),
    );
    return parts.flat();
  };

  const queue = await walk(indexUrl, true);
  const unique = [...new Map(queue.map((q) => [q.url, q])).values()];
  const contents: (string | undefined)[] = new Array(unique.length);
  let done = 0;
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const i = next++;
      const job = unique[i];
      try {
        contents[i] = await opts.fetchText(job.url);
      } catch (e) {
        errors.push({ url: job.url, message: (e as Error).message });
      }
      done++;
      opts.onProgress?.(done, unique.length, job.url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));

  const files: DownloadedFile[] = [];
  unique.forEach((job, i) => {
    if (contents[i] !== undefined) files.push({ path: job.path, url: job.url, content: contents[i]! });
  });
  return { info: rootInfo, files, errors };
}

/** Best-effort relative path of a file under the index's directory. */
function relativePath(indexUrl: string, fileUrl: string, name: string): string {
  const base = indexUrl.slice(0, indexUrl.lastIndexOf("/") + 1);
  if (fileUrl.startsWith(base)) return decodeURIComponent(fileUrl.slice(base.length));
  try {
    const u = new URL(fileUrl);
    return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
  } catch {
    return name;
  }
}

/** Well-known community content index. */
export const AURORA_LEGACY_INDEX = "https://raw.githubusercontent.com/AuroraLegacy/elements/master/AuroraLegacy.index";

/**
 * The same community content for the 2024 rules only: the dnd-2024 branch of the project's fork,
 * which drops every 2014 book and adds the 2024 books still waiting in AuroraLegacy pull requests.
 */
export const AURORA_LEGACY_2024_INDEX = "https://raw.githubusercontent.com/SpikeTheDragon40k/elements/dnd-2024/AuroraLegacy.index";
