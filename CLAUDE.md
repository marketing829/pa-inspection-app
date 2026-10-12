# PA Inspect (PA Fieldnotes): project guide for Claude Code

Read this before every change. It holds the rules and decisions that are not obvious from the code. Last updated 12 October 2026, after the round 17 build.

## Working with Daphne

- Daphne is not a coder. Explain everything in plain words, no jargon.
- Don't show code or diffs unless she asks.
- When you need a decision, give 2–3 options with your recommendation first.
- Do the git work yourself (branches, commits) and tell her when it's ready to push with GitHub Desktop.
- At the end of every round, write short round notes she can paste into the claude.ai project.

## What this is

An internal web app for Property Assist (WA) entry inspections (PCR only). Inspectors record a voice note per room on their phone. The audio is transcribed, sorted into the room's subareas by Claude, and archived to Dropbox. Overseas typists (Jess and the VA team) then turn it into the PA master WA PCR Word report.

Two front ends, one repo:

- **Inspector app**: `index.html` + `sw.js` (service worker). One large single-file app, installed as a Home Screen web app. Served by GitHub Pages from `marketing829/pa-inspection-app`.
- **Typist editor**: `editor.html` + `spell/`. Desktop page for typists: one room at a time, audio beside the text, word flags, Claude check, Word file export.

Back end is Val Town (account `propertyassist`). Paste-ready copies of the val code live in `vals/` (see below). Val Town is the live copy; `vals/` is what we edit and test.

| Val | Job | Copy in repo |
|---|---|---|
| `inspectionapp-assemblyai` | Default speech-to-text engine. Supports `{url}` (Dropbox link) and resume by `{id}` after a 504 | `vals/inspectionapp-assemblyai.ts` (round 14) |
| `inspectionapp` | Deepgram engine (`main.ts`), kept as the alternative | not yet |
| `inspectionapp-cleanup` | Claude sorts a room's transcript into its subareas, fixes mishears and lists words to check (`file_room` tool) | `vals/inspectionapp-cleanup.ts` (round 17) |
| `inspectionapp-proofread` | Claude check for the editor; `mode: "rooms"` finds where each room starts in one long recording | not yet |
| `dropbox-archive` | Writes everything to Dropbox; also the phone problem log (`?action=log`) and editor reads | `vals/dropbox-archive.ts` (round 14) |

Every val checks `PA_KEY`. A GET on a val URL shows its config, `key_required`, and its round/version.

## Current state

- Inspector app: **round 16 live** (cache v20). **Round 17 built, not uploaded** (cache v21, Admin settings shows "app version 17"). Round 17 notes: `notes/round-17.md`.
- Cleanup val: `PA_MODEL` is set to `claude-sonnet-5-5` (12 Oct). **Round 17 cleanup val built, not pasted.** After pasting, its URL shows `"round": 17`. `?test=stirling&k=<PA_KEY>` runs four Stirling Street rooms through Claude and lists 19 PASS/FAIL checks. Not yet run against the live API.
- Round 14 vals: built, **not confirmed pasted**. Check each URL shows `"version": 14`.
- Typist editor: **v3.4.2 is in this repo and live on GitHub Pages** (New job from audio). It needs the v3.4 proofread val pasted too; until then New job from audio may not work.
- The project "INSPECTION APP" on claude.ai holds every round doc and the VA comparisons. `claude/pa-start-here-handoff.md` is the source of truth for status and open items. If this file and that doc disagree, the doc wins; update this file.

## Rules that must not break

These came from real field failures. Treat them as hard requirements.

1. **Never lose audio.** Audio stays on the phone until Dropbox confirms it, then 14 days more. Nothing may mark a room archived unless its audio upload actually succeeded.
2. **Send a copy, not the stored file.** Recordings are read into memory (20 s limit) and that copy is sent. Sending the stored file directly is what left Brandon's audio stuck on his phone (Archibald St, 9 Oct).
3. **Every network call, storage step and file read has a time limit.** Nothing may hold the send queue forever. Watchdogs run per item, not per pass.
4. **Read back after every Done.** If the stored copy is short or unreadable, save it again as plain bytes in the `audiobytes` store (phone database version 3).
5. **A timed-out write is not repeated**, and recordings get their id before the first save. No double copies.
6. **Uploads carry `&size=`**, and the app refuses a Dropbox answer with a smaller size.
7. **Report problems** to `dropbox-archive?action=log` (shows as `PHONE PROBLEM` in Val Town logs), at most once per 5 min per recording.
8. **The phone app sends only while open.** iPhone has no Background Sync. Don't design anything that assumes background uploads.
9. **Claude cleanup never invents, omits or softens.** Only real subarea names come back. If it keeps under 75% of the words, the app falls back to its keyword split. (Both checks live in the `inspectionapp-cleanup` val, not `index.html`: `MIN_KEEP_RATIO = 0.75` refuses the output, and the app falls back when the val fails, declines, or returns no usable sections.) Model, serial and type numbers are always flagged "check against the photo".
10. **A wrong statement that reads normally is the worst outcome.** Since round 17 the cleanup prompt flags unusual condition words, self-contradictions and garbled phrases with no per-room cap, and the app always highlights `SUSPECT_PHRASES` in the Word file. Never reintroduce a cap on flags. Never let a garbled room show "nothing to check".
11. **No secrets in commits.** Keys live in Val Town environment variables (`PA_KEY`, `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`, Dropbox tokens, `EDITOR_KEY`). Don't paste key values into code, docs or this file. Exception, on purpose: the shared `PA_KEY` value is written into `index.html` and `editor.html` (sent as `?k=`), so anyone who can open the public site can read it. Treat it as a lock on the door, not a safe. If it leaks, change it in both files and in every val's `PA_KEY`.

## Product decisions (Marie, carry into every round)

- Entry inspections only. No inspection type picker.
- In-app wording: few words, direct, calm. Nothing that could cause panic.
- The button is "Recordings" everywhere, never "Backups".
- "Unreadable", never "Damaged" (Dropbox note: `<room> - AUDIO UNREADABLE.txt`).
- Flags are yellow in the apps; red only in the Word file.
- No live transcript while recording. Show "Transcribing", then the sorted text after Done.
- Fix a word is on the Review page only. Inspectors don't have to check words; the VA does.
- Room checklist is a guide only. Ticks are never saved to the report, json or Word file.
- Mandatory items sit on the Start screen (kept in `pa_setup_mandatory` until Start), editable on Review.
- Finish returns to the Start screen and doesn't wait for Dropbox.
- The approved correction list is applied automatically. The team phrase list is suggestions only.
- Native app (Expo) decision comes after the typist editor is finished.
- Priority order: accurate audio and clean text on screen first, then categorisation in the app and Dropbox files.

## Domain notes

- Room library (`ALL_ROOMS`) matches the WA PCR master template: 24 rooms, 343 line items. Don't rename rooms or subareas without checking the template.
- A second room of the same kind (e.g. a second store room) is added on the phone with Add room ("Store Room 2"). Custom names take the template rows of the preset they match.
- Dropbox output per inspection, foldered by date and address: one Word file for the VA (`<address> - Inspection.docx`), `Audio/`, `App data/` (.txt and .json per room), `Photos/`.
- Word file per room: template rows in order, "Not mentioned" rows, row start time, highlighted words, grey italic AI-added phrases, a model/serial(/type) table, and notes at the top of the room (no transcript, two parts describing the same rows, empty first rows).
- Inventory rows (`state.invItems`) produce the same Inventory and Serial/model text as before. Photo names include the item, e.g. `Serial plate - Oven 12.jpg`.
- Mishears: the cleanup prompt holds the list (round 17 added downlights, secured, Foxtel, fluorescent, frosted, globes, cutlery rack, dual flush …). Engines change their habits, so prefer fixes in the cleanup prompt over new word rules. `SUSPECT_PHRASES` in `index.html` is the safety net for mishears already seen.
- Reports write counts as words ("Four"), but AssemblyAI returns digits.
- Terms: PCR, Routines (job type), subareas/subsections, RCD box, Finish & Clear, correction layer, cleanup pass.

## How to work in this repo

- **Daphne is not a coder.** Explain what changed for the inspector or the VA in plain words, not code. Ask before anything that deletes files, rewrites history or pushes to `main`.
- **Branch per round** (`round-18`, etc.). Commit small. The commit message says what changed for the inspector in plain words. Merge to `main` (which publishes on GitHub Pages) only when Daphne says so.
- **Bump the service worker cache version** in `sw.js` on every app change, and `APP_ROUND` plus the "app version N" text in Admin settings. Phones only pick up a new build after force-quit and reopen.
- **Test before every commit.**
  - App: `tests/test-round17.js` (397 checks, headless Playwright, 375×667). Serve the repo root with `python3 -m http.server 8767 --bind 127.0.0.1`, then `node tests/test-round17.js` (it reads `index.html` and `sw.js` from the folder it's run against; adjust `__dirname` paths if you move it). Copy it to `test-round18.js` for the next round, update version checks, add checks for every fix.
  - Cleanup val: `node tests/test-val-round17.mjs` (15 mocked checks; needs `esbuild` installed globally).
  - Mock the vals and Dropbox in tests. Never call live services from tests.
- **iPhone Safari is the real target.** Things that pass in Chromium can still fail there (IndexedDB dropped after backgrounding, no Background Sync, keyboard and swipe behaviour). List what needs a real iPhone check in the round notes.
- **Val changes**: edit the file in `vals/`, bump its round/version, and tell Daphne to paste the whole file into Val Town. No new environment variable without saying so in the round notes.
- **After each round**: an independent review pass (fresh agent) looking for audio-loss and data-loss risks and false highlights, then fix what it finds.
- **Round notes**: write `notes/round-N.md` in plain language (what changed, what to upload or paste, what to test on a phone). Daphne copies it into the claude.ai project as `claude/pa-round-N-...md` and updates the start-here doc.

## How to judge a round

Compare the app's Word file for a real job against the VA's final report, room by room (see `claude/pa-stirling-va-comparison.md` in the project for the format). Pass bar, two properties in a row:
- no lost rooms;
- no lost damage notes;
- no meaning change that isn't highlighted.

## Open items (from the start-here doc, 12 Oct)

1. Paste the round 17 cleanup val; open `?test=stirling&k=<PA_KEY>`; fix anything that fails.
2. Upload round 17 `index.html` + `sw.js`; phones show "app version 17".
3. Re-run the Stirling walk-through (Kitchen part 1 included, second store room as "Store Room 2") and score it against the VA.
4. Confirm the round 14 vals are pasted (`"version": 14`).
5. iPhone check of round 16: mandatory card → Review edit, inventory camera tile, Recordings day folds, Camera mid-job while a room is sending.
6. Watch dropbox-archive logs for `PHONE PROBLEM` after real jobs.
7. Chrome-on-iPhone sending test.
8. Typist editor v3.4.2 is uploaded. Paste the v3.4 proofread val and check its "not verified yet" list.
9. Decide the Dropbox name pattern for serial photos.
10. On hold: Chrome-on-iPhone warning, send errors on room cards, Add saved recording, Background Sync for Android, a second transcription engine to cross-check words.
