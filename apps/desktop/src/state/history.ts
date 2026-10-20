import { currencyValue, formatPrice, type CharacterState, type ContentRegistry } from "@dndbuilder/engine";

/** A character state the user can go back to, labelled with the change that came after it. */
export interface HistoryEntry {
  state: CharacterState;
  /** What changed between this state and the next one ("Added Longsword"). */
  label: string;
  /** Edits with the same key in quick succession (typing a name) merge into one step. */
  key: string;
  at: number;
}

export interface History {
  /** Oldest first; the last entry is what Undo goes back to. */
  past: HistoryEntry[];
  /** Nearest first; the first entry is what Redo goes forward to. */
  future: HistoryEntry[];
}

export const MAX_HISTORY = 200;
/** Edits of the same field closer together than this become one undo step. */
export const MERGE_MS = 1500;

/** Fields edited by typing or number spinners, where each keystroke is not worth its own step. */
const MERGEABLE = /^(name|playerName|experience|details\.|abilities\.|currency\.|inventory\.(qty|notes)\.)/;

export function emptyHistory(): History {
  return { past: [], future: [] };
}

interface Change {
  key: string;
  label: string;
}

const DETAIL_LABELS: Record<string, string> = { traits: "personality traits", organization: "organization" };

/** Describe the difference between two character states for the history list, or null if nothing changed. */
export function describeChange(before: CharacterState, after: CharacterState, registry?: ContentRegistry): Change | null {
  const name = (id: string | null | undefined) => (id ? (registry?.get(id)?.name ?? id) : "nothing");
  const changes: Change[] = [];

  if (before.name !== after.name) changes.push({ key: "name", label: `Renamed to “${after.name}”` });
  if (before.playerName !== after.playerName) changes.push({ key: "playerName", label: "Changed player name" });
  if (before.experience !== after.experience) changes.push({ key: "experience", label: `Set XP to ${after.experience}` });
  if (before.portrait !== after.portrait)
    changes.push({ key: "portrait", label: after.portrait ? "Changed portrait" : "Removed portrait" });
  for (const k of Object.keys(after.details) as (keyof CharacterState["details"])[]) {
    if (before.details[k] !== after.details[k]) changes.push({ key: `details.${k}`, label: `Edited ${DETAIL_LABELS[k] ?? k}` });
  }
  if (before.abilityMethod !== after.abilityMethod)
    changes.push({ key: "abilityMethod", label: `Switched to ${after.abilityMethod.replace("-", " ")}` });
  for (const a of Object.keys(after.abilities) as (keyof CharacterState["abilities"])[]) {
    if (before.abilities[a] !== after.abilities[a]) {
      changes.push({
        key: `abilities.${a}`,
        label: `${a.charAt(0).toUpperCase() + a.slice(1)} ${before.abilities[a]} → ${after.abilities[a]}`,
      });
    }
  }

  if (after.levels.length > before.levels.length) {
    changes.push({ key: "levels", label: `Level ${after.levels.length} (${name(after.levels[after.levels.length - 1])})` });
  } else if (after.levels.length < before.levels.length) {
    changes.push({ key: "levels", label: `Back to level ${after.levels.length}` });
  } else {
    after.levels.forEach((id, i) => {
      if (id !== before.levels[i]) changes.push({ key: "levels", label: `Level ${i + 1} class: ${name(id)}` });
    });
  }
  if (JSON.stringify(before.hitPoints) !== JSON.stringify(after.hitPoints)) {
    changes.push({
      key: "hitPoints",
      label: after.hitPoints.method !== before.hitPoints.method ? `Hit points: ${after.hitPoints.method}` : "Changed rolled hit points",
    });
  }

  for (const key of new Set([...Object.keys(before.selections), ...Object.keys(after.selections)])) {
    const b = before.selections[key] ?? [];
    const a = after.selections[key] ?? [];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const rule = key.slice(key.lastIndexOf("|") + 1).replace(/@\d+$/, "");
    const added = a.filter((x) => x && !b.includes(x));
    const removed = b.filter((x) => x && !a.includes(x));
    const label = added.length
      ? `${rule}: ${added.map(name).join(", ")}`
      : removed.length
        ? `${rule}: removed ${removed.map(name).join(", ")}`
        : `${rule}: changed`;
    changes.push({ key: `selections.${key}`, label });
  }
  for (const key of new Set([...Object.keys(before.options), ...Object.keys(after.options)])) {
    if (before.options[key] !== after.options[key])
      changes.push({ key: `options.${key}`, label: `${after.options[key] ? "Enabled" : "Disabled"} ${name(key)}` });
  }

  // Coins changing together with the inventory is a purchase or a sale, labelled on the item.
  const paid = currencyValue(before.currency) - currencyValue(after.currency);
  const traded = paid !== 0 && JSON.stringify(before.inventory) !== JSON.stringify(after.inventory);
  const beforeItems = new Map(before.inventory.map((i) => [i.uid, i]));
  const afterItems = new Map(after.inventory.map((i) => [i.uid, i]));
  for (const item of after.inventory) {
    const old = beforeItems.get(item.uid);
    const label = item.name || name(item.id);
    if (!old) changes.push({ key: `inventory.add`, label: `${paid > 0 ? "Bought" : "Added"} ${label}` });
    else if (old.quantity !== item.quantity && paid !== 0)
      changes.push({ key: `inventory.trade`, label: `${paid > 0 ? "Bought" : "Sold"} ${label}` });
    else if (old.quantity !== item.quantity) changes.push({ key: `inventory.qty.${item.uid}`, label: `${label} ×${item.quantity}` });
    else if (old.equipped !== item.equipped)
      changes.push({ key: `inventory.equip.${item.uid}`, label: item.equipped ? `Equipped ${label}` : `Unequipped ${label}` });
    else if (old.attuned !== item.attuned)
      changes.push({ key: `inventory.attune.${item.uid}`, label: item.attuned ? `Attuned to ${label}` : `Ended attunement to ${label}` });
    else if (old.name !== item.name || old.notes !== item.notes)
      changes.push({ key: `inventory.notes.${item.uid}`, label: `Edited ${label}` });
  }
  for (const item of before.inventory) {
    if (!afterItems.has(item.uid))
      changes.push({ key: "inventory.remove", label: `${paid < 0 ? "Sold" : "Removed"} ${item.name || name(item.id)}` });
  }
  if (JSON.stringify(before.startingWealth) !== JSON.stringify(after.startingWealth)) {
    changes.push({
      key: "startingWealth",
      label: after.startingWealth ? `Starting wealth: ${after.startingWealth.gp} gp` : "Cleared starting wealth",
    });
  } else if (!traded) {
    const coins = (Object.keys(after.currency) as (keyof CharacterState["currency"])[]).filter((c) => before.currency[c] !== after.currency[c]);
    if (coins.length > 1)
      changes.push({ key: "currency", label: paid > 0 ? `Spent ${formatPrice(paid)}` : paid < 0 ? `Received ${formatPrice(-paid)}` : "Exchanged coins" });
    for (const c of coins.length === 1 ? coins : []) changes.push({ key: `currency.${c}`, label: `${after.currency[c]} ${c}` });
  }

  if (JSON.stringify(before.excludedSources) !== JSON.stringify(after.excludedSources))
    changes.push({ key: "excludedSources", label: "Changed sources" });
  for (const caster of new Set([...Object.keys(before.preparedSpells), ...Object.keys(after.preparedSpells)])) {
    const b = before.preparedSpells[caster] ?? [];
    const a = after.preparedSpells[caster] ?? [];
    const added = a.filter((x) => !b.includes(x));
    const removed = b.filter((x) => !a.includes(x));
    if (added.length) changes.push({ key: `prepared.${caster}`, label: `Prepared ${added.map(name).join(", ")}` });
    else if (removed.length) changes.push({ key: `prepared.${caster}`, label: `Unprepared ${removed.map(name).join(", ")}` });
  }

  if (changes.length === 0) return null;
  if (changes.length === 1) return changes[0];
  // Several fields at once (an import, a level change that clears choices): name the first and count the rest.
  return { key: "multi", label: `${changes[0].label} (+${changes.length - 1} more)` };
}

/** Record that the character went from `before` to `after`. */
export function record(
  history: History,
  before: CharacterState,
  after: CharacterState,
  registry?: ContentRegistry,
  now = Date.now(),
): History {
  const change = describeChange(before, after, registry);
  if (!change) return history;
  const last = history.past[history.past.length - 1];
  if (last && history.future.length === 0 && last.key === change.key && MERGEABLE.test(change.key) && now - last.at < MERGE_MS) {
    // Keep the state from before the burst of edits; refresh the label and the timer.
    const merged = describeChange(last.state, after, registry);
    // Typing a field back to where it started cancels the step.
    if (!merged) return { past: history.past.slice(0, -1), future: [] };
    return { past: [...history.past.slice(0, -1), { ...last, label: merged.label, at: now }], future: [] };
  }
  const past = [...history.past, { state: before, label: change.label, key: change.key, at: now }];
  return { past: past.slice(-MAX_HISTORY), future: [] };
}

export function canUndo(h: History): boolean {
  return h.past.length > 0;
}

export function canRedo(h: History): boolean {
  return h.future.length > 0;
}

/** Step back one change. `current` is the state shown now. */
export function undo(h: History, current: CharacterState): { history: History; state: CharacterState } | null {
  const entry = h.past[h.past.length - 1];
  if (!entry) return null;
  return {
    state: entry.state,
    history: { past: h.past.slice(0, -1), future: [{ ...entry, state: current }, ...h.future] },
  };
}

/** Step forward one change. */
export function redo(h: History, current: CharacterState): { history: History; state: CharacterState } | null {
  const entry = h.future[0];
  if (!entry) return null;
  return {
    state: entry.state,
    history: { past: [...h.past, { ...entry, state: current }], future: h.future.slice(1) },
  };
}

/**
 * Jump to a point in the list returned by `timeline`: index 0 is the oldest state,
 * `h.past.length` is the current one, and higher indexes are redo states.
 */
export function jump(h: History, current: CharacterState, index: number): { history: History; state: CharacterState } | null {
  let result: { history: History; state: CharacterState } | null = { history: h, state: current };
  const steps = index - h.past.length;
  for (let i = 0; i < Math.abs(steps) && result; i++) {
    result = steps < 0 ? undo(result.history, result.state) : redo(result.history, result.state);
  }
  return steps === 0 ? null : result;
}

export interface TimelineItem {
  /** Index to pass to `jump`. */
  index: number;
  /** The change that led to this state, or "Opened" for the oldest one. */
  label: string;
  at?: number;
  current: boolean;
  /** Undone change that Redo would bring back. */
  undone: boolean;
}

/** Every state in the history, oldest first, each labelled with the change that produced it. */
export function timeline(h: History): TimelineItem[] {
  const items: TimelineItem[] = [{ index: 0, label: "Opened", current: h.past.length === 0, undone: false }];
  h.past.forEach((e, i) => items.push({ index: i + 1, label: e.label, at: e.at, current: i === h.past.length - 1, undone: false }));
  h.future.forEach((e, i) => items.push({ index: h.past.length + i + 1, label: e.label, at: e.at, current: false, undone: true }));
  return items;
}
