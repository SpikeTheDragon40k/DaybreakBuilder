# Contributing to DaybreakBuilder

Thanks for helping! Bug reports, rules fixes, content-format fixes and features are all welcome.

## Reporting a bug

Open an [issue](https://github.com/SpikeTheDragon40k/DaybreakBuilder/issues/new/choose) with the version (bottom of
*Settings*, or the release you downloaded), your system, and steps to reproduce. For a wrong number on the sheet, say
which content you have loaded (the 2024 index, Aurora Legacy, your own files) and attach the character
(*Characters* → *Export*) if you can.

Please don't attach copyrighted book content. Element ids and the source name are enough.

## Working on the code

Requirements and commands are in the [README](README.md#getting-started). In short:

```sh
npm install
npm run typecheck && npm test   # what CI runs
npm run dev                     # UI in the browser at http://localhost:1420
npm run tauri dev               # desktop app
```

* `packages/engine` holds the rules and has no UI. Read [docs/aurora-format.md](docs/aurora-format.md) before changing
  how content is interpreted, and add a test in `packages/engine/test` for any rules behaviour you change.
* `apps/desktop` holds the React UI and the Tauri shell. Tests for UI state live in `apps/desktop/test`.
* Keep pull requests focused, one feature or fix each, and describe what changed and how you checked it.
* The planned work is in [docs/SUGGESTIONS.md](docs/SUGGESTIONS.md). Open an issue first for anything large.

## Content

The repository only ships the SRD 5.1 (CC-BY-4.0) and the rules plumbing. Don't add other copyrighted game content.
Load it in the app from your own files or an index URL instead.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
