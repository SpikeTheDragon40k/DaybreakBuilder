# Conversion reference

Templates and patterns for each kind of element. Everything here matches what
`content/srd/` does and what `npm run validate-content` checks. For rule
semantics see `docs/aurora-format.md`.

## File skeleton

```xml
<?xml version="1.0" encoding="utf-8"?>
<elements>
	<info>
		<name>Player’s Handbook: Spells</name>
		<description>Spells from the Player’s Handbook (personal conversion).</description>
		<author>converted with dndbuilder</author>
	</info>

	<element …>…</element>
</elements>
```

## Ids

Upper case, `ID_` + `A-Z 0-9 _`. **Reuse the existing id when the element
already exists** (grep `content/`, and `fixtures/external/aurora-legacy/` if
present). Otherwise, with `XXX` = book abbreviation:

| Kind | Pattern | Example |
|---|---|---|
| Class | `ID_WOTC_XXX_CLASS_<CLASS>` | `ID_WOTC_PHB_CLASS_WIZARD` |
| Multiclass | `ID_WOTC_XXX_MULTICLASS_<CLASS>` | `ID_WOTC_PHB_MULTICLASS_WIZARD` |
| Class Feature | `ID_WOTC_XXX_CLASS_FEATURE_<CLASS>_<NAME>` | `ID_WOTC_PHB_CLASS_FEATURE_WIZARD_ARCANE_RECOVERY` |
| Archetype | `ID_WOTC_XXX_ARCHETYPE_<CLASS>_<NAME>` | `ID_WOTC_PHB_ARCHETYPE_WIZARD_SCHOOL_OF_DIVINATION` |
| Archetype Feature | `ID_WOTC_XXX_ARCHETYPE_FEATURE_<CLASS>_<SUBCLASS>_<NAME>` | `ID_WOTC_PHB_ARCHETYPE_FEATURE_WIZARD_DIVINATION_PORTENT` |
| Race / Sub Race | `ID_RACE_<NAME>`, `ID_SUB_RACE_<NAME>` (core books); `ID_WOTC_XXX_RACE_<NAME>` otherwise | `ID_SUB_RACE_WOOD_ELF` |
| Racial Trait | `ID_RACIAL_TRAIT_<NAME>` / `ID_WOTC_XXX_RACIAL_TRAIT_<NAME>` | `ID_RACIAL_TRAIT_FEY_ANCESTRY` |
| Background (+ Feature) | `ID_BACKGROUND_<NAME>`, `ID_BACKGROUND_FEATURE_<NAME>` | `ID_BACKGROUND_SAGE` |
| Feat | `ID_XXX_FEAT_<NAME>` | `ID_PHB_FEAT_ALERT` |
| Spell | `ID_XXX_SPELL_<NAME>` | `ID_PHB_SPELL_FIREBALL` |
| Item / Weapon / Armor | `ID_WOTC_XXX_ITEM_<NAME>`, `…_WEAPON_<NAME>`, `ID_WOTC_ARMOR_<GROUP>_<NAME>` | `ID_WOTC_PHB_WEAPON_LONGSWORD` |
| Magic Item | `ID_WOTC_XXX_MAGIC_ITEM_<NAME>` | `ID_WOTC_DMG_MAGIC_ITEM_CLOAK_OF_PROTECTION` |
| Creature / companion | `ID_WOTC_XXX_COMPANION_<NAME>`, traits `…_COMPANION_TRAIT_<CREATURE>_<NAME>`, actions `…_COMPANION_ACTION_<CREATURE>_<NAME>` | `ID_WOTC_MM_COMPANION_WOLF` |

Drop apostrophes; spaces and hyphens become `_` (`Hunter’s Mark` → `HUNTERS_MARK`).

## Vocabulary that already exists

Grep for the exact id, never invent these:

| What | Ids | File |
|---|---|---|
| Skills | `ID_PROFICIENCY_SKILL_<SKILL>` (`ANIMALHANDLING`, `SLEIGHTOFHAND`) | `content/srd/basics.xml` |
| Saving throws | `ID_PROFICIENCY_SAVINGTHROW_<ABILITY>` | `content/srd/basics.xml` |
| Armor, weapons, tools, gaming sets, instruments | `ID_PROFICIENCY_ARMOR_PROFICIENCY_…`, `ID_PROFICIENCY_WEAPON_PROFICIENCY_…`, `ID_PROFICIENCY_TOOL_PROFICIENCY_…` | `content/srd/basics.xml` |
| Languages | `ID_LANGUAGE_<NAME>`; supports `Standard`, `Exotic` | `content/srd/basics.xml` |
| Sizes | `ID_SIZE_TINY` … `ID_SIZE_GARGANTUAN` | `content/core/sizes-conditions.xml` |
| Senses | `ID_VISION_DARKVISION`, `…_BLINDSIGHT`, `…_TREMORSENSE`, `…_TRUESIGHT` | `content/srd/basics.xml` |
| Resistance / immunity / vulnerability | `ID_INTERNAL_CONDITION_DAMAGE_RESISTANCE_<TYPE>` (also `_IMMUNITY_`, `_VULNERABILITY_`) | `content/core/sizes-conditions.xml` |
| Fighting styles | `supports="Fighting Style,<Class>"`, `ID_SRD_FIGHTING_STYLE_*` | `content/srd/class-options.xml` |
| ASI / feat option | `supports="Improvement Option"` | `content/srd/class-options.xml` |

If the book adds a new language, tool or fighting style, define it in your files
following the same pattern (same type and supports).

## Spell

```xml
<element name="Fireball" type="Spell" source="Player’s Handbook" id="ID_PHB_SPELL_FIREBALL">
	<supports>Sorcerer, Wizard</supports>  <!-- every class list the spell is on, by class name -->
	<description><p>A bright streak flashes…</p><p><strong><em>At Higher Levels.</em></strong> When you cast…</p></description>
	<setters>
		<set name="level">3</set>               <!-- 0 for cantrips -->
		<set name="school">Evocation</set>      <!-- capitalised school name -->
		<set name="time">1 action</set>         <!-- "1 bonus action", "1 reaction, which you take when…", "1 minute" -->
		<set name="range">150 feet</set>        <!-- "Self (15-foot cone)", "Touch" -->
		<set name="duration">Instantaneous</set> <!-- "Concentration, up to 1 minute" → isConcentration true, duration "Up to 1 minute" is also fine -->
		<set name="hasVerbalComponent">true</set>
		<set name="hasSomaticComponent">true</set>
		<set name="hasMaterialComponent">true</set>
		<set name="materialComponent">a tiny ball of bat guano and sulfur</set>
		<set name="isConcentration">false</set>
		<set name="isRitual">false</set>
	</setters>
</element>
```

Class lists come from the book's spell lists chapter: make sure each spell's
`<supports>` names every class that has it. Spells for subclass lists (domain
spells, oath spells) are granted by the subclass, not added to `<supports>`.

## Feat

```xml
<element name="War Caster" type="Feat" source="Player’s Handbook" id="ID_PHB_FEAT_WAR_CASTER">
	<prerequisite>The ability to cast at least one spell</prerequisite>   <!-- text shown to the user -->
	<requirements>[type:spell]</requirements>  <!-- machine check, only when expressible: [str:13], [dex:13]||[str:13], ID_… -->
	<description><p>…</p><ul><li>…</li></ul></description>
	<sheet><description>Advantage on concentration saves; somatic components with full hands; cast a spell as an opportunity attack.</description></sheet>
	<rules>
		<stat name="dexterity" value="1" />                       <!-- fixed ability increase -->
		<select type="Ability Score Improvement" name="Ability Score Increase (Resilient)" supports="Ability Score Improvement,Class" />  <!-- "+1 to an ability of your choice" -->
		<select type="Proficiency" name="Skill (Skilled)" supports="Skill" number="3" />
	</rules>
</element>
```

Feats are offered by the ASI "Feat" option, which shows when the user enables
feats; nothing else is needed for them to be selectable. 2024 feats also carry
their category in `<supports>` (see 2024 backgrounds below).

## Background

```xml
<element name="Sage" type="Background" source="Player’s Handbook" id="ID_BACKGROUND_SAGE">
	<description><p>…</p><p><strong>Skill Proficiencies:</strong> Arcana, History …</p></description>
	<sheet display="false" />
	<setters><set name="short">You spent years learning the lore of the multiverse.</set></setters>
	<rules>
		<grant type="Proficiency" id="ID_PROFICIENCY_SKILL_ARCANA" />
		<grant type="Proficiency" id="ID_PROFICIENCY_SKILL_HISTORY" />
		<select type="Language" name="Languages (Sage)" supports="Standard||Exotic" number="2" />
		<grant type="Background Feature" id="ID_BACKGROUND_FEATURE_RESEARCHER" />
	</rules>
</element>
<element name="Researcher" type="Background Feature" source="Player’s Handbook" id="ID_BACKGROUND_FEATURE_RESEARCHER">
	<description><p>…</p></description>
	<sheet><description>Short version for the character sheet.</description></sheet>
</element>
```

Personality trait / ideal / bond / flaw tables go into the description as
`<table>`s; they're not rules.

### 2024 backgrounds (Player’s Handbook 2024 and later)

A 2024 background lists three abilities, an Origin feat, two skills, a tool and
equipment. The abilities and the marker use built-in ids (see
`content/core/background-ability-scores.xml`); grep for the exact combination id,
abilities in sheet order (`STR_DEX_CON` … `INT_WIS_CHA`):

```xml
<element name="Sage" type="Background" source="Player’s Handbook (2024)" id="ID_WOTC_PHB24_BACKGROUND_SAGE">
	<description><p>…</p></description>
	<setters><set name="short">Constitution, Intelligence, Wisdom, Magic Initiate (Wizard), Arcana and History</set></setters>
	<rules>
		<grant type="Ability Score Improvement" id="ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_CON_INT_WIS" />
		<grant type="Feat" id="ID_WOTC_PHB24_FEAT_MAGIC_INITIATE_WIZARD" />   <!-- the Origin feat -->
		<grant type="Proficiency" id="ID_PROFICIENCY_SKILL_ARCANA" />
		<grant type="Proficiency" id="ID_PROFICIENCY_SKILL_HISTORY" />
		<grant type="Proficiency" id="ID_PROFICIENCY_TOOL_PROFICIENCY_CALLIGRAPHERS_SUPPLIES" />
		<grant type="Grants" id="ID_INTERNAL_GRANTS_BACKGROUND_ASI" />          <!-- turns off species ASIs -->
	</rules>
</element>
```

Feats get their 2024 category as a supports keyword: `<supports>Origin</supports>`,
`General`, `Fighting Style` or `Epic Boon`. A choice of Origin feat is
`<select type="Feat" name="Origin Feat (…)" supports="Origin" />`. 2024 species have no
ability score increases.

## Race and subrace

```xml
<element name="Elf" type="Race" source="Player’s Handbook" id="ID_RACE_ELF">
	<description><p>…</p></description>
	<sheet display="false" />
	<rules>
		<stat name="dexterity" value="2" alt="Racial Ability Score Increase" />
		<stat name="innate speed" value="30" bonus="base" />
		<grant type="Size" id="ID_SIZE_MEDIUM" />
		<grant type="Vision" id="ID_VISION_DARKVISION" />
		<grant type="Language" id="ID_LANGUAGE_COMMON" />
		<grant type="Language" id="ID_LANGUAGE_ELVISH" />
		<grant type="Racial Trait" id="ID_RACIAL_TRAIT_FEY_ANCESTRY" />
		<select type="Sub Race" name="Elven Subrace" supports="Elf" />
	</rules>
</element>
<element name="Wood Elf" type="Sub Race" source="Player’s Handbook" id="ID_SUB_RACE_WOOD_ELF">
	<supports>Elf</supports>   <!-- must match the race's Sub Race select -->
	<description><p>…</p></description>
	<sheet display="false" />
	<rules>
		<stat name="wisdom" value="1" alt="Racial Ability Score Increase" />
		<stat name="innate speed" value="35" bonus="base" />   <!-- replaces 30: same bonus group, highest wins -->
		<grant type="Racial Trait" id="ID_RACIAL_TRAIT_MASK_OF_THE_WILD" />
	</rules>
</element>
<element name="Fey Ancestry" type="Racial Trait" source="Player’s Handbook" id="ID_RACIAL_TRAIT_FEY_ANCESTRY">
	<description><p>You have advantage on saving throws against being charmed, and magic can’t put you to sleep.</p></description>
	<sheet><description>Advantage on saves against being charmed; magic can’t put you to sleep.</description></sheet>
</element>
```

Patterns:

- "+1 to two other abilities": `<select type="Ability Score Improvement" name="Ability Score Increase (Half-Elf)" number="2" supports="Ability Score Improvement,Class,!Charisma" />`
- extra skill / language / tool of choice: `<select type="Proficiency" … supports="Skill" />`, `<select type="Language" … supports="Standard||Exotic" />`
- damage resistance: `<grant type="Condition" id="ID_INTERNAL_CONDITION_DAMAGE_RESISTANCE_FIRE" />`
- innate spells by level: `<grant type="Spell" id="ID_PHB_SPELL_HELLISH_REBUKE" level="3" />`, with one `<sheet><description level="N">` per stage
- hit point bonus per level (Dwarven Toughness): one `<stat name="hp" value="1" level="N" />` per level 1–20 (see Hill Dwarf in `content/srd/races.xml`)
- walking speed is `innate speed` with `bonus="base"`; other speeds `innate speed:fly`, `innate speed:swim`, `innate speed:climb` (e.g. `<stat name="innate speed:swim" value="30" />`)

## Class

A class is the class element, one `Class Feature` per feature, a
`<multiclass>` node, and stat rules for every column of the class table. Use
`content/srd/classes/class-<similar class>.xml` as the model; the order below
is what those files do.

```xml
<element name="Wizard" type="Class" source="Player’s Handbook" id="ID_WOTC_PHB_CLASS_WIZARD">
	<description><p>…</p></description>
	<sheet display="false" />
	<setters>
		<set name="hd">d6</set>
		<set name="short">A scholarly magic-user…</set>
		<set name="primary">Intelligence</set>
	</setters>
	<spellcasting name="Wizard" ability="Intelligence" prepare="true">
		<list>Wizard</list>   <!-- prepared from the whole list (cleric, druid, paladin): <list known="true">Cleric</list> -->
	</spellcasting>            <!-- spells known (bard, sorcerer, ranger, warlock): prepare="false" -->
	<multiclass id="ID_WOTC_PHB_MULTICLASS_WIZARD">
		<prerequisite>Intelligence 13</prerequisite>
		<requirements>[int:13]</requirements>
		<setters><set name="multiclass proficiencies">—</set></setters>
		<rules>
			<grant type="Grants" id="ID_INTERNAL_GRANT_MULTICLASS" />
			<!-- proficiencies gained when multiclassing into this class -->
		</rules>
	</multiclass>
	<rules>
		<!-- starting proficiencies: only for a first class -->
		<grant type="Proficiency" id="ID_PROFICIENCY_SAVINGTHROW_INTELLIGENCE" requirements="!ID_WOTC_PHB_MULTICLASS_WIZARD" />
		<select type="Proficiency" name="Skill Proficiency (Wizard)" supports="Skill,Wizard" number="2" requirements="!ID_WOTC_PHB_MULTICLASS_WIZARD" />
		<!-- features, at the level from the class table -->
		<grant type="Class Feature" id="ID_WOTC_PHB_CLASS_FEATURE_WIZARD_ARCANE_RECOVERY" level="1" />
		<grant type="Class Feature" id="ID_WOTC_PHB_CLASS_FEATURE_WIZARD_ASI_4" level="4" />
		<!-- spell slots: increments per level (1st: 2 at level 1, +1 at 2, +1 at 3 → 4) -->
		<stat name="wizard:spellcasting:slots:1" value="2" level="1" />
		<stat name="wizard:spellcasting:slots:1" value="1" level="2" />
		<grant type="Grants" id="ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_FULL" requirements="ID_INTERNAL_GRANT_MULTICLASS" />
		<!-- cantrips -->
		<stat name="wizard:spellcasting:cantrips known" value="3" level="1" />
		<select type="Spell" supports="$(spellcasting:list),0" spellcasting="Wizard" name="Cantrip (Wizard)" level="1" number="3" />
		<!-- spellbook / spells known: one select per level where the count grows -->
		<select type="Spell" name="Spellbook (Wizard)" supports="$(spellcasting:list),1" number="6" spellcasting="Wizard" />
		<select type="Spell" name="Spellbook (Wizard)" supports="$(spellcasting:list),$(spellcasting:slots)" number="2" spellcasting="Wizard" level="2" />
	</rules>
</element>
```

**Stat rules add up**: each `<stat>` at `level="N"` adds its value from level N
on. Encode table columns as increments (`value="1" level="5"`), or reduce with
negative values when a column drops (warlock slots move up a level).

Feature patterns:

```xml
<!-- subclass choice -->
<element name="Arcane Tradition" type="Class Feature" … id="ID_WOTC_PHB_CLASS_FEATURE_WIZARD_ARCANE_TRADITION">
	<description><p>…</p></description>
	<sheet display="false" />
	<rules><select type="Archetype" name="Arcane Tradition" supports="Arcane Tradition" /></rules>
</element>

<!-- ability score improvement: one element per level it appears at -->
<element name="Ability Score Improvement" type="Class Feature" … id="ID_WOTC_PHB_CLASS_FEATURE_WIZARD_ASI_4">
	<description><p>…</p></description>
	<sheet display="false" />
	<rules><select type="Class Feature" name="Improvement Option (Wizard 4)" supports="Improvement Option" /></rules>
</element>

<!-- uses that scale: a stat per table column, shown on the sheet -->
<element name="Rage" type="Class Feature" … id="ID_WOTC_PHB_CLASS_FEATURE_BARBARIAN_RAGE">
	<description><p>…</p></description>
	<sheet>
		<description usage="{{rage:count}}/Long Rest" action="Bonus Action">+{{rage:damage}} melee damage, resistance to bludgeoning, piercing and slashing.</description>
	</sheet>
	<rules>
		<stat name="rage:count" value="2" level="1" />
		<stat name="rage:count" value="1" level="3" />
		<stat name="rage:damage" value="2" level="1" />
	</rules>
</element>

<!-- text that changes with level -->
<sheet>
	<description level="5">You can attack twice…</description>
	<description level="11">You can attack three times…</description>
</sheet>

<!-- alternative AC formula (unarmored defense): build a named total, then offer it as a calculation;
     the highest calculation wins -->
<stat name="ac:monk" value="10" />
<stat name="ac:monk" value="dexterity:modifier" />
<stat name="ac:monk" value="wisdom:modifier" />
<stat name="ac:calculation" value="ac:monk" bonus="calculation" equipped="[armor:none],[shield:none]" alt="Unarmored Defense" />

<!-- fighting style -->
<select type="Class Feature" name="Fighting Style (Fighter)" supports="Fighting Style,Fighter" />

<!-- expertise: two skills you're proficient in get double proficiency -->
<select type="Proficiency" name="Expertise (Rogue)" supports="Expertise" number="2" />
```

Multiclass slot grants: full casters `…_SLOTS_FULL`, half casters (paladin,
ranger) `…_SLOTS_HALF`, one-third (subclass casters such as Eldritch Knight)
`…_SLOTS_THIRD`, warlock pact magic `…_SLOTS_SOLO`. Look at the SRD class of
the same kind and copy its pattern.

Useful built-in stats: `<ability>` (bonus), `<ability>:max`, `hp`,
`innate speed`, `ac:misc`, `initiative:misc`, `<skill>:proficiency`,
`<skill>:misc`, `<ability>:save:misc`, `proficiency`, `level`,
`level:<class>`, `<ability>:modifier`, `proficiency:half`.

## Subclass

```xml
<element name="School of Divination" type="Archetype" source="Player’s Handbook" id="ID_WOTC_PHB_ARCHETYPE_WIZARD_SCHOOL_OF_DIVINATION">
	<supports>Arcane Tradition, Wizard</supports>   <!-- the class's Archetype select supports -->
	<description><p>…</p></description>
	<sheet display="false" />
	<rules>
		<!-- levels are CLASS levels, matching the class feature table -->
		<grant type="Archetype Feature" id="ID_WOTC_PHB_ARCHETYPE_FEATURE_WIZARD_DIVINATION_PORTENT" level="2" />
		<!-- always-prepared subclass spells -->
		<grant type="Spell" id="ID_PHB_SPELL_BLESS" level="1" spellcasting="Cleric" prepared="true" />
	</rules>
</element>
```

A subclass that adds spellcasting to a non-caster (Eldritch Knight, Arcane
Trickster) gets its own `<spellcasting name="Eldritch Knight" ability="Intelligence"><list>Wizard</list></spellcasting>`
plus slot stats named after that caster (`eldritch knight:spellcasting:slots:1`).

## Equipment

```xml
<element name="Longsword" type="Weapon" source="Player’s Handbook" id="ID_WOTC_PHB_WEAPON_LONGSWORD">
	<supports>ID_INTERNAL_WEAPON_CATEGORY_MARTIAL_MELEE, Martial Melee, ID_INTERNAL_DAMAGE_TYPE_SLASHING, ID_INTERNAL_WEAPON_PROPERTY_VERSATILE</supports>
	<description><p>…</p></description>
	<setters>
		<set name="category">Weapons</set>
		<set name="cost" currency="gp">15</set>
		<set name="weight" lb="3">3 lb.</set>
		<set name="damage" type="slashing">1d8</set>
		<set name="versatile">1d10</set>
		<set name="properties">Versatile (1d10)</set>
		<set name="proficiency">ID_PROFICIENCY_WEAPON_PROFICIENCY_LONGSWORD</set>
	</setters>
</element>
```

Armor needs `<set name="armor">Light|Medium|Heavy|Shield</set>` and an AC rule
(`<stat name="ac:armored:armor" value="11" />`, shields `ac:shield`); copy the
pattern from `content/srd/equipment.xml` (shields: `<stat name="ac:shield" value="2" bonus="shield" />`). Adventuring gear is `type="Item"`
with `category`, `cost`, `weight`.

```xml
<element name="Cloak of Protection" type="Magic Item" source="Dungeon Master’s Guide" id="ID_WOTC_DMG_MAGIC_ITEM_CLOAK_OF_PROTECTION">
	<description><p>You gain a +1 bonus to AC and saving throws while you wear this cloak.</p></description>
	<setters>
		<set name="category">Wondrous Items</set>
		<set name="type">Wondrous Item</set>
		<set name="rarity">Uncommon</set>
		<set name="attunement">true</set>   <!-- or the requirement text: "by a spellcaster" -->
		<set name="slot">shoulders</set>
	</setters>
	<rules>   <!-- applied while equipped/attuned -->
		<stat name="ac:misc" value="1" />
		<stat name="strength:save:misc" value="1" />
	</rules>
</element>
```

## Creatures (companions, familiars, wild shapes)

```xml
<element name="Wolf" type="Companion" source="Monster Manual" id="ID_WOTC_MM_COMPANION_WOLF">
	<description><p>…</p></description>
	<setters>
		<set name="strength">12</set> … one per ability …
		<set name="ac">13 (natural armor)</set>
		<set name="hp">11 (2d8+2)</set>
		<set name="speed">40 ft.</set>
		<set name="skills">Perception +3, Stealth +4</set>
		<set name="senses">passive Perception 13</set>
		<set name="languages">—</set>
		<set name="type">Beast</set>
		<set name="size">Medium</set>
		<set name="alignment">unaligned</set>
		<set name="challenge">1/4</set>
		<set name="traits">ID_WOTC_MM_COMPANION_TRAIT_WOLF_PACK_TACTICS</set>
		<set name="actions">ID_WOTC_MM_COMPANION_ACTION_WOLF_BITE</set>
	</setters>
	<rules>
		<stat name="companion:ac" value="13" />
		<stat name="companion:hp:max" value="11" bonus="base" />
		<stat name="companion:speed" value="40" bonus="base" />
		<stat name="companion:perception:proficiency" value="companion:proficiency" bonus="base" />
	</rules>
</element>
<element name="Pack Tactics" type="Companion Trait" source="Monster Manual" id="ID_WOTC_MM_COMPANION_TRAIT_WOLF_PACK_TACTICS">
	<description><p>…</p></description>
	<sheet><description>…</description></sheet>
</element>
<element name="Bite" type="Companion Action" source="Monster Manual" id="ID_WOTC_MM_COMPANION_ACTION_WOLF_BITE">
	<description><p><em>Melee Weapon Attack:</em> +4 to hit, reach 5 ft., one target. <em>Hit:</em> 7 (2d4 + 2) piercing damage…</p></description>
	<sheet><description>+4 to hit, 2d4 + 2 piercing; Strength DC 11 or knocked prone.</description></sheet>
</element>
```

The validator warns when nothing offers a creature. That's expected for a
bestiary unless a class feature (Find Familiar, Beast Master) selects it by
type, size or challenge, e.g.
`<select type="Companion" name="Ranger’s Companion" supports="Beast,(Tiny||Small||Medium),(1/4||1/8||0)" />`
(`,` binds tighter than `||`, so group alternatives in parentheses).
