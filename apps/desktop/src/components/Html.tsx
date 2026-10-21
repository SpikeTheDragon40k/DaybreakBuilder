import type { ContentRegistry } from "@daybreakbuilder/engine";
import DOMPurify from "dompurify";
import { useMemo } from "react";
import { useUnits } from "../units";

/**
 * Element descriptions are HTML fragments. Aurora lets one element embed
 * another's description with <div element="ID_..."/>; expand those (bounded
 * depth) and sanitize the result.
 */
export function expandDescription(html: string, registry: ContentRegistry | undefined, depth = 0): string {
  if (!registry || depth > 2) return html;
  return html.replace(/<div\s+element="([^"]+)"\s*(?:\/>|><\/div>)/g, (_, id: string) => {
    const el = registry.get(id);
    if (!el) return "";
    return `<div class="embedded"><h5>${escapeHtml(el.name)}</h5>${expandDescription(el.description, registry, depth + 1)}</div>`;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Html({ html, registry, className }: { html: string; registry?: ContentRegistry; className?: string }) {
  const units = useUnits();
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(units.text(expandDescription(html, registry)), {
        FORBID_TAGS: ["style", "script", "iframe", "form"],
        FORBID_ATTR: ["style"],
      }),
    [html, registry, units],
  );
  return <div className={`html ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
