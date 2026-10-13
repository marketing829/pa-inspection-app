# PA Inspect (PA Fieldnotes): project guide for Claude Code

Read this before every change. It holds the rules and decisions that are not obvious from the code. Last updated 13 October 2026, after the round 22 build.

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
| `inspectionapp-assemblyai` | Default speech-to-text engine. Supports `{url}` (Dropbox link) and resume by `{id}` after a 504 | `vals/inspectionapp-assemblyai.ts` (version 17: Stirling words added) |
| `inspectionapp` | Deepgram engine (`main.ts`), kept as the alternative | not yet |
| `inspectionapp-cleanup` | Claude sorts a room's transcript into its subareas, fixes mishears and lists words to check (`file_room` tool) | `vals/inspectionapp-cleanup.ts` (round 22, version 22: "simple" → "single" before switches) |
| `inspectionapp-proofread` | Claude check for the editor; `mode: "rooms"` finds where each room starts in one long recording | not yet |
| `dropbox-archive` | Writes everything to Dropbox; also the phone problem log (`?action=log`) and editor reads | `vals/dropbox-archive.ts` (round 19: audio never overwritten) |

Every val checks `PA_KEY`. A GET on a val URL shows its config, `key_required`, and its round/version (12 Oct: cleanup `"version": "17.2"`, assemblyai `17`, dropbox-archive `14`).

## Current state

- Inspector app: **round 18 live 12 Oct** (cache v22, "app version 18"). **Round 19 is merged** (cache v23, "app version 19"): review fixes for damage notes, added phrases, Word file notes and audio safety. Cleanup val 19 and dropbox-archive val 19 are in `vals/`, to paste. **Round 20 is merged to `main`** (cache v24, "app version 20"): rooms follow the PCR palm cards, Gas Meter replaces Smoke Alarms, a required photo per mandatory item. No val changes. **Round 21 is merged and live 13 Oct** (cache v25, "app version 21"): Stirling replay vs the VA (more always-highlighted mishears, a "same words repeat, listen here" note), Discard inspection, checklist rows wrap, the send-all-audio button removed, Android playback length, lone bathroom named "Bathroom". **Cleanup val 21 is live** (GET shows `"version": "21"`, 13 Oct). **Round 22 is merged and live 13 Oct** (cache v26, "app version 22"): a failed AI sort is tried again by itself (`cleanupRetryPass`, 24 h, 9 tries), the Word file says why a room wasn't sorted (e.g. "Claude credits used up"). **Cleanup val 22 is live** (GET shows `"version": "22"`). Notes: `notes/round-17.md` … `notes/round-22.md`.
- Cleanup val: `PA_MODEL` is set to `claude-sonnet-5-5` (12 Oct). **Cleanup val 17.2 is live** (`"version": "17.2"`; also asks again when a long room comes back with nothing to check). It answers without thinking first (short thinking was tested and left out a sentence), asks again when an answer gets stuck, and always answers within 50 s (Val Town stops requests at 60 s). See `notes/round-17.md`. `?test=stirling&k=<PA_KEY>` runs four Stirling Street rooms through Claude and lists 19 PASS/FAIL checks.
- Round 14 vals: **confirmed live** 12 Oct (`"version": 14`). The assemblyai val has a version 17 in `vals/` (ten more expected words).
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
9. **Claude cleanup never invents, omits or softens.** A failed AI sort (no connection, credits used up) is retried by the phone for 24 h; never let a room stay keyword-split silently. Only real subarea names come back. If it keeps under 75% of the words, the app falls back to its keyword split. (Both checks live in the `inspectionapp-cleanup` val, not `index.html`: `MIN_KEEP_RATIO = 0.75` refuses the output, and the app falls back when the val fails, declines, or returns no usable sections.) Model, serial and type numbers are always flagged "check against the photo".
10. **A wrong statement that reads normally is the worst outcome.** Since round 18 the app also lists, at the top of each room in the Word file, what was said but isn't in the AI's sorted text (`missingPhrases`); don't remove it, and keep it quiet on fixed mishears and walk-through phrases. Since round 17 the cleanup prompt flags unusual condition words, self-contradictions and garbled phrases with no per-room cap, and the app always highlights `SUSPECT_PHRASES` in the Word file. Never reintroduce a cap on flags. Never let a garbled room show "nothing to check".
11. **No secrets in commits.** Keys live in Val Town environment variables (`PA_KEY`, `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`, Dropbox tokens, `EDITOR_KEY`). Don't paste key values into code, docs or this file. Exception, on purpose: the shared `PA_KEY` value is written into `index.html` and `editor.html` (sent as `?k=`), so anyone who can open the public site can read it. Treat it as a lock on the door, not a safe. If it leaks, change it in both files and in every val's `PA_KEY`.

## Product decisions (Marie, carry into every round)

- Entry inspections only. No inspection type picker.
- In-app wording: few words, direct, calm. Nothing that could cause panic.
- The button is "Recordings" everywhere, never "Backups".
- "Unreadable", never "Damaged" (Dropbox note: `<room> - AUDIO UNREADABLE.txt`).
- Flags are yellow in the apps; red only in the Word file.
- No live transcript while recording. Show "Transcribing", then the sorted text after Done.
- Fix a word is on the Review page only. Inspectors don't have to check words; the VA does.
- Sorting and polishing (Daphne, 13 Oct): keep the inspector's words and their order; only punctuation, capitals, clear mishears and Australian spelling change ("wood"/"timber" as said); never drop a mark, count, "no" or side; flag an unclear area, don't guess; one entry per subarea even when the inspector comes back to it. The Word file keeps template row order (spoken order shows in row times and the room index); walk-through phrases and cancelled words are left out; counts are written as words. No damage or dirt said: "in clean condition" (surfaces) / "in good condition"; working fixtures: "secured and functional" only.
- Hosting and native app (Daphne, 13 Oct): stay on Val Town for now. If big rooms on weak signal get stuck (60 s per request), send big audio to Dropbox in parts rather than move hosts.
- Room checklist is a guide only. Ticks are never saved to the report, json or Word file.
- Mandatory items sit on the Start screen (kept in `pa_setup_mandatory` until Start), editable on Review. Since round 20: Water Meter Reading and Location, RCD Box, Gas Meter Reading (replaced Smoke Alarms), NBN Box, and a required photo of the water meter, RCD box, gas meter and NBN box (camera or photo library). Missing ones are named on Review and in the Finish question, but don't block Finish (Daphne, 13 Oct: keep it as a reminder; some properties have no gas meter). Dropbox: `Photos/00 Mandatory - <item> <n> - <hhmm> - <photo id>.jpg`. Start-screen photos (`pa_setup_mand_photos`) only send once they belong to a job; Resume, or photos over 12 h old, ask first. Ones still unstamped at Finish are kept in `pa_mand_photos_left` with their job's details.
- Finish returns to the Start screen and doesn't wait for Dropbox.
- Discard inspection (Daphne, 13 Oct, round 21): a link under Finish on Review. Nothing is deleted: recordings stay under Recordings and still go to Dropbox, marked discarded; the details file is `00 - Inspection details - DISCARDED <hhmm>.txt`; a restarted job at the same address and day gets a Word file of its own rooms only (chosen by `jobId`).
- The approved correction list is applied automatically. The team phrase list is suggestions only.
- Native app (Expo) decision comes after the typist editor is finished.
- Cleanup model stays Claude Sonnet 5.5 for budget (Daphne, 12 Oct). If it still isn't good enough after round 18, look at other options, including the OpenAI API.
- Priority order: accurate audio and clean text on screen first, then categorisation in the app and Dropbox files.

## Domain notes

- Room library (`ALL_ROOMS`): 26 rooms, 393 line items. Built from the WA PCR master template, then (round 20, Daphne) aligned to the PCR palm cards: Aircon Motor, Garbage Bins, bedroom Screen Door, Drains, Kickboards, and new Pool/Spa and Bathroom/Laundry rooms. Multi-line palm card cupboards, pantry, verandah and pergola stay one row each (tidy). The typist editor's `T_ROWS` must match (a test checks it). Don't rename rooms or subareas without checking the palm cards and template.
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
  - App: `tests/test-round22.js` (539 checks, headless Playwright, 375×667). Serve the repo root with `python3 -m http.server 8767 --bind 127.0.0.1`, then `node tests/test-round22.js` from the repo root. Copy it to `test-round23.js` for the next round, update version checks, add checks for every fix. Node lives in `~/.local/node/bin` (add it to PATH). The tests use the computer's clock; a heavily loaded machine can make sending checks fail, so rerun before chasing a failure.
  - Cleanup val: `node tests/test-val-round22.mjs` (60 mocked checks; needs `esbuild` installed globally).
  - A real-data copy of the app test lives in `tests/private/` (not committed). Make every app-test change in both copies.
  - Mock the vals and Dropbox in tests. Never call live services from tests.
- **iPhone Safari is the real target.** Things that pass in Chromium can still fail there (IndexedDB dropped after backgrounding, no Background Sync, keyboard and swipe behaviour). No regex lookbehind (`(?<=`, `(?<!`) in `index.html`: iOS before 16.4 can't parse it and the whole app stops loading (a test checks this). List what needs a real iPhone check in the round notes.
- **Val changes**: edit the file in `vals/`, bump its round/version, and tell Daphne to paste the whole file into Val Town. No new environment variable without saying so in the round notes.
- **After each round**: an independent review pass (fresh agent) looking for audio-loss and data-loss risks and false highlights, then fix what it finds.
- **Round notes**: write `notes/round-N.md` in plain language (what changed, what to upload or paste, what to test on a phone). Daphne copies it into the claude.ai project as `claude/pa-round-N-...md` and updates the start-here doc.

## How to judge a round

Compare the app's Word file for a real job against the VA's final report, room by room (see `claude/pa-stirling-va-comparison.md` in the project for the format). Pass bar, two properties in a row:
- no lost rooms;
- no lost damage notes;
- no meaning change that isn't highlighted.

## Open items (from the start-here doc, 12 Oct)

1. Round 20: merged to `main` 13 Oct. iPhone checks in `notes/round-20.md` (photo tile offers camera and library, Start-screen photo survives leaving the app, Dropbox names).
1. Round 19: merged (pull request #4). Still to do: paste cleanup val 19 and dropbox-archive val 19 (both GETs should show `"version": "19"`). Check each phone shows "app version 19" after force-quit and reopen. iPhone checks are listed in `notes/round-19.md`.
2. After the next real job, check whether the "Said but not in the sorted text" notes are real misses or false alarms.
3. Re-run the Stirling walk-through (Kitchen part 1 included, second store room as "Store Room 2") and score it against the VA.
4. iPhone check of round 16: mandatory card → Review edit, inventory camera tile, Recordings day folds, Camera mid-job while a room is sending.
5. Watch dropbox-archive logs for `PHONE PROBLEM` after real jobs.
6. Chrome-on-iPhone sending test.
7. Typist editor v3.4.2 is uploaded. Paste the v3.4 proofread val and check its "not verified yet" list.
8. Decide the Dropbox name pattern for serial photos.
9. On hold: Chrome-on-iPhone warning, send errors on room cards, Add saved recording, Background Sync for Android, a second transcription engine to cross-check words.
