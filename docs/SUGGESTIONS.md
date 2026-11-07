# Suggestions: from character builder to an all-in-one table tool

Ideas for growing DaybreakBuilder into a tool for both players and GMs. Kept as a backlog: move an item into the
roadmap in the README when work on it starts.

What the app already has and these build on: a rules engine that computes every character's real numbers (AC, HP,
saves, passives, spell DCs, attacks, feature uses), creature stat blocks from loaded content, **campaigns** (linked
Markdown notes, session log, quests, and the party overview, encounter calculator and initiative tracker) and **Play
mode** (live HP, spell slots, feature uses, conditions, rests and attacks with dice rolled at the table).

## Campaigns and notes (GM)

Done: campaigns as folders of Markdown files (Obsidian-compatible), holding the party; notes with live formatting,
`[[links]]` to notes, characters and compendium entries (hover cards, backlinks, links updated on rename), types and
tags; a session log (dates, who played, XP, loot); quests (open, done, failed); full-text search of the notes.

- **Export and import** a campaign as one file (zip), for backups and for the browser version.
- **Apply session XP and loot** to the characters (level-up prompt, items into inventories).
- Images in notes (`![[map.png]]`), note templates, a graph of the links.
- A player-facing side (shared notes, player journals): out of scope for now, the campaign tools are GM-only.

## GM tools

Done: the **initiative tracker** on a campaign's Party tab (turn order, rounds, HP shared with Play mode, conditions with
durations, concentration save DCs, legendary actions, stat blocks, monsters lettered A, B, C…).

- **Encounters:** pick monsters from the loaded Monster Manual in the planner (not just challenge ratings), save
  several encounters to the campaign, and start any of them in the tracker (next after export and import).
- **Initiative tracker extras:** lair actions on initiative 20, a player view (turn order only) for a second screen,
  monster tokens.
- **Loot and treasure:** hand out items and coins straight into characters' inventories.
- **Random tables and generators:** names, encounters, treasure, custom tables.

## Character portraits

Done: portraits from the built-in gallery or an image file, cropped and zoomed in an editor; a round token with a
ring colour per character, shown in Play mode and on the Party tab and downloadable as a PNG for virtual tabletops.
Next steps:

- **Tokens for monsters** in the initiative tracker (characters already show theirs).
- **NPC and monster portraits** for notes and encounters, and a bigger built-in gallery (species, classes, monsters).

## Sharing between GM and players

- **First step:** export and import a campaign (or parts of it) as a file, since the app is local-only.
- **Later:** live sync between devices, which needs a server.

## Later

- Map and handout viewer.
- Campaign calendar (in-game dates, downtime, events).
- Rules glossary lookup (conditions, actions) from the loaded content.

## Not planned

- **Dice roller:** players roll real dice; Play mode only asks for the result.
