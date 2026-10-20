import { newCharacter, type CharacterState } from "@dndbuilder/engine";
import { describe, expect, it } from "vitest";
import {
  describeChange,
  emptyHistory,
  jump,
  MAX_HISTORY,
  MERGE_MS,
  record,
  redo,
  timeline,
  undo,
  type History,
} from "../src/state/history";

/** Apply an edit the way the app's `update` does, recording it. */
function edit(h: History, state: CharacterState, fn: (d: CharacterState) => void, at: number) {
  const next = structuredClone(state);
  fn(next);
  return { history: record(h, state, next, undefined, at), state: next };
}

describe("character history", () => {
  it("undoes and redoes changes in order", () => {
    let s = newCharacter();
    let h = emptyHistory();
    ({ history: h, state: s } = edit(h, s, (d) => void (d.name = "Ada"), 0));
    ({ history: h, state: s } = edit(h, s, (d) => void (d.abilities.strength = 10), 10_000));
    expect(h.past.map((e) => e.label)).toEqual(["Renamed to “Ada”", "Strength 8 → 10"]);

    let r = undo(h, s)!;
    expect(r.state.abilities.strength).toBe(8);
    expect(r.state.name).toBe("Ada");
    r = undo(r.history, r.state)!;
    expect(r.state.name).toBe("New Character");
    expect(undo(r.history, r.state)).toBeNull();

    r = redo(r.history, r.state)!;
    expect(r.state.name).toBe("Ada");
    r = redo(r.history, r.state)!;
    expect(r.state.abilities.strength).toBe(10);
    expect(redo(r.history, r.state)).toBeNull();
  });

  it("drops the redo steps after a new change", () => {
    let s = newCharacter();
    let h = emptyHistory();
    ({ history: h, state: s } = edit(h, s, (d) => void (d.name = "Ada"), 0));
    const r = undo(h, s)!;
    const next = edit(r.history, r.state, (d) => void (d.playerName = "Bo"), 10_000);
    expect(next.history.future).toEqual([]);
    expect(next.history.past.map((e) => e.label)).toEqual(["Changed player name"]);
  });

  it("merges quick edits of the same field into one step", () => {
    let s = newCharacter();
    let h = emptyHistory();
    for (const [i, name] of ["A", "Ad", "Ada"].entries()) ({ history: h, state: s } = edit(h, s, (d) => void (d.name = name), i * 200));
    expect(h.past).toHaveLength(1);
    expect(h.past[0].label).toBe("Renamed to “Ada”");
    expect(h.past[0].state.name).toBe("New Character");
    // After a pause, the next keystroke is a new step.
    ({ history: h, state: s } = edit(h, s, (d) => void (d.name = "Adam"), 400 + MERGE_MS + 1));
    expect(h.past).toHaveLength(2);
    // Typing back to where the burst started cancels it.
    ({ history: h, state: s } = edit(h, s, (d) => void (d.name = "Ada"), 400 + MERGE_MS + 100));
    expect(h.past).toHaveLength(1);
  });

  it("keeps separate steps for items added quickly", () => {
    let s = newCharacter();
    let h = emptyHistory();
    ({ history: h, state: s } = edit(h, s, (d) => void d.inventory.push({ uid: "1", id: "ID_A", quantity: 1 }), 0));
    ({ history: h, state: s } = edit(h, s, (d) => void d.inventory.push({ uid: "2", id: "ID_B", quantity: 1 }), 100));
    expect(h.past.map((e) => e.label)).toEqual(["Added ID_A", "Added ID_B"]);
  });

  it("ignores edits that change nothing", () => {
    const s = newCharacter();
    const h = emptyHistory();
    expect(record(h, s, structuredClone(s))).toBe(h);
  });

  it("jumps anywhere on the timeline and back", () => {
    let s = newCharacter();
    let h = emptyHistory();
    for (const [i, xp] of [100, 200, 300].entries()) ({ history: h, state: s } = edit(h, s, (d) => void (d.experience = xp), i * 10_000));
    expect(timeline(h).map((t) => t.label)).toEqual(["Opened", "Set XP to 100", "Set XP to 200", "Set XP to 300"]);

    let r = jump(h, s, 1)!;
    expect(r.state.experience).toBe(100);
    const items = timeline(r.history);
    expect(items.map((t) => [t.current, t.undone])).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [false, true],
    ]);
    r = jump(r.history, r.state, 3)!;
    expect(r.state.experience).toBe(300);
    r = jump(r.history, r.state, 0)!;
    expect(r.state.experience).toBe(0);
    expect(jump(r.history, r.state, 0)).toBeNull();
  });

  it("describes choices, inventory and levels", () => {
    const a = newCharacter();
    const b = structuredClone(a);
    b.selections["ID_LEVEL_1|Race"] = ["ID_RACE_HUMAN"];
    expect(describeChange(a, b)?.label).toBe("Race: ID_RACE_HUMAN");
    const c = structuredClone(b);
    c.levels.push("ID_WOTC_PHB_CLASS_FIGHTER");
    expect(describeChange(b, c)?.label).toBe("Level 2 (ID_WOTC_PHB_CLASS_FIGHTER)");
    c.inventory.push({ uid: "x", id: "ID_SWORD", quantity: 1 });
    const d = structuredClone(c);
    d.inventory[0].equipped = "main";
    expect(describeChange(c, d)?.label).toBe("Equipped ID_SWORD");
    expect(describeChange(a, d)?.label).toBe("Level 2 (ID_WOTC_PHB_CLASS_FIGHTER) (+2 more)");
  });

  it("keeps at most MAX_HISTORY steps", () => {
    let s = newCharacter();
    let h = emptyHistory();
    for (let i = 1; i <= MAX_HISTORY + 5; i++) ({ history: h, state: s } = edit(h, s, (d) => void (d.experience = i), i * 10_000));
    expect(h.past).toHaveLength(MAX_HISTORY);
    expect(h.past[0].state.experience).toBe(5);
  });

  it("labels purchases, sales and starting wealth", () => {
    const a = newCharacter();
    a.currency.gp = 10;
    const b = structuredClone(a);
    b.inventory.push({ uid: "1", id: "ID_ROPE", quantity: 1 });
    b.currency.gp = 9;
    expect(describeChange(a, b)?.label).toBe("Bought ID_ROPE");
    const c = structuredClone(b);
    c.inventory = [];
    c.currency.sp = 5;
    expect(describeChange(b, c)?.label).toBe("Sold ID_ROPE");
    const d = structuredClone(a);
    d.startingWealth = { option: "average", gp: 120 };
    d.currency.gp = 130;
    expect(describeChange(a, d)?.label).toBe("Starting wealth: 120 gp");
    const e = structuredClone(a);
    e.currency = { ...e.currency, gp: 9, sp: 7 };
    expect(describeChange(a, e)?.label).toBe("Spent 3 sp");
  });
});
