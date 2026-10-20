import { convertUnits, formatDistance, formatWeight, type UnitSystem } from "@dndbuilder/engine";
import { useMemo, useSyncExternalStore } from "react";
import { settings } from "./platform";

/** Display units. Content stays imperial; text and numbers are converted when shown. */
let current: UnitSystem | undefined;
const listeners = new Set<() => void>();

export function getUnits(): UnitSystem {
  current ??= settings.get<UnitSystem>("units", "imperial") === "metric" ? "metric" : "imperial";
  return current;
}

export function setUnits(units: UnitSystem): void {
  current = units;
  settings.set("units", units);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface Units {
  system: UnitSystem;
  /** Rewrite measurements inside rules text. */
  text: (s: string) => string;
  /** A distance in feet ("30 ft." / "9 m"). */
  distance: (feet: number) => string;
  /** A weight in pounds ("2 lb." / "1 kg"). */
  weight: (pounds: number) => string;
}

export function useUnits(): Units {
  const system = useSyncExternalStore(subscribe, getUnits);
  return useMemo(
    () => ({
      system,
      text: (s: string) => convertUnits(s, system),
      distance: (feet: number) => formatDistance(feet, system),
      weight: (pounds: number) => formatWeight(pounds, system),
    }),
    [system],
  );
}
