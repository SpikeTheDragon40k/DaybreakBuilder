---
name: convert-pdf
description: Convert pages of a D&D 5e rulebook PDF (spells, feats, backgrounds, races, classes, subclasses, items, magic items, creatures) into DaybreakBuilder / Aurora-format XML content, then validate it with the engine. Use when the user asks to convert, import or transcribe a book, PDF or pages into content for the builder.
---

# Convert a rulebook PDF into DaybreakBuilder content

You turn pages of a PDF the user owns into Aurora-format `<elements>` XML that
DaybreakBuilder loads, and you keep fixing it until the validator passes. The
output is for the user's personal use.

## Ground rules

- **Never write converted content inside `content/`** (that is the bundled CC-BY
  SRD pack) and never commit or push it. Write it to the output folder only.
- Don't paste long passages of book text into the chat; put them in the files.
- Encode mechanics as rules wherever the engine can apply them; keep the full
  rules text in `<description>`. Never invent mechanics that aren't on the page.
- When something can't be expressed as rules (e.g. "once per turn, when you hit…"),
  leave it as text: in `<description>` and a short `<sheet>` summary.

## 1. Settle the job

Find out, from the request or by asking only for what's missing:

1. **PDF path** and **page ranges** (book pages differ from PDF pages; check one
   page first and work out the offset).
2. **What to convert**: spells, feats, backgrounds, races, classes, subclasses,
   items, magic items, creatures…
3. **Book name** for `source="…"` (e.g. `Player’s Handbook`) and its
   **abbreviation** for ids (e.g. `PHB`, `XGTE`, `TCE`).
4. **Output folder.** Default: the app's custom content folder, which the app
   loads on start (or Content page → Custom folder → Rescan):
   - Linux/macOS: `~/Documents/DaybreakBuilder/custom/<book-slug>/`
   - Windows: `%USERPROFILE%\Documents\DaybreakBuilder\custom\<book-slug>\`
   - If the user wants it inside the repo, use `converted/<book-slug>/` (git-ignored).

For more than a chapter, keep a progress file `<output>/CONVERSION.md`: pages
done, files written, open questions, validator status. Read it first when
resuming; update it after every chunk. Long books take several sessions.

## 2. Learn the format before writing

Read these first (once per session):

- `.claude/skills/convert-pdf/reference.md`: templates for every kind of
  element, id conventions, and the rule patterns classes and races need.
- `docs/aurora-format.md`: how grants, selects, stats and expressions behave.
- The matching SRD file as a worked example: `content/srd/spells.xml`,
  `feats.xml`, `backgrounds.xml`, `races.xml`, `equipment.xml`,
  `classes/class-<name>.xml`.

## 3. Read the PDF in chunks

- Use the Read tool with `pages` (at most 20 pages per call; 5–10 is better for
  dense pages). Read tables carefully: class tables, spell slot tables and
  weapon/armor tables carry most of the numbers.
- If pages come back as images with unreadable text, or the PDF is scanned, try
  `pdftotext -layout -f <first> -l <last> book.pdf -` if it's installed.
- Convert a chunk, write it to disk, then move on. Don't hold a whole book in
  context.

## 4. Write the XML

- One file per kind, or per class/race: `spells.xml`, `feats.xml`,
  `backgrounds.xml`, `races/<race>.xml`, `classes/<class>.xml`,
  `archetypes/<class>-<subclass>.xml`, `items.xml`, `magic-items.xml`,
  `creatures.xml`. Large lists can be split (`spells-0-3.xml`, …).
- Every file starts with `<?xml version="1.0" encoding="utf-8"?>` and an
  `<info>` block naming the book (see reference.md).
- **Ids:** reuse an existing id whenever the same thing already exists, so your
  full version replaces the SRD one and Aurora character files keep working:
  1. `grep -rn 'name="<Name>"' content/` for SRD/core elements;
  2. if `fixtures/external/aurora-legacy/` exists, grep it too (ids only; don't
     copy its text).
  Otherwise follow the conventions in reference.md.
- **Vocabulary ids** (skills, saving throws, armor/weapon/tool proficiencies,
  languages, sizes, vision, damage resistances, conditions) already exist in
  `content/core/` and `content/srd/basics.xml`. Grep for them; never invent new
  ones for standard things.
- Escape `&` as `&amp;` and `<` as `&lt;` in text. Descriptions are HTML: `<p>`,
  `<em>`, `<strong>`, `<ul><li>`, `<table>`.

## 5. Validate and fix (repeat until clean)

```bash
npm run validate-content -- <output folder>
# content that builds on other converted books:
npm run validate-content -- <output folder> --base <other converted folder>
```

The validator loads core + SRD first, then your files, and reports per file and
line:

- **errors**: broken XML, grants/selects pointing at nothing, unparsable
  expressions, bad spell levels or hit dice, ids defined twice, test characters
  that crash. Fix every one.
- **warnings**: missing setters, elements nothing grants or offers, choices a
  test character couldn't fill, unresolved `{{placeholders}}`, ids referenced in
  requirements that aren't loaded. Fix them, or explain why one is expected (for
  example, a reference to a book that isn't converted yet).
- **notes**: e.g. how many SRD elements your files replace. That's expected
  when converting a book the SRD overlaps.

Classes, subclasses, races, subraces and backgrounds are put on test characters
(classes to level 20) with every choice made, so a clean run means they're
playable, not just well-formed.

## 6. Check against the page

The validator can't know the book. Before calling a chunk done, re-read the
source pages and compare:

- class table vs the class's `level="…"` grants and stat rules: features at the
  right level, spell slots, cantrips/spells known, class-specific columns (rage
  count, sneak attack dice, ki points…);
- spell level, school, casting time, range, components, duration, concentration,
  ritual, and class lists;
- ability score increases, speed, size, darkvision, languages, proficiencies;
- weapon damage and properties, armor AC, item cost and weight, magic item
  rarity and attunement.

## 7. Report back

Tell the user what was converted (counts per kind, files), the validator result,
anything left as text only, and anything you were unsure about (with page
numbers). Remind them to press Rescan on the Content page (custom folder) or
restart the app.
