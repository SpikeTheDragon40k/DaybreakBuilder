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
 * and element XML files), downloading all element files.
 */
export async function downloadIndex(indexUrl: string, opts: DownloadOptions): Promise<IndexDownloadResult> {
  const errors: { url: string; message: string }[] = [];
  const files = new Map<string, DownloadedFile>();
  const seenIndexes = new Set<string>();
  const xmlQueue: { url: string; path: string }[] = [];
  let rootInfo: ElementsFileInfo = {};

  const walk = async (url: string, isRoot: boolean): Promise<void> => {
    if (seenIndexes.has(url)) return;
    seenIndexes.add(url);
    let text: string;
    try {
      text = await opts.fetchText(url);
    } catch (e) {
      errors.push({ url, message: (e as Error).message });
      return;
    }
    let parsed;
    try {
      parsed = parseIndexFile(text);
    } catch (e) {
      errors.push({ url, message: `invalid index: ${(e as Error).message}` });
      return;
    }
    if (isRoot) rootInfo = parsed.info;
    const nested: Promise<void>[] = [];
    for (const f of parsed.files) {
      if (f.name.toLowerCase().endsWith(".index") || f.url.toLowerCase().endsWith(".index")) {
        nested.push(walk(f.url, false));
      } else {
        xmlQueue.push({ url: f.url, path: relativePath(indexUrl, f.url, f.name) });
      }
    }
    await Promise.all(nested);
  };

  await walk(indexUrl, true);

  const unique = [...new Map(xmlQueue.map((q) => [q.url, q])).values()];
  let done = 0;
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const job = unique[next++];
      try {
        const content = await opts.fetchText(job.url);
        files.set(job.url, { path: job.path, url: job.url, content });
      } catch (e) {
        errors.push({ url: job.url, message: (e as Error).message });
      }
      done++;
      opts.onProgress?.(done, unique.length, job.url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));

  return { info: rootInfo, files: [...files.values()], errors };
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
