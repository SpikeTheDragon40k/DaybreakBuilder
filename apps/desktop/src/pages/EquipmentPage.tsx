import { getSetter, needsAttunement, type ElementDef, type EquipSlot } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { ItemDetail } from "../components/ItemDetail";
import { newId, useCharacter } from "../state/app";

const ITEM_TYPES = ["Item", "Weapon", "Armor", "Magic Item"];

function defaultSlots(el: ElementDef | undefined): EquipSlot[] {
  if (!el) return ["worn"];
  const armor = (getSetter(el, "armor") ?? "").toLowerCase();
  if (armor === "shield") return ["offhand"];
  if (el.type === "Armor" || armor) return ["armor"];
  if (el.type === "Weapon") return ["main", "offhand"];
  return ["worn", "main", "offhand"];
}

const SLOT_LABEL: Record<EquipSlot, string> = { armor: "Armor", main: "Main hand", offhand: "Off hand", worn: "Worn" };

export function EquipmentPage() {
  const { character, content, update, sheet } = useCharacter();
  const { registry } = content;
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [focused, setFocused] = useState<ElementDef | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 && !type) return [];
    const out: ElementDef[] = [];
    for (const t of type ? [type] : ITEM_TYPES) {
      for (const el of registry.ofType(t)) {
        if (!q || el.name.toLowerCase().includes(q)) out.push(el);
        if (out.length >= 200) break;
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [registry, query, type]);

  const add = (el: ElementDef) =>
    update((d) => {
      const existing = d.inventory.find((i) => i.id === el.id && !i.equipped);
      if (existing && el.type === "Item") existing.quantity += 1;
      else d.inventory.push({ uid: newId(), id: el.id, quantity: 1 });
    });

  const inv = character.state.inventory;
  const owned = focused ? inv.filter((i) => i.id === focused.id).reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <div className="equipment-page">
      <section className="panel eq-inventory">
        <header className="panel-header">
          <h2>Inventory</h2>
          <span className="muted small">AC {sheet.armorClass}</span>
        </header>
        {inv.length === 0 && <p className="muted">Nothing yet. Search for items on the right to add them.</p>}
        <table className="inventory">
          <tbody>
            {inv.map((item) => {
              const el = registry.get(item.id);
              const slots = defaultSlots(el);
              return (
                <tr key={item.uid} className={el && el === focused ? "selected" : undefined} onMouseEnter={() => el && setFocused(el)}>
                  <td>
                    <input
                      type="number"
                      min={1}
                      className="qty"
                      value={item.quantity}
                      aria-label="Quantity"
                      onChange={(e) =>
                        update((d) => {
                          const it = d.inventory.find((x) => x.uid === item.uid);
                          if (it) it.quantity = Math.max(1, Number(e.target.value) || 1);
                        })
                      }
                    />
                  </td>
                  <td className="grow">
                    <button className="link" onClick={() => el && setFocused(el)}>
                      {item.name || el?.name || item.id}
                    </button>
                    {!el && <span className="error-text small"> (not loaded)</span>}
                  </td>
                  <td>
                    <select
                      value={item.equipped ?? ""}
                      aria-label="Equip slot"
                      onChange={(e) =>
                        update((d) => {
                          const slot = (e.target.value || undefined) as EquipSlot | undefined;
                          for (const other of d.inventory) {
                            if (slot && slot !== "worn" && other.equipped === slot) other.equipped = undefined;
                          }
                          const it = d.inventory.find((x) => x.uid === item.uid);
                          if (it) it.equipped = slot;
                        })
                      }
                    >
                      <option value="">Not equipped</option>
                      {slots.map((s) => (
                        <option key={s} value={s}>
                          {SLOT_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {el && needsAttunement(el) && (
                      <label className="check small">
                        <input
                          type="checkbox"
                          checked={!!item.attuned}
                          onChange={(e) =>
                            update((d) => {
                              const it = d.inventory.find((x) => x.uid === item.uid);
                              if (it) it.attuned = e.target.checked || undefined;
                            })
                          }
                        />
                        Attuned
                      </label>
                    )}
                  </td>
                  <td>
                    <button
                      className="ghost small"
                      aria-label="Remove item"
                      onClick={() => update((d) => void (d.inventory = d.inventory.filter((x) => x.uid !== item.uid)))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3>Currency</h3>
        <div className="currency">
          {(["cp", "sp", "ep", "gp", "pp"] as const).map((c) => (
            <label key={c}>
              {c.toUpperCase()}
              <input
                type="number"
                min={0}
                value={character.state.currency[c]}
                onChange={(e) => update((d) => void (d.currency[c] = Math.max(0, Number(e.target.value) || 0)))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="panel eq-search">
        <header className="panel-header">
          <h2>Add items</h2>
        </header>
        <div className="row">
          <input type="search" placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Item type">
            <option value="">All types</option>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <ul className="result-list">
          {results.map((el) => (
            <li key={el.id} className={el === focused ? "selected" : undefined} onMouseEnter={() => setFocused(el)} onClick={() => setFocused(el)}>
              <span className="grow">{el.name}</span>
              <span className="muted small">{el.type}</span>
              <button className="small" onClick={() => add(el)}>
                Add
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="muted">{query.trim().length < 2 && !type ? "Type at least two letters to search." : "No matching items."}</li>
          )}
        </ul>
      </section>

      <section className="panel sticky eq-preview" aria-live="polite">
        {focused ? (
          <ItemDetail
            element={focused}
            registry={registry}
            actions={
              <>
                <button className="small" onClick={() => add(focused)}>
                  Add to inventory
                </button>
                {owned > 0 && <span className="muted small">{owned} in inventory</span>}
              </>
            }
          />
        ) : (
          <p className="muted">Hover an item to preview it.</p>
        )}
      </section>
    </div>
  );
}
