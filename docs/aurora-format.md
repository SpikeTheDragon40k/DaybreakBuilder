# Aurora content format: behaviour reference

This document describes how Aurora Builder content files behave, as implemented by
`@daybreakbuilder/engine`. It was written by observing the file format, the
community content in [AuroraLegacy/elements](https://github.com/AuroraLegacy/elements)
and the original application's behaviour. It is the reference for anyone changing
the engine. If you find content that behaves differently in Aurora, add a test and
update this file.

## Files

### Index files (`*.index`)

```xml
<index>
  <info>
    <name>Core</name>
    <update version="0.2.8"><file name="core.index" url="https://…/core.index" /></update>
  </info>
  <files>
    <file name="players-handbook.index" url="https://…/players-handbook.index" />
    <file name="race-dwarf.xml" url="https://…/race-dwarf.xml" />
  </files>
</index>
```

An index lists element files and further indexes. Downloading an index means
walking it recursively and fetching every `.xml` it references
(`downloadIndex` in `content.ts`).

### Element files (`*.xml`)

```xml
<elements>
  <info>…</info>
  <element name="Dwarf" type="Race" source="Player’s Handbook" id="ID_SRD_RACE_DWARF">
    <supports>…</supports>          <!-- comma-separated keywords -->
    <requirements>…</requirements>  <!-- expression; element is unavailable unless true -->
    <prerequisite>…</prerequisite>  <!-- human-readable text only -->
    <description>…HTML…</description>
    <sheet display="false" alt="…"><description level="5">…{{stat}}…</description></sheet>
    <setters><set name="hd">d10</set>…</setters>
    <spellcasting name="Wizard" ability="Intelligence" prepare="true"><list>Wizard</list></spellcasting>
    <multiclass id="ID_…_MULTICLASS_…">…</multiclass>   <!-- classes only -->
    <rules>…</rules>
  </element>
  <append id="ID_EXISTING">          <!-- extends an element defined elsewhere -->
    <supports>Extra Keyword</supports>
    <rules>…</rules>
  </append>
</elements>
```

* **Ids are global.** If the same id is loaded twice, the later file wins. Built-in
  core content loads first, so user content can override it.
* **Appends** merge their supports, setters (only ones not already present), rules
  and spellcasting into the target after all files are loaded.
* `<div element="ID_X"/>` inside a description embeds element X's description.

## Rules

Rules run in document order for every element on the character.

### `<grant type="…" id="…" level="N" requirements="…"/>`

Adds the element `id` to the character as a child of the granting element, provided:

* `level` (default 1) ≤ the progression level of the granting element (see
  *Levels and progressions*);
* the rule's `requirements` hold. These are evaluated **without** the elements this
  same element granted through its other *conditional* grants (ones with `requirements`), so
  conditional grants cannot keep each other alive. Its unconditional grants do count: a
  multiclass element's `ID_INTERNAL_GRANT_MULTICLASS` satisfies its own class's
  `requirements="ID_INTERNAL_GRANT_MULTICLASS"` spell slot grant;
* the granted element's own `<requirements>` hold.

`id` may list several ids separated by commas. `spellcasting` and `prepared`
attributes on a grant mark granted spells as belonging to a caster, and as always
prepared.

### `<select type="…" name="…" number="N" supports="…" level="N" requirements="…" optional="true" default="ID"/>`

Asks the user to choose `number` elements of `type` that match `supports`.

* The choice is stored under the key `path|name`, where `path` is the chain of
  element ids from the root (`ID_LEVEL_1/ID_RACE/…`). Aurora's `.dnd5e` files use
  the same tree, which is what makes importing them possible.
* An element already on the character can't be chosen again, unless it has the
  setter `allow duplicate` = `true`.
* `type="List"` selects from inline `<item id="1">text</item>` children instead of
  elements.
* `type="Spell"` selects carry `spellcasting="Wizard"` to attribute the spell.

### `<stat name="…" value="…" bonus="…" level="N" requirements="…" equipped="…" maximum="…" alt="…" inline="true"/>`

Contributes to a named statistic. Names are case-insensitive and lower-cased.
`value` is an integer, another statistic's name, or `-name` for its negation.

* **Stacking:** all contributions without `bonus` are summed. Contributions that
  share a `bonus` value don't stack: only the highest counts, and a group of
  several never goes below 0. Example: proficiency (`bonus="proficiency"`) and
  expertise (`bonus="double"`) both add the proficiency bonus, so expertise
  doubles it.
* `maximum` (alias `cap`) caps the contribution; it may be a stat name.
* `equipped` is an expression over the inventory (see below).
* `inline="true"` defines a text value for `{{name}}` substitution instead of a number.
* Legacy names such as `Strength Modifier` are mapped to `strength:modifier`.

## Built-in statistics

These are computed by the engine rather than by content:

| Statistic | Meaning |
|---|---|
| `level` | character level |
| `level:<class name>` | levels in that class (e.g. `level:fighter`) |
| `<ability>` | **bonus** to the ability from content (racial bonuses, ASIs…) |
| `<ability>:score` | base + bonus, capped by `<ability>:max`, raised to `<ability>:score:set` if that is higher |
| `<ability>:modifier` | ⌊(score − 10) / 2⌋ |
| `X:half`, `X:half:up` | half of X, truncated toward zero, or rounded up |
| `hp` | class hit dice (max at level 1, then average or rolled) plus content (`constitution:modifier` per level comes from core content) |
| `ac` | `ac` contributions + `ac:calculation` + `ac:shield` + `ac:misc` (each of those three only if positive) |

Sheet values are derived as:

* skill = ability modifier + `<skill>:proficiency` + `<skill>:misc`
* saving throw = ability modifier + `<ability>:save:proficiency` + `<ability>:save:misc`
* passive skill = 10 + skill + `<skill>:passive`
* spell attack = `spellcasting:attack:<abbr>` + `<caster>:spellcasting:attack`, and the
  same pattern for `dc`
* spell slots = `<caster>:spellcasting:slots:<1-9>`

Everything else (proficiency bonus, base AC formulas, speeds, initiative…) is
defined by content in `content/core`.

## Expressions

Used by `requirements`, `supports` and `equipped`.

| Syntax | Meaning |
|---|---|
| `,` `&` `&&` | and |
| `\|` `\|\|` | or (and binds tighter than or) |
| `!` | not |
| `( )` | grouping |
| `ID_X` | the character has element `ID_X` (requirements) |
| `[str:13]` … `[cha:13]` | ability score ≥ 13 |
| `[level:5]` | progression level of the current element ≥ 5 |
| `[character:5]` | character level ≥ 5 |
| `[level:fighter:3]` / `[fighter:3]` | fighter level ≥ 3 |
| `[type:archetype]` | the character has any element of that type |
| `[some:stat:10]` | statistic ≥ 10 |
| `Keyword` | the candidate element's supports list contains `Keyword` (supports) |
| `ID_A\|ID_B` | in `supports`, a single-pipe list of ids means "exactly one of these elements" |
| `[armor:none\|any\|light\|medium\|heavy\|<id or name>]` | equipped armor (equipped) |
| `[shield:…]`, `[main:…]`, `[offhand:…]` | equipped shield / main hand / off hand (`weapon`, `any`, `none`, id or name) |

## Levels and progressions

* The character's roots are one `Level` element per character level
  (`ID_LEVEL_1` …), selected by their `Level` setter, plus enabled `Option` elements
  and equipped (or attuned) items.
* `ID_LEVEL_1` selects Race, Class, Background, Alignment and Deity.
* The starting class progresses with the levels assigned to it. Rules inside the
  class subtree compare `level` against the **class level**. Rules elsewhere compare
  against the **character level**.
* A `<multiclass id>` node on a class defines a separate element of type `Multiclass`
  whose rules are the class rules followed by the multiclass rules. Class rules meant
  only for a starting class exclude themselves with requirements such as
  `!ID_WOTC_PHB_MULTICLASS_FIGHTER`. When a character takes a new class at level N, the
  `Level N` element carries the class's multiclass element and the marker grant
  `ID_INTERNAL_MULTICLASS_LEVEL_N`.
* Because requirements can depend on any element or statistic, the engine rebuilds
  the tree until the set of element ids and the ability scores stop changing.

## 2024 rules: backgrounds and Origin feats

The 2024 rules move ability score increases and a feat from the species to the
background. Content written for Aurora expresses this with ordinary rules, and the
built-in core content (`content/core/background-ability-scores.xml`) defines the
shared elements it relies on, with the same ids as the community content:

* **Feat categories** are `<supports>` keywords: `Origin`, `General`,
  `Fighting Style`, `Epic Boon`. `featCategory()` reads them; the builder shows the
  category in pickers and on the sheet, and the picker filters by it.
* **A background's Origin feat** is a `<grant type="Feat" id="…"/>`, or a
  `<select type="Feat" supports="Origin"/>` when the player chooses (custom
  backgrounds, the human's Versatile trait). Nothing else is needed.
* **Ability scores**: the background grants the combination element for its three
  abilities, `ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_<A>_<B>_<C>` (abilities
  abbreviated and in sheet order, e.g. `INT_WIS_CHA`). The player then picks
  "+2, +1" (two selects, which can't pick the same ability twice) or "+1, +1, +1".
  A custom background selects the combination with
  `supports="Custom Background Ability Score Combination"`.
* **Species increases**: the background also grants the marker
  `ID_INTERNAL_GRANTS_BACKGROUND_ASI`. Older species make their increases conditional
  on it (`requirements="!ID_INTERNAL_GRANTS_BACKGROUND_ASI"`), so a 2014 species with a
  2024 background follows the 2024 rule. The bundled SRD 5.1 races do this too.

```xml
<element name="Temple Hand" type="Background" source="…" id="ID_…_BACKGROUND_TEMPLE_HAND">
  <rules>
    <grant type="Ability Score Improvement" id="ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_INT_WIS_CHA" />
    <grant type="Feat" id="ID_…_FEAT_ALERT" />
    <grant type="Proficiency" id="ID_PROFICIENCY_SKILL_INSIGHT" />
    <grant type="Grants" id="ID_INTERNAL_GRANTS_BACKGROUND_ASI" />
  </rules>
</element>
```

## Starting wealth and prices

Items are priced by their `cost` setter (`<set name="cost" currency="gp">5</set>`); the
Equipment tab uses it to buy (paying with the largest coins that fit and taking change)
and to sell for half.

A new character picks its starting wealth from its starting class and background
(`startingWealth` in `currency.ts`):

* Class: the `starting wealth` setter, either dice (`5d4x10`, the 2014 "Starting Wealth
  by Class") or a fixed amount (`155`, the 2024 gold taken instead of the class's
  equipment). Without it, the PHB table is used by class name (the 2024 table when the
  element's source mentions 2024).
* Background: the `starting gold` setter (gold that comes with its equipment) and
  `starting gold instead` (2024 option B). Without them, the amounts are read from the
  description's "Equipment:" text: "a pouch containing 15 gp" or "(A) …, 8 GP; or (B) 50 GP".

With dice (2014 rules) the choice is equipment plus the background's pouch, or rolled /
average gold instead of all of it. With fixed amounts (2024 rules) class and background
are each taken as equipment or gold. The choice is saved as `startingWealth` on the
character so the gold is granted once and can be changed or removed.

## Character files

DaybreakBuilder saves characters as JSON (`CharacterState` in `character.ts`). The state
stores only decisions (levels, choices keyed by path, ability scores, inventory). The
engine recomputes everything else, so characters update when content changes.

Aurora `.dnd5e` files can be imported (`importAuroraCharacter`). The build tree maps
directly onto selection keys. Rolled hit points, inventory, currency and the
descriptive fields are carried over.
