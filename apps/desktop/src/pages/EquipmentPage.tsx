import {
  addCurrency,
  COIN_VALUE,
  coinWeight,
  consolidateCurrency,
  currencyValue,
  equipItem,
  equipSlots,
  formatPrice,
  itemCost,
  makeChange,
  needsAttunement,
  resolveItem,
  baseItemCandidates,
  baseItemFilter,
  spendCurrency,
  type CharacterState,
  type Coin,
  type ElementDef,
  type EquipSlot,
} from "@daybreakbuilder/engine";
import { useMemo, useState } from "react";
import { ItemDetail } from "../components/ItemDetail";
import { StartingWealthCard } from "../components/StartingWealthCard";
import { newId, useCharacter } from "../state/app";
import { useUnits } from "../units";

const ITEM_TYPES = ["Item", "Weapon", "Armor", "Magic Item"];

const SLOT_LABEL: Record<EquipSlot, string> = { armor: "Armor", main: "Main hand", offhand: "Off hand", worn: "Worn" };

function addItem(d: CharacterState, el: ElementDef) {
  const existing = d.inventory.find((i) => i.id === el.id && !i.equipped);
  if (existing && el.type === "Item") existing.quantity += 1;
  else d.inventory.push({ uid: newId(), id: el.id, quantity: 1 });
}

/** Coins, their total worth and weight, and quick ways to add, spend or exchange them. */
function CurrencyPanel() {
  const { character, update } = useCharacter();
  const units = useUnits();
  const purse = character.state.currency;
  const [amount, setAmount] = useState("");
  const [coin, setCoin] = useState<Coin>("gp");
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const cp = n * COIN_VALUE[coin];
  const total = currencyValue(purse);
  const loose = purse.cp + purse.sp + purse.ep;

  return (
    <>
      <h3>Currency</h3>
      <div className="currency">
        {(["cp", "sp", "ep", "gp", "pp"] as const).map((c) => (
          <label key={c}>
            {c.toUpperCase()}
            <input
              type="number"
              min={0}
              value={purse[c]}
              onChange={(e) => update((d) => void (d.currency[c] = Math.max(0, Math.floor(Number(e.target.value)) || 0)))}
            />
          </label>
        ))}
      </div>
      <div className="currency-summary small">
        <span>
          Worth <strong>{formatPrice(total)}</strong>
        </span>
        {coinWeight(purse) > 0 && <span className="muted">Weighs {units.weight(Math.round(coinWeight(purse) * 10) / 10)}</span>}
        {loose > 0 && (
          <button className="small ghost" title="Exchange copper, silver and electrum for gold" onClick={() => update((d) => void (d.currency = consolidateCurrency(d.currency)))}>
            Exchange for gold
          </button>
        )}
      </div>
      <div className="row currency-quick">
        <input type="number" min={0} placeholder="Amount" value={amount} aria-label="Amount" onChange={(e) => setAmount(e.target.value)} />
        <select value={coin} aria-label="Coin" onChange={(e) => setCoin(e.target.value as Coin)}>
          {(["pp", "gp", "ep", "sp", "cp"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="small" disabled={!n} onClick={() => update((d) => void (d.currency = addCurrency(d.currency, { [coin]: n })))}>
          Receive
        </button>
        <button
          className="small"
          disabled={!n || cp > total}
          title={cp > total ? "Not enough money" : "Pay this amount, taking change as needed"}
          onClick={() =>
            update((d) => {
              const paid = spendCurrency(d.currency, cp);
              if (paid) d.currency = paid;
            })
          }
        >
          Spend
        </button>
      </div>
    </>
  );
}

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

  const add = (el: ElementDef) => update((d) => addItem(d, el));
  const purseValue = currencyValue(character.state.currency);
  const buy = (el: ElementDef) =>
    update((d) => {
      const paid = spendCurrency(d.currency, itemCost(el) ?? 0);
      if (!paid) return;
      d.currency = paid;
      addItem(d, el);
    });
  /** Sell one for half its price, from an unequipped stack if there is one. */
  const sell = (el: ElementDef) =>
    update((d) => {
      const stacks = d.inventory.filter((i) => i.id === el.id);
      const it = stacks.find((i) => !i.equipped) ?? stacks[0];
      if (!it) return;
      if (it.quantity > 1) it.quantity -= 1;
      else d.inventory = d.inventory.filter((x) => x.uid !== it.uid);
      d.currency = addCurrency(d.currency, makeChange(Math.floor((itemCost(el) ?? 0) / 2)));
    });
  const buyButton = (el: ElementDef, label = "Buy") => {
    const price = itemCost(el);
    if (price === undefined) return null;
    const short = price > purseValue;
    return (
      <button
        className="small"
        disabled={short}
        title={short ? `Not enough money (you have ${formatPrice(purseValue)})` : `Buy for ${formatPrice(price)}`}
        onClick={(e) => {
          e.stopPropagation();
          buy(el);
        }}
      >
        {label} {formatPrice(price)}
      </button>
    );
  };

  const inv = character.state.inventory;
  const owned = focused ? inv.filter((i) => i.id === focused.id).reduce((n, i) => n + i.quantity, 0) : 0;
  const focusedPrice = focused ? itemCost(focused) : undefined;

  return (
    <div className="equipment-page">
      <section className="panel eq-inventory">
        <header className="panel-header">
          <h2>Inventory</h2>
          <span className="muted small">AC {sheet.armorClass}</span>
        </header>
        <StartingWealthCard />
        {inv.length === 0 && <p className="muted">Nothing yet. Search for items on the right to add or buy them.</p>}
        <table className="inventory">
          <tbody>
            {inv.map((item) => {
              const el = registry.get(item.id);
              const resolved = resolveItem(registry, item);
              const slots = equipSlots(resolved?.element);
              const bases = el && baseItemFilter(el) ? baseItemCandidates(registry, el, character.state) : [];
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
                      {item.name || resolved?.element.name || item.id}
                    </button>
                    {!el && <span className="error-text small"> (not loaded)</span>}
                    {el && baseItemFilter(el) && (
                      <div className="base-item">
                        {resolved?.needsBase && <span className="dot" title="Choice needed" />}
                        <select
                          className="small"
                          value={item.base ?? ""}
                          aria-label={`Base ${baseItemFilter(el)!.type.toLowerCase()}`}
                          onChange={(e) =>
                            update((d) => {
                              const it = d.inventory.find((x) => x.uid === item.uid);
                              if (!it) return;
                              it.base = e.target.value || undefined;
                              // A shield can't stay in the armor slot, nor a greatsword beside a shield.
                              if (it.equipped && !equipSlots(resolveItem(registry, it)?.element).includes(it.equipped)) it.equipped = undefined;
                            })
                          }
                        >
                          <option value="">Choose {baseItemFilter(el)!.type === "Weapon" ? "weapon" : "armor"}…</option>
                          {bases.map((b, i) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                              {bases[i - 1]?.name === b.name || bases[i + 1]?.name === b.name ? ` (${b.source})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      value={item.equipped ?? ""}
                      aria-label="Equip slot"
                      onChange={(e) =>
                        update((d) => equipItem(registry, d.inventory, item.uid, (e.target.value || undefined) as EquipSlot | undefined))
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
        <CurrencyPanel />
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
              {buyButton(el)}
              <button
                className="small"
                title="Add without paying (starting equipment, loot)"
                onClick={(e) => {
                  e.stopPropagation();
                  add(el);
                }}
              >
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
                {buyButton(focused)}
                <button className="small" onClick={() => add(focused)}>
                  {focusedPrice === undefined ? "Add to inventory" : "Add free"}
                </button>
                {owned > 0 && focusedPrice !== undefined && (
                  <button className="small ghost" title="Sell one for half its price" onClick={() => sell(focused)}>
                    Sell {formatPrice(Math.floor(focusedPrice / 2))}
                  </button>
                )}
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
