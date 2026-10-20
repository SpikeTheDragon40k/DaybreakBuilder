/**
 * Character portraits: a bundled gallery of emblems plus images the user picks.
 *
 * Every portrait is stored on the character as a PNG or JPEG data URL, scaled
 * down to PORTRAIT_SIZE, so saved and exported characters are self-contained
 * and the PDF export (which only embeds PNG/JPEG) can always use it.
 */

/** Longest side of a stored portrait, in pixels. */
export const PORTRAIT_SIZE = 512;

export interface GalleryPortrait {
  id: string;
  name: string;
  svg: string;
}

const INK = "#f4ead8";

function star(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

function emblem(id: string, name: string, from: string, to: string, glyph: string): GalleryPortrait {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}">` +
    `<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></radialGradient></defs>` +
    `<rect width="100" height="100" fill="url(#g)"/>` +
    `<circle cx="50" cy="50" r="44" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="1.5"/>` +
    `<g fill="${INK}" stroke="${INK}" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">${glyph.replaceAll("BG", to)}</g>` +
    `</svg>`;
  return { id, name, svg };
}

/** Original class-themed emblems shipped with the app. */
export const GALLERY: GalleryPortrait[] = [
  emblem("sword", "Sword", "#4a6378", "#1c2833",
    `<path d="M50 12 L56 22 L56 62 L44 62 L44 22 Z"/><rect x="30" y="62" width="40" height="6" rx="3"/><rect x="46" y="68" width="8" height="14"/><circle cx="50" cy="86" r="5"/>`),
  emblem("axe", "Axe", "#8a4b2a", "#3a1d10",
    `<rect x="47" y="14" width="6" height="74" rx="3"/><path d="M53 22 C72 18 80 30 80 40 C80 50 72 62 53 58 Z"/><path d="M47 22 C28 18 20 30 20 40 C20 50 28 62 47 58 Z"/>`),
  emblem("staff", "Staff", "#3d3f8f", "#16173d",
    `${star(50, 28, 17, 7, 5)}<rect x="47" y="46" width="6" height="42" rx="3"/><circle cx="50" cy="28" r="3" fill="BG"/>`),
  emblem("flame", "Flame", "#b4441f", "#4a1208",
    `<path d="M50 12 C62 30 74 40 70 60 C67 76 58 86 50 86 C42 86 32 78 30 62 C28 48 38 42 42 30 C46 40 48 44 52 46 C54 36 52 24 50 12 Z"/><path d="M50 56 C56 64 58 70 56 76 C54 80 46 80 44 76 C42 70 46 64 50 56 Z" fill="BG"/>`),
  emblem("eye", "Eye", "#5b2a6e", "#1e0c26",
    `<path d="M12 50 Q50 12 88 50 Q50 88 12 50 Z"/><circle cx="50" cy="50" r="15" fill="BG"/><circle cx="50" cy="50" r="7"/>`),
  emblem("sun", "Sun", "#c08a24", "#4d3108",
    `${star(50, 50, 38, 24, 12)}<circle cx="50" cy="50" r="18" fill="BG"/><circle cx="50" cy="50" r="13"/>`),
  emblem("leaf", "Leaf", "#3f7a3a", "#132a12",
    `<path d="M50 12 C76 28 80 58 50 88 C20 58 24 28 50 12 Z"/><path d="M50 24 L50 84 M50 44 L38 34 M50 44 L62 34 M50 60 L36 50 M50 60 L64 50" fill="none" stroke="BG" stroke-width="3"/>`),
  emblem("lute", "Song", "#a0336b", "#3b0f26",
    `<ellipse cx="36" cy="72" rx="11" ry="8"/><ellipse cx="68" cy="64" rx="11" ry="8"/><rect x="42" y="24" width="5" height="48"/><rect x="74" y="16" width="5" height="48"/><path d="M42 22 L79 14 L79 24 L42 32 Z"/>`),
  emblem("arrow", "Bow", "#5d6b2a", "#20260c",
    `<path d="M30 18 Q86 14 82 70" fill="none" stroke-width="5"/><path d="M24 76 L72 28" fill="none" stroke-width="4"/><path d="M82 18 L62 24 L76 38 Z"/><path d="M24 76 L18 64 L30 70 Z"/><path d="M24 76 L36 82 L30 70 Z"/>`),
  emblem("dagger", "Dagger", "#3a3a40", "#0e0e12",
    `<g transform="rotate(35 50 50)"><path d="M50 12 L55 24 L54 60 L46 60 L45 24 Z"/><path d="M32 60 Q50 68 68 60 L68 66 Q50 74 32 66 Z"/><rect x="47" y="70" width="6" height="12"/><circle cx="50" cy="86" r="4"/></g>`),
  emblem("enso", "Ensō", "#2f6f73", "#0f2729",
    `<path d="M50 16 A34 34 0 1 1 24 28" fill="none" stroke-width="8"/><circle cx="50" cy="50" r="6"/>`),
  emblem("shield", "Shield", "#8c2a2a", "#2e0b0b",
    `<path d="M50 12 L80 22 C80 52 70 74 50 88 C30 74 20 52 20 22 Z"/><rect x="46" y="28" width="8" height="44" fill="BG"/><rect x="34" y="40" width="32" height="8" fill="BG"/>`),
];

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

/** Scale an image to fit PORTRAIT_SIZE; PNG when it has transparency, JPEG otherwise. */
export async function toPortrait(src: string): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth || PORTRAIT_SIZE;
  const h = img.naturalHeight || PORTRAIT_SIZE;
  const scale = Math.min(1, PORTRAIT_SIZE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Image processing is not available.");
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      transparent = true;
      break;
    }
  }
  return transparent ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);
}

export function galleryPortrait(p: GalleryPortrait): Promise<string> {
  return toPortrait(svgDataUrl(p.svg));
}

/** Let the user pick an image file and turn it into a portrait (null if cancelled). */
export function pickPortraitFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      toPortrait(url)
        .then(resolve, reject)
        .finally(() => URL.revokeObjectURL(url));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
