# Suggestions: from character builder to an all-in-one table tool

Ideas for growing DaybreakBuilder into a tool for both players and GMs. Kept as a backlog: move an item into the
roadmap in the README when work on it starts.

What the app already has and these build on: a rules engine that computes every character's real numbers (AC, HP,
saves, passives, spell DCs, attacks, feature uses), creature stat blocks from loaded content, the **Party** page
(party overview with languages, senses, spell DCs and skill coverage; encounter difficulty calculator) and **Play
mode** (live HP, spell slots, feature uses, conditions, rests and attacks with dice rolled at the table).

## Campaigns and notes (players and GM)

A **campaign** groups characters, sessions, notes and encounters, and is what the other tools hang on.

- **Linked notes:** Markdown notes with `[[links]]` to other notes and to compendium entries (`[[Fireball]]` links the
  spell and shows its description on hover).
- **Note types with tags:** Session, NPC, Location, Quest, Item, Faction.
- **Session log:** date, in-game date, recap, XP and loot awarded.
- **Quest tracker:** open, done and failed quests.
- **GM-only notes:** secret notes and reveals, kept out of anything shared with players.
- **Search** across all notes and the compendium.

Open questions: plain Markdown with `[[links]]` (portable, easy to back up) or a richer editor; whether a campaign
belongs to one device or is shared (see *Sharing*).

## GM tools

- **Encounters:** pick monsters from the loaded Monster Manual (not just challenge ratings), save encounters to the
  campaign, and start one in the initiative tracker.
- **Initiative tracker:** party and monsters in turn order; HP, conditions with durations, concentration, legendary
  and lair actions; monster stat blocks one click away; reads each character's live HP and conditions from Play mode.
- **Loot and treasure:** hand out items and coins straight into characters' inventories.
- **Random tables and generators:** names, encounters, treasure, custom tables.

## Character portraits

Today a portrait comes from the built-in gallery or an image file, and shows on the character list, the sheet and the
PDF. Next steps:

- **Show it everywhere a character appears:** Play mode header, Party page, initiative tracker.
- **Custom portrait editor:** crop, zoom and position the image instead of using it as is.
- **Tokens:** a round, bordered version for maps and the initiative tracker, with a colour per player.
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
