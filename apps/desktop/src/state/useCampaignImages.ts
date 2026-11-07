import { attachmentPath } from "@daybreakbuilder/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignRef, CampaignStore } from "./campaign";

const MAX_BYTES = 25 * 1024 * 1024;

export interface CampaignImages {
  /** Image paths in the campaign. */
  paths: string[];
  /** Object URL for an image, or null while it loads (the version changes once it has). */
  url(path: string): string | null;
  /** Save an image file into the Attachments folder; returns its path. */
  add(file: File): Promise<string>;
  /** Changes whenever images are added or finish loading, to repaint editors. */
  version: number;
  error: string | null;
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** A name for a pasted image, which has none of its own ("image.png"): like Obsidian's "Pasted image 2026…". */
function fileName(file: File): string {
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return !file.name || /^image\.\w+$/i.test(file.name) ? `Pasted image ${stamp()}.${ext}` : file.name;
}

export function useCampaignImages(store: CampaignStore, campaign: CampaignRef): CampaignImages {
  const [paths, setPaths] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef(new Map<string, string | null>());

  const refresh = useCallback(() => {
    store.listImages(campaign).then(setPaths, (e: Error) => setError(e.message));
  }, [store, campaign]);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    const cache = urls.current;
    return () => {
      window.removeEventListener("focus", refresh);
      for (const u of cache.values()) if (u) URL.revokeObjectURL(u);
      cache.clear();
    };
  }, [refresh]);

  const url = (path: string): string | null => {
    const cached = urls.current.get(path);
    if (cached !== undefined) return cached;
    urls.current.set(path, null);
    store.readImage(campaign, path).then(
      (blob) => {
        urls.current.set(path, URL.createObjectURL(blob));
        setVersion((v) => v + 1);
      },
      (e: Error) => setError(e.message),
    );
    return null;
  };

  const add = async (file: File): Promise<string> => {
    if (file.size > MAX_BYTES) throw new Error(`${file.name || "The image"} is bigger than 25 MB.`);
    const path = attachmentPath(fileName(file), paths);
    await store.writeImage(campaign, path, new Uint8Array(await file.arrayBuffer()));
    urls.current.set(path, URL.createObjectURL(file));
    setPaths((p) => [...p, path].sort());
    setVersion((v) => v + 1);
    return path;
  };

  return { paths, url, add, version, error };
}
