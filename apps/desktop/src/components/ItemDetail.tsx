import type { ContentRegistry, ElementDef } from "@daybreakbuilder/engine";
import { armorKind, getSetter, getSetters, needsAttunement } from "@daybreakbuilder/engine";
import type { ReactNode } from "react";
import { Html } from "./Html";
import { useUnits } from "../units";

const ITEM_TYPES = ["Item", "Weapon", "Armor", "Magic Item"];

export function isItem(el: ElementDef): boolean {
  return ITEM_TYPES.includes(el.type);
}

const RARITIES = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Martial melee weapon", "Heavy armor", "Wondrous item, rare (requires attunement)". */
function subtitle(el: ElementDef): string {
  if (el.type === "Weapon") {
    const cat = el.supports.find((s) => /^(simple|martial) (melee|ranged)$/i.test(s));
    return cat ? `${cap(cat.toLowerCase())} weapon` : "Weapon";
  }
  const armor = armorKind(el);
  if (armor && el.type !== "Magic Item") return armor === "shield" ? "Shield" : `${cap(armor)} armor`;
  if (el.type === "Magic Item") {
    const kind = getSetter(el, "type") ?? "Magic item";
    const rarity = getSetter(el, "rarity");
    return rarity ? `${kind}, ${rarity.toLowerCase()}` : kind;
  }
  return getSetter(el, "category") ?? el.type;
}

/** Content writes "—" for "not applicable". */
function shown(v: string | undefined): string | undefined {
  return v && !/^[-–—\s]*$/.test(v) ? v : undefined;
}

function cost(el: ElementDef): string | undefined {
  const s = getSetters(el, "cost")[0];
  if (!s || !shown(s.value)) return undefined;
  return s.attrs.currency && /^[\d.,]+$/.test(s.value.trim()) ? `${s.value.trim()} ${s.attrs.currency}` : s.value;
}

function damage(el: ElementDef): string | undefined {
  const s = getSetters(el, "damage")[0];
  if (!s?.value) return undefined;
  return s.attrs.type ? `${s.value} ${s.attrs.type}` : s.value;
}

/** "Finesse, Light, Thrown (range 20/60)" → one chip per property, keeping commas inside parentheses. */
function properties(el: ElementDef): string[] {
  return (getSetter(el, "properties") ?? "")
    .split(/,(?![^(]*\))/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Rich card for weapons, armor, gear and magic items: headline stats first, then the rules text. */
export function ItemDetail({
  element,
  registry,
  actions,
}: {
  element: ElementDef;
  registry: ContentRegistry;
  /** Buttons shown under the title (e.g. "Add to inventory"). */
  actions?: ReactNode;
}) {
  const units = useUnits();
  const rarity = getSetter(element, "rarity")?.trim().toLowerCase();
  const rarityClass = rarity && RARITIES.includes(rarity) ? `rarity-${rarity.replace(" ", "-")}` : "";
  const ac = getSetter(element, "armorClass");
  const dmg = damage(element);
  const weight = shown(getSetter(element, "weight"));
  const price = cost(element);
  const stats: [string, string][] = [];
  if (dmg) stats.push(["Damage", dmg]);
  if (ac) stats.push(["Armor Class", /^\d+$/.test(ac) && armorKind(element) === "shield" ? `+${ac}` : ac]);
  if (getSetter(element, "versatile")) stats.push(["Versatile", getSetter(element, "versatile")!]);
  if (getSetter(element, "range")) stats.push(["Range", units.text(`${getSetter(element, "range")} ft.`)]);
  if (weight) stats.push(["Weight", units.text(weight)]);
  if (price) stats.push(["Cost", price]);
  const props = properties(element);
  const strength = getSetter(element, "strength");
  const stealth = getSetter(element, "stealth");
  const attune = needsAttunement(element) ? getSetter(element, "attunement")! : undefined;

  return (
    <article className={`element-detail item-detail ${rarityClass}`}>
      <header className="item-head">
        <h3>{element.name}</h3>
        <div className="item-sub">{subtitle(element)}</div>
        <div className="muted small">{element.source}</div>
      </header>
      {actions && <div className="item-actions">{actions}</div>}
      {stats.length > 0 && (
        <dl className="item-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(props.length > 0 || attune) && (
        <ul className="chips">
          {props.map((p) => (
            <li key={p}>{units.text(p)}</li>
          ))}
          {attune && (
            <li className="chip-accent">
              {/^true$/i.test(attune.trim()) ? "Requires attunement" : `Attunement: ${attune}`}
            </li>
          )}
        </ul>
      )}
      {(strength || stealth) && (
        <ul className="item-notes small">
          {strength && <li>Requires Strength {strength}; otherwise speed −{units.distance(10)}.</li>}
          {stealth && <li>{stealth} on Dexterity (Stealth) checks.</li>}
        </ul>
      )}
      {element.prerequisite && (
        <p className="prereq">
          <strong>Prerequisite:</strong> {element.prerequisite}
        </p>
      )}
      <div className="item-desc">
        {element.description ? <Html html={element.description} registry={registry} /> : <p className="muted">No description.</p>}
      </div>
    </article>
  );
}
