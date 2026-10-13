# PA Inspect: rounds 17 and 18 (12 Oct 2026)

## Status
- Inspector app round 18 is live (app version 18, cache v22). Round 17 went live earlier the same day.
- Vals live: cleanup 17.2, assemblyai 17, dropbox-archive 14. The round 14 vals were confirmed live.
- The assemblyai val now listens for ten more Stirling words: Foxtel, windowsill, window ledge, cutlery rack, fluorescent, frosted, shower screen, lockable handle, doorstop, Mitsubishi Electric.
- The val code now lives in the GitHub repo under `vals/`. Full round notes: `notes/round-17.md`, `notes/round-18.md`.

## What changed for the VA (Word file)
- Known mishears are always highlighted, so a garbled room never says "nothing to check".
- A note when two parts of a room describe the same rows (e.g. a second store room recorded as Balcony part 1).
- A Type column in the model/serial table. A note when a room's first rows are empty. Row times corrected.
- "Check list cut short" note when the AI stopped before listing everything to check.
- Round 18: "Said but not in the sorted text, left out or changed by the AI: "…" (time)" at the top of a room. On Stirling it caught "2 up and down secured at front door" (left out) and "once of no address burns" (reworded as "no dual flush button"), with no false alarms on complete rooms.

## Cleanup val (Claude Sonnet 5.5)
- Reasons kept short. A stuck answer, or a long room that comes back with nothing to check, is asked again once (if the first answer came within 30 s).
- Always answers within 50 s (Val Town stops every request at 60 s on the current plan).
- Model, serial and type numbers are always flagged "check against the photo".
- Answers without thinking first. Short thinking was tested side by side and twice left out a Bedroom 1 sentence.
- Live Stirling test (`?test=stirling&k=<key>`): between 11 and 19 of 19 across 9 runs. Claude is inconsistent, which is why round 18 checks its output in the app.
- Decision (Daphne): stay on Sonnet 5.5 for budget. If it still isn't good enough, look at other options, including the OpenAI API.

## Reviews and tests
- Independent reviews after both rounds: no audio or data-loss risk; all findings fixed.
- Tests: app 412 of 412, cleanup val 38 of 38.

## To do
1. On each phone: force-quit, reopen, and check Admin settings shows "app version 18".
2. Re-run the Stirling walk-through (record Kitchen part 1; add the second store room as "Store Room 2") and compare the Word file with the VA's report.
3. After the next real job: are the "Said but not in the sorted text" notes real misses or false alarms?
4. Still open from before: the iPhone check of the round 16 items, watching for PHONE PROBLEM in the dropbox-archive logs, the Chrome-on-iPhone sending test, pasting the v3.4 proofread val for the typist editor, and deciding the serial photo name pattern.
