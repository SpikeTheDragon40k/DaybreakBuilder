import { useEffect, useRef, type ReactNode } from "react";

/**
 * A button that opens a small panel below it (a <details> element, so it works
 * with the keyboard). Clicking outside or pressing Escape closes it.
 */
export function Popover({
  label,
  title,
  className = "",
  align = "right",
  children,
}: {
  label: ReactNode;
  title?: string;
  className?: string;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details className={`popover ${className}`} ref={ref}>
      <summary className="popover-button" title={title}>
        {label}
      </summary>
      <div className={`popover-panel popover-${align}`}>{children(close)}</div>
    </details>
  );
}
