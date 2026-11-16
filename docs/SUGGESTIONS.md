# Suggestions: from character builder to an all-in-one table tool

Ideas for growing DaybreakBuilder into a tool for both players and GMs. Kept as a backlog: move an item into the
roadmap in the README when work on it starts, and into *Done* when it ships.

## Done

| Version | Feature | What it does |
| --- | --- | --- |
| 1.2.0 | **Play mode** | *Start Play Session* on the sheet: live HP (temporary HP, death saves), spell slots and Pact Magic, limited-use features, hit dice, conditions, Exhaustion, Heroic Inspiration, short and long rests, and attacks with the dice rolled at the table (pick a weapon, enter the d20 and the damage). Everything goes into a session log and can be undone. |
| 1.3.0 | **Character portraits and tokens** | Portraits from the built-in gallery or an image file, cropped and zoomed in an editor and saved inside the character (so exports and PDFs keep them). A round token with a ring colour per character, shown in Play mode and on the Party tab, downloadable as a 512 px PNG for virtual tabletops. |
| 1.3.0 | **Initiative tracker** | On a campaign's Party tab: turn order and rounds, initiative typed in from the table (or 10 + bonus for monsters), monsters from the loaded content with their stat blocks, several of a kind lettered *Goblin A, B, C…*, HP and temporary HP, conditions with durations, concentration save DCs, legendary actions. Player characters' HP and conditions are shared with their Play mode. |
| 1.3.0 | **Campaigns and notes** | A campaign holds the party (overview, encounter calculator, initiative tracker) plus Notes, Sessions and Quests. Notes are Markdown with live formatting; `[[links]]` go to notes, characters and compendium entries, with hover cards, autocomplete and backlinks, and are updated when a note is renamed. Note types and tags, full-text search of the notes. Sessions record dates, in-game date, who played, XP and loot; quests are open, done or failed. On desktop a campaign is a folder of Markdown files that also works as an Obsidian vault. GM-only. |
| 1.3.5 | **Navigation** | The top bar holds the sections (Characters, Campaigns, Compendium, Content) and a Settings menu (units, theme); the open character gets its own bar with its pages, Undo, Redo, History and Close. Fits down to the 900 px minimum window width. |
| next | **Notes extras and random tables** | Images in notes (paste, drop or insert; `![[map.png]]`), note templates (Obsidian's Templates folder, starter set), a graph of the links between notes, random tables written as notes (with dice and nested tables) and generators for NPCs, names, taverns, shops, encounters from the loaded monsters and coin treasure. |
| next | **Campaign export and import** | *Export…* saves a campaign as one `.zip` (notes, images, `campaign.json` and the party's characters); *Import…* makes a campaign from it or from any zipped notes folder or Obsidian vault. Works between desktop and browser. |

Also in the app before this backlog: the rules engine that computes every character's real numbers (AC, HP, saves,
passives, spell DCs, attacks, feature uses), creature stat blocks from loaded content, the party overview, the
encounter difficulty calculator, metric units and a dark theme.

## Campaigns and notes (GM)

- **Apply session XP and loot** to the characters (level-up prompt, items into inventories).
- A player-facing side (shared notes, player journals): out of scope for now, the campaign tools are GM-only.

## GM tools

- **Encounters:** pick monsters from the loaded Monster Manual in the planner (not just challenge ratings), save
  several encounters to the campaign, and start any of them in the tracker. Next up.
- **Initiative tracker extras:** lair actions on initiative 20, a player view (turn order only) for a second screen,
  monster tokens.
- **Loot and treasure:** hand out items and coins straight into characters' inventories.
- **More generators:** treasure hoards and magic items, plot hooks, dungeon rooms; a shared library of tables between
  campaigns.

## Portraits

- **Tokens for monsters** in the initiative tracker (characters already show theirs).
- **NPC and monster portraits** for notes and encounters, and a bigger built-in gallery (species, classes, monsters).

## Interface

Follow-ups from the navigation review (1.3.5):

- The Party view's Overview / Initiative switch still uses the older pill style; make it match the underlined tabs.
- A campaign shows its own *Saved* label next to the character bar's; consider one save indicator.
- Check the desktop window with a screen reader (only keyboard navigation has been checked so far).

## Sharing between GM and players

- **First step (done):** export and import a campaign as a file, since the app is local-only.
- **Later:** live sync between devices, which needs a server.

## Later

- Map and handout viewer.
- Campaign calendar (in-game dates, downtime, events).
- Rules glossary lookup (conditions, actions) from the loaded content.

## Not planned

- **Dice roller:** players roll real dice; Play mode only asks for the result.
