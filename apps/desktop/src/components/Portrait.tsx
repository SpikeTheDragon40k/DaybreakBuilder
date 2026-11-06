import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getPlatform } from "../platform";
import {
  clampCrop,
  cropGeometry,
  cropPortrait,
  DEFAULT_CROP,
  DEFAULT_TOKEN_COLOR,
  GALLERY,
  galleryPortrait,
  MAX_ZOOM,
  pickImageFile,
  svgDataUrl,
  TOKEN_COLORS,
  tokenPng,
  type Crop,
} from "../portraits";

/** A character's portrait, or a placeholder with their initial. With `ring`, a round token with a coloured ring. */
export function Portrait({ src, name, size, className = "", ring }: { src: string; name: string; size: number; className?: string; ring?: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={`portrait ${ring ? "token" : ""} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42, ...(ring ? { borderColor: ring, borderWidth: Math.max(2, Math.round(size * 0.06)) } : {}) }}
    >
      {src ? <img src={src} alt={`Portrait of ${name || "the character"}`} /> : <span aria-hidden>{initial}</span>}
    </span>
  );
}

interface PortraitButtonProps {
  src: string;
  name: string;
  size: number;
  onChange: (src: string) => void;
  tokenColor?: string;
  onTokenColor?: (color: string) => void;
}

/** Portrait that opens the picker when clicked. */
export function PortraitButton({ src, name, size, onChange, tokenColor, onTokenColor }: PortraitButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="portrait-button" onClick={() => setOpen(true)} title={src ? "Change portrait" : "Choose a portrait"}>
        <Portrait src={src} name={name} size={size} />
        <span className="portrait-hint">{src ? "Change" : "Portrait"}</span>
      </button>
      {open && (
        <PortraitPicker
          current={src}
          name={name}
          tokenColor={tokenColor}
          onTokenColor={onTokenColor}
          onPick={(p) => {
            onChange(p);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface PickerProps {
  current: string;
  name: string;
  onPick: (src: string) => void;
  onClose: () => void;
  tokenColor?: string;
  onTokenColor?: (color: string) => void;
}

export function PortraitPicker({ current, name, onPick, onClose, tokenColor, onTokenColor }: PickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Image being cropped (a new file, or the current portrait to adjust). */
  const [cropping, setCropping] = useState<string | null>(null);
  const color = tokenColor || DEFAULT_TOKEN_COLOR;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cropping) setCropping(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, cropping]);

  const run = async (make: () => Promise<string | null | void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const src = await make();
      if (typeof src === "string") onPick(src);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadToken = () =>
    run(async () => {
      const bytes = await tokenPng(current, (name.trim()[0] ?? "?").toUpperCase(), color);
      const platform = await getPlatform();
      const file = `${(name || "character").replace(/[\\/:*?"<>|]+/g, "_")} token.png`;
      if (await platform.saveBinaryFile(file, bytes, "png", "image/png")) setMessage(`Saved ${file}.`);
    });

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal portrait-picker" role="dialog" aria-label="Portrait">
        <header className="modal-header">
          <h2>{cropping ? "Crop portrait" : "Portrait"}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {cropping ? (
          <PortraitCropper
            src={cropping}
            ring={color}
            busy={busy}
            onCancel={() => setCropping(null)}
            onDone={(crop) => run(() => cropPortrait(cropping, crop))}
          />
        ) : (
          <div className="portrait-picker-body">
            <div className="portrait-current">
              <Portrait src={current} name={name} size={180} />
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setError(null);
                  try {
                    const src = await pickImageFile();
                    if (src) setCropping(src);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Choose image file…
              </button>
              {current && (
                <button disabled={busy} onClick={() => setCropping(current)}>
                  Adjust crop…
                </button>
              )}
              {current && (
                <button className="ghost danger" disabled={busy} onClick={() => onPick("")}>
                  Remove portrait
                </button>
              )}
              {onTokenColor && (
                <section className="token-section">
                  <h3>Token</h3>
                  <div className="token-row">
                    <Portrait src={current} name={name} size={64} ring={color} />
                    <div className="token-colors" role="group" aria-label="Token ring colour">
                      {TOKEN_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`swatch ${c === color ? "on" : ""}`}
                          style={{ background: c }}
                          aria-label={`Ring colour ${c}`}
                          aria-pressed={c === color}
                          onClick={() => onTokenColor(c)}
                        />
                      ))}
                      <input type="color" value={color} aria-label="Custom ring colour" onChange={(e) => onTokenColor(e.target.value)} />
                    </div>
                  </div>
                  <button disabled={busy} onClick={downloadToken}>
                    Download token (PNG)
                  </button>
                  <p className="muted small">A round 512 px token for virtual tabletops such as Foundry, Roll20 or Owlbear Rodeo.</p>
                </section>
              )}
              {message && <p className="ok-text small">{message}</p>}
              {error && <p className="error-text small">{error}</p>}
            </div>
            <div>
              <h3>Gallery</h3>
              <ul className="portrait-gallery">
                {GALLERY.map((p) => (
                  <li key={p.id}>
                    <button disabled={busy} onClick={() => run(() => galleryPortrait(p))} title={p.name}>
                      <img src={svgDataUrl(p.svg)} alt={p.name} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="muted small">
                Use any PNG, JPEG, WebP or GIF image. You choose the square to keep; it is saved inside the character at 512 px, so exported
                files and PDFs keep it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const VIEW = 280;

/** Drag to move, wheel or slider to zoom; the circle shows what a round token keeps. */
function PortraitCropper({ src, ring, busy, onDone, onCancel }: { src: string; ring: string; busy: boolean; onDone: (crop: Crop) => void; onCancel: () => void }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth || VIEW, h: img.naturalHeight || VIEW });
    img.src = src;
  }, [src]);

  if (!size) return <p className="muted portrait-cropper">Loading image…</p>;
  const r = cropGeometry(size.w, size.h, VIEW, crop);
  const slackX = (r.width - VIEW) / 2;
  const slackY = (r.height - VIEW) / 2;

  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setCrop(
      clampCrop({
        ...d.crop,
        x: slackX > 0 ? d.crop.x + (e.clientX - d.x) / slackX : 0,
        y: slackY > 0 ? d.crop.y + (e.clientY - d.y) / slackY : 0,
      }),
    );
  };

  return (
    <div className="portrait-cropper">
      <div
        className="crop-view"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => setCrop((c) => clampCrop({ ...c, zoom: c.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1) }))}
        role="img"
        aria-label="Portrait crop: drag to move, scroll to zoom"
      >
        <img src={src} alt="" draggable={false} style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
        <span className="crop-circle" style={{ borderColor: ring }} aria-hidden />
      </div>
      <label className="crop-zoom">
        Zoom
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => setCrop((c) => clampCrop({ ...c, zoom: Number(e.target.value) }))}
        />
      </label>
      <p className="muted small">Drag the image to move it; the square is the portrait, the circle what a token shows.</p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => onDone(crop)}>
          Use this crop
        </button>
        <button disabled={busy} onClick={() => setCrop(DEFAULT_CROP)}>
          Reset
        </button>
        <button className="ghost" disabled={busy} onClick={onCancel}>
          Back
        </button>
      </div>
    </div>
  );
}
