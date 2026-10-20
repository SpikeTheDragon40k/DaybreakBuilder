import { useEffect, useState } from "react";
import { GALLERY, galleryPortrait, pickPortraitFile, svgDataUrl } from "../portraits";

/** A character's portrait, or a placeholder with their initial. */
export function Portrait({ src, name, size, className = "" }: { src: string; name: string; size: number; className?: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span className={`portrait ${className}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {src ? <img src={src} alt={`Portrait of ${name || "the character"}`} /> : <span aria-hidden>{initial}</span>}
    </span>
  );
}

/** Portrait that opens the picker when clicked. */
export function PortraitButton({ src, name, size, onChange }: { src: string; name: string; size: number; onChange: (src: string) => void }) {
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
}

export function PortraitPicker({ current, name, onPick, onClose }: PickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (make: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      const src = await make();
      if (src) onPick(src);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal portrait-picker" role="dialog" aria-label="Portrait">
        <header className="modal-header">
          <h2>Portrait</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="portrait-picker-body">
          <div className="portrait-current">
            <Portrait src={current} name={name} size={180} />
            <button className="primary" disabled={busy} onClick={() => run(pickPortraitFile)}>
              Choose image file…
            </button>
            {current && (
              <button className="ghost danger" disabled={busy} onClick={() => onPick("")}>
                Remove portrait
              </button>
            )}
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
              Use any PNG, JPEG, WebP or GIF image. It is scaled down to 512 px and saved inside the character, so exported files and
              PDFs keep it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
