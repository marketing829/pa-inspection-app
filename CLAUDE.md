# PA Inspect (PA Fieldnotes): project guide for Claude Code

Read this before every change. It holds the rules and decisions that are not obvious from the code. Last updated 12 October 2026, from the round 16 build.

## What this is

An internal web app for Property Assist (WA) entry inspections (PCR only). Inspectors record a voice note per room on their phone. The audio is transcribed, sorted into the room's subareas by Claude, and archived to Dropbox. Overseas typists (Jess and the VA team) then turn it into the PA master WA PCR Word report.

Two front ends, one repo:

- **Inspector app**: `index.html` + `sw.js` (service worker). One large single-file app, installed as a Home Screen web app. Served by GitHub Pages from `marketing829/pa-inspection-app`.
- **Typist editor**: `editor.html` + `spell/`. Desktop page for typists: one room at a time, audio beside the text, word flags, Claude check, Word file export.

Back end is Val Town (account `propertyassist`). The vals are not in this repo unless someone has added them under `vals/`.

| Val | Job |
|---|---|
| `inspectionapp-assemblyai` | Default speech-to-text engine. Supports `{url}` (Dropbox link) and resume by `{id}` after a 504 |
| `inspectionapp` | Deepgram engine (`main.ts`), kept as the alternative |
| `inspectionapp-cleanup` | Claude sorts a room's transcript into its subareas and fixes mishears (`file_room` tool) |
| `inspectionapp-proofread` | Claude check for the editor; `mode: "rooms"` finds where each room starts in one long recording |
| `dropbox-archive` | Writes everything to Dropbox; also the phone problem log (`?action=log`) and editor reads |

Every val checks `PA_KEY`. A GET on a val URL shows its config, `key_required`, and `"version"`.

## Current state

- Inspector app: **round 16 live** (cache v20). Admin settings should show "app version 16".
- Round 14 vals: built, **not confirmed pasted** into Val Town. Check each URL shows `"version": 14`.
- Typist editor: **v3.4.2 is in this repo and live on GitHub Pages** (New job from audio). It needs the v3.4 proofread val pasted too; until then New job from audio may not work.
- The project "INSPECTION APP" on claude.ai holds every round doc. `claude/pa-start-here-handoff.md` is the source of truth for status and open items. If this file and that doc disagree, the doc wins; update this file.

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
9. **Claude cleanup never invents, omits or softens.** Only real subarea names come back. If it keeps under 75% of the words, the app falls back to its keyword split. (The 75% check and the subarea-name check are not in `index.html`; they must live in the `inspectionapp-cleanup` val. The app only falls back when the val fails, declines, or returns no usable sections.) Model and serial numbers are always flagged "check against the photo".
10. **No secrets in commits.** Keys live in Val Town environment variables (`PA_KEY`, `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`, Dropbox tokens, `EDITOR_KEY`). Don't paste key values into code, docs or this file. Exception, on purpose: the shared `PA_KEY` value is written into `index.html` and `editor.html` (sent as `?k=`), so anyone who can open the public site can read it. Treat it as a lock on the door, not a safe. If it leaks, change it in both files and in every val's `PA_KEY`.

## Product decisions (Marie, carry into every round)

- Entry inspections only. No inspection type picker.
- In-app wording: few words, direct, calm. Nothing that could cause panic.
- The button is "Recordings" everywhere, never "Backups".
- "Unreadable", never "Damaged" (Dropbox note: `<room> - AUDIO UNREADABLE.txt`).
- Flags are yellow in the apps; red only in the Word file.
- No live transcript while recording. Show "Transcribing", then the sorted text after Done.
- Fix a word is on the Review page only.
- Room checklist is a guide only. Ticks are never saved to the report, json or Word file.
- Mandatory items sit on the Start screen (kept in `pa_setup_mandatory` until Start), editable on Review.
- Finish returns to the Start screen and doesn't wait for Dropbox.
- The approved correction list is applied automatically. The team phrase list is suggestions only.
- Native app (Expo) decision comes after the typist editor is finished.
- Priority order: accurate audio and clean text on screen first, then categorisation in the app and Dropbox files.

## Domain notes

- Room library (`ALL_ROOMS`) matches the WA PCR master template: 24 rooms, 343 line items. Don't rename rooms or subareas without checking the template.
- Dropbox output per inspection, foldered by property address: per-room `.txt` (raw transcript with times + sorted text + flagged mishears), the audio, room `.json`, `00 - Inspection details.txt`, photos, and the Word file.
- Inventory rows (`state.invItems`) produce the same Inventory and Serial/model text as before, so txt, json and Word output stay unchanged. Photo names include the item, e.g. `Serial plate - Oven 12.jpg`.
- Known mishears: "similar" → "silver metal", "egg" → AEG, "iPhone" → Aiphone, "NBN coax" → NBN Co, "submetal" → stainless steel, "fridge race" → fridge recess, "scrutting" → skirting. Engines change their habits, so prefer fixes in the cleanup prompt over new word rules.
- Reports write counts as words ("Four"), but AssemblyAI returns digits.
- Terms: PCR, Routines (job type), subareas/subsections, RCD box, Finish & Clear, correction layer, cleanup pass.

## How to work in this repo

- **Branch per round** (`round-17`, etc.). Commit small. The commit message says what changed for the inspector in plain words.
- **Bump the service worker cache version** in `sw.js` on every app change, and the app version shown in Admin settings. Phones only pick up a new build after force-quit and reopen.
- **Test before every commit.** Headless Playwright on Chromium at 375×667 and 320×568, against real inspector transcripts where possible. Keep the existing checks passing (round 16 had 375 of 375). Add checks for every fix. Mock the vals and Dropbox in tests. Tests live in `tests/` (round 16: `tests/test-round16.js`). Run from the repo root: `python3 -m http.server 8767 --bind 127.0.0.1`, then `node tests/test-round16.js`. Needs Node and Playwright (`npm i -g playwright`, `npx playwright install chromium`). Test output (Word files) and private material go in `tests/private/`, which is not committed.
- **iPhone Safari is the real target.** Things that pass in Chromium can still fail there (IndexedDB dropped after backgrounding, no Background Sync, keyboard and swipe behaviour). List what needs a real iPhone check in the round notes.
- **Val changes**: if vals live in `vals/`, edit them there and give the paste-ready file. Each val bumps its `"version"`. No new environment variable without saying so in the round notes.
- **After each round**: an independent review pass (fresh agent) looking for audio-loss and data-loss risks, then fix what it finds.
- **Round notes**: write a short summary in plain language (what changed, what to upload or paste, what to check on a phone). Daphne copies it into the claude.ai project as `claude/pa-round-N-...md` and updates the start-here doc.

## Open items (from the start-here doc, 12 Oct)

1. Confirm the round 14 vals are pasted (`"version": 14`).
2. iPhone check of round 16: mandatory card → Review edit, inventory camera tile, Recordings day folds, Camera mid-job while a room is sending.
3. Watch dropbox-archive logs for `PHONE PROBLEM` after real jobs.
4. Chrome-on-iPhone sending test.
5. Typist editor v3.4.2 is uploaded. Paste the v3.4 proofread val and check its "not verified yet" list.
6. Decide the Dropbox name pattern for serial photos.
7. On hold: Chrome-on-iPhone warning, send errors on room cards, Add saved recording, Background Sync for Android.
