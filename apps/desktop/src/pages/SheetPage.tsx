import { attackDetails, currencyValue, formatCurrency, formatModifier, formatPrice, itemName, type StatPart } from "@daybreakbuilder/engine";
import { useState, type ReactNode } from "react";
import { getPlatform, settings } from "../platform";
import type { PaperSize, PdfStyle } from "../pdf/characterSheetPdf";
import { CompanionBlock } from "../components/CompanionBlock";
import { Portrait } from "../components/Portrait";
import { useCharacter } from "../state/app";
import { useUnits } from "../units";

const tip = (parts: StatPart[]) => parts.map((p) => `${p.source}: ${formatModifier(p.value)}`).join("\n");

export function SheetPage() {
  const { sheet, character, content } = useCharacter();
  const [paper, setPaper] = useState<PaperSize>(() => settings.get<PaperSize>("paper", "letter"));
  const [pdfStyle, setPdfStyle] = useState<PdfStyle>(() => {
    const v = settings.get<PdfStyle>("pdfStyle", "classic");
    return v === "print" || v === "dark" ? v : "classic";
  });
  const units = useUnits();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportPdf = async () => {
    setExporting(true);
    setExportError(null);
    settings.set("paper", paper);
    settings.set("pdfStyle", pdfStyle);
    try {
      // Loaded on demand to keep the initial bundle small.
      const { characterSheetPdf } = await import("../pdf/characterSheetPdf");
      const bytes = await characterSheetPdf(sheet, character.state, content.registry, { paper, units: units.system, style: pdfStyle });
      const platform = await getPlatform();
      const file = `${(sheet.name || "character").replace(/[\\/:*?"<>|]+/g, "_")}.pdf`;
      await platform.saveBinaryFile(file, bytes, "pdf", "application/pdf");
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  const s = sheet;
  const equipped = character.state.inventory.filter((i) => i.equipped);
  return (
    <div className="sheet-page">
      <div className="sheet-actions no-print row">
        <button className="primary" disabled={exporting} onClick={exportPdf}>
          {exporting ? "Exporting…" : "Export PDF"}
        </button>
        <select value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)} aria-label="Paper size">
          <option value="letter">US Letter</option>
          <option value="a4">A4</option>
        </select>
        <select value={pdfStyle} onChange={(e) => setPdfStyle(e.target.value as PdfStyle)} aria-label="PDF style">
          <option value="classic">Classic</option>
          <option value="print">Printer friendly</option>
          <option value="dark">Dark</option>
        </select>
        <button onClick={() => window.print()}>Print</button>
        {exportError && <span className="error-text small">{exportError}</span>}
      </div>
      <article className="sheet">
        <header className="sheet-header">
          {character.state.portrait && <Portrait src={character.state.portrait} name={s.name} size={110} className="sheet-portrait" />}
          <div className="sheet-title">
            <h1>{s.name}</h1>
            <div>
              {[s.race, s.subrace].filter(Boolean).join(" ")} {s.classSummary && `· ${s.classSummary}`}
            </div>
            <div className="muted small">
              {[s.background, s.alignment, s.size, s.deity].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="headline-stats">
            <Stat label="Armor Class" value={s.armorClass} title={tip(s.armorClassBreakdown)} />
            <Stat label="Initiative" value={formatModifier(s.initiative)} />
            <Stat label="Speed" value={units.distance(s.speed.walk)} />
            <Stat label="Hit Points" value={s.maxHp} title={tip(s.hpBreakdown)} />
            <Stat label="Hit Dice" value={s.hitDice || "—"} />
            <Stat label="Proficiency" value={formatModifier(s.proficiencyBonus)} />
          </div>
        </header>

        <div className="sheet-grid">
          <div className="sheet-col">
            <div className="ability-boxes">
              {s.abilities.map((a) => (
                <div key={a.ability} className="ability-box" title={tip(a.breakdown)}>
                  <div className="abbr">{a.abbr}</div>
                  <div className="mod">{formatModifier(a.modifier)}</div>
                  <div className="score">{a.score}</div>
                </div>
              ))}
            </div>
            <Box title="Saving Throws">
              <ul className="checks">
                {s.savingThrows.map((t) => (
                  <li key={t.name} title={tip(t.breakdown)}>
                    <span className={`prof ${t.proficient ? "on" : ""}`} />
                    <span className="val">{formatModifier(t.total)}</span> {t.name}
                  </li>
                ))}
              </ul>
            </Box>
            <Box title="Skills">
              <ul className="checks">
                {s.skills.map((k) => (
                  <li key={k.name} title={tip(k.breakdown)}>
                    <span className={`prof ${k.expertise ? "exp" : k.proficient ? "on" : ""}`} />
                    <span className="val">{formatModifier(k.total)}</span> {k.name}
                    <span className="muted small"> ({k.ability.slice(0, 3)})</span>
                  </li>
                ))}
              </ul>
            </Box>
            <Box title="Senses">
              <div>Passive Perception {s.passivePerception}</div>
              <div>Passive Insight {s.passiveInsight}</div>
              <div>Passive Investigation {s.passiveInvestigation}</div>
              {s.vision.map((v) => (
                <div key={v.name}>
                  {v.name} {v.range ? units.distance(v.range) : ""}
                </div>
              ))}
            </Box>
          </div>

          <div className="sheet-col">
            <Box title="Proficiencies & Languages">
              <ProfLine label="Armor" items={s.proficiencies.armor} />
              <ProfLine label="Weapons" items={s.proficiencies.weapons} />
              <ProfLine label="Tools" items={s.proficiencies.tools} />
              <ProfLine label="Other" items={s.proficiencies.other} />
              <ProfLine label="Languages" items={s.languages} />
              {s.conditions.length > 0 && <ProfLine label="Defenses" items={s.conditions} />}
              {(s.speed.climb || s.speed.swim || s.speed.fly || s.speed.burrow) > 0 && (
                <ProfLine
                  label="Other speeds"
                  items={(["climb", "swim", "fly", "burrow"] as const).filter((k) => s.speed[k] > 0).map((k) => `${k} ${units.distance(s.speed[k])}`)}
                />
              )}
            </Box>
            <Box title="Equipment">
              {equipped.length === 0 && character.state.inventory.length === 0 && <p className="muted">No equipment.</p>}
              <ul className="plain">
                {character.state.inventory.map((i) => (
                  <li key={i.uid}>
                    {i.quantity > 1 ? `${i.quantity}× ` : ""}
                    {itemName(content.registry, i)}
                    {i.equipped && <span className="muted small"> (equipped)</span>}
                    {i.attuned && <span className="muted small"> (attuned)</span>}
                  </li>
                ))}
              </ul>
              <div className="muted small">
                {formatCurrency(character.state.currency)}
                {currencyValue(character.state.currency) > 0 && ` (worth ${formatPrice(currencyValue(character.state.currency))})`}
              </div>
            </Box>
            {s.spellcasting.map((sc) => (
              <Box key={sc.name} title={`Spellcasting: ${sc.name}`}>
                <div className="row wrap small">
                  <span>Ability: {sc.ability}</span>
                  <span>Spell attack: {formatModifier(sc.attack)}</span>
                  <span>Save DC: {sc.dc}</span>
                  {sc.prepareCount !== undefined && (
                    <span>
                      Prepared: {sc.preparedCount}/{sc.prepareCount}
                    </span>
                  )}
                </div>
                <div className="slots">
                  {sc.slots.map((n, i) =>
                    n > 0 ? (
                      <span key={i} className="slot">
                        {i + 1}: {"◯".repeat(Math.min(n, 9))}
                      </span>
                    ) : null,
                  )}
                </div>
                {sc.spells.some((sp) => sp.prepared) && (
                  <ul className="plain spells">
                    {sc.spells.filter((sp) => sp.prepared).map((sp) => (
                      <li key={sp.id}>
                        <span className="muted small">{sp.level === 0 ? "C" : sp.level}</span> {sp.name}
                        {sp.alwaysPrepared && <span className="muted small"> (always)</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Box>
            ))}
          </div>

          <div className="sheet-col wide">
            <Box title="Attacks">
              <table className="attacks">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Hit</th>
                    <th>Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {s.attacks.map((a) => (
                    <tr key={a.key} className={a.proficient ? undefined : "not-proficient"}>
                      <td>
                        {a.name}
                        <div className="muted small">{attackDetails(a, units.system)}</div>
                      </td>
                      <td className="num" title={tip(a.attackBreakdown)}>
                        {formatModifier(a.attack)}
                      </td>
                      <td>{a.damage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
            <Box title="Features & Traits">
              {s.features.map((f) => (
                <div key={f.id} className="feature">
                  <h4>
                    {f.name}
                    {f.category && <span className="badge feat-category">{f.category} feat</span>}
                    {f.origin && <span className="muted small"> · {f.origin}</span>}
                    {f.usage && <span className="muted small"> · {units.text(f.usage)}</span>}
                    {f.action && <span className="muted small"> · {f.action}</span>}
                  </h4>
                  <p>{units.text(f.text)}</p>
                </div>
              ))}
            </Box>
            {s.companion && <CompanionBlock c={s.companion} />}
            {(character.state.details.traits || character.state.details.backstory) && (
              <Box title="Personality & Background">
                {(["traits", "ideals", "bonds", "flaws", "backstory"] as const).map((k) =>
                  character.state.details[k] ? (
                    <p key={k}>
                      <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong> {character.state.details[k]}
                    </p>
                  ) : null,
                )}
              </Box>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="stat" title={title}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="box">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ProfLine({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  const clean = items.map((i) => i.replace(/^(Armor|Weapon|Tool) Proficiency \((.*)\)$/, "$2"));
  return (
    <p className="prof-line">
      <strong>{label}:</strong> {clean.join(", ")}
    </p>
  );
}
