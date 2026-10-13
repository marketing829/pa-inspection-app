PA INSPECTION APP: ROUND 22, 13 Oct 2026
========================================

Why: the third Stirling replay (app version 21, Android) had two parts "Not
sorted by the AI": the second half of the Kitchen and the whole Lounge. Their
files said "Failed to fetch". Daphne's Claude API credits had run out. The
app only ever tried the AI sort once, so those rooms stayed split by keyword
for good (the oven, pantry, dishwasher and fridge all landed under "Door").
Nothing was lost, but the typist would have had to re-sort them by hand.
The replay also showed four more wrong words that read normally:
  - wash basin "in poor condition with scratching" (VA: drain and plug
    combination with scratching)
  - store room "one silver metal light switch, one power point" (VA: one
    single light switch, one double power point)
  - second store room "one triple light switch" (VA: one single)
  - bathroom "one small lockable handle", "one small doorstop" (VA: silver
    metal)
Round 21 worked: Discard (the discarded run's files have their own
"DISCARDED 1611" name and its rooms stayed out of the new Word file), the new
highlights, "Bathroom", no false entry/kitchen warning.

Branch: round-22. App version 22, phone cache v26. Cleanup val version 22.


WHAT CHANGED
  1. The AI sort is tried again by itself. When it fails (no connection,
     Claude credits used up, the AI busy or too slow), the phone tries again
     1, 2, 5, 10, 20, 30, 60 and 60 minutes later (about three hours), while
     the app is open with signal. Only rooms from the last 24 hours that
     failed after this update, and not discarded ones. A refusal that won't
     change (the AI kept too few of the words) stops after two tries. When it
     works:
       - the room's .txt and .json in Dropbox are replaced with the sorted
         text, and the Word file is rebuilt;
       - the audio is never sent again;
       - on the phone, the room shows the sorted text instead of the keyword
         split (unless the inspector has typed into it).
  2. If the app opened with no signal, it didn't know the AI sort was there,
     and every room recorded until the next app switch was split by keyword
     with no note. Those rooms are now marked and sorted later too.
  3. The Word file says why a room wasn't sorted, in plain words: "Not
     sorted by the AI (Claude credits used up)", "(no connection to the AI)",
     "(the AI took too long)" or "(the AI service was busy)". While the phone
     is still trying it adds "The phone is trying again and this file updates
     by itself when it works." The room's .txt says the same.
  4. The first failure of a room, and the moment the phone gives up on it,
     go to the Val Town problem log as PHONE PROBLEM, stage "cleanup", with
     the reason (at most 10 a session, so audio problems always have room in
     the log). Credits running out shows up there before the typist notices.
  5. Always highlighted now: "in poor condition" right after a plug, drain or
     basin, "silver metal light switch / power point", "small" before a
     handle, doorstop,
     drain or mixer, "one simple", "American handles" (was "no handles"),
     "glows" (globes), "colli rack" (cutlery rack). Correct wording ("single
     light switch", "small chip", "globes", "no handles") is not highlighted.

CLEANUP VAL (version 22, to paste)
  - "simple" before a light switch, power point, data point or Foxtel point
    becomes "single", never "silver metal".
  - "American handles are present" → "no handles are present" (fixed and
    flagged); "glows" → globes; "colli rack" → cutlery rack.
  - Always flagged: "in poor condition" right after a basin, plug or drain,
    and "small" before a handle, doorstop, drain or mixer.


WHAT TO UPLOAD / PASTE
  - Push the round-22 branch with GitHub Desktop; once you say so it's merged
    to main.
  - Paste vals/inspectionapp-cleanup.ts (the whole file) into the Val Town
    val inspectionapp-cleanup. Its address should show "version": "22".
  - In the Anthropic Console (Billing), turn on auto-reload or a low-balance
    email, so credits can't run out mid-job.
  - No new environment variables.


WHAT TO TEST ON A PHONE
  1. Force-quit and reopen: Admin settings shows "app version 22".
  2. Retry test: turn on aeroplane mode, record a short room, turn aeroplane
     mode off. Transcription runs; if the AI sort fails, the Word file says
     "Not sorted by the AI (…). The phone is trying again…". Keep the app
     open: within a few minutes the room shows the sorted text and the Word
     file in Dropbox is replaced.
  3. Replay Stirling again: the wash basin's "in poor condition", the store
     room's light switch and the "small" handle are highlighted.
  4. Second store room: tap Add room → "Store Room 2" before recording it.


INDEPENDENT REVIEW (fresh reviewer, after the build)
  No audio risk found: a late sort never sends the audio again. Fixed what it
  found:
  1. After the update, every unsorted room still on a phone (up to 14 days
     old) would have been sorted again, rewriting Word files the VA may
     already have finished. Now only rooms from the last 24 hours that failed
     after this update, not discarded ones.
  2. With credits used up, the AI-sort reports could fill the problem log
     (60 a session) and push out audio warnings. Now first and last only, at
     most 10.
  3. The retry pass could run twice at once and pay for the same room twice.
     Now one room per pass.
  4. An older copy written back when the app reopens could wipe a late sort;
     the same late sort could double a room's text on Review. Both fixed.
  5. A late sort didn't always rebuild the Word file (audio too large, or an
     unreadable recording). It does now.
  6. Refusals that won't change were tried nine times. Now two.
  7. "triple light switch" and "in poor condition" on their own caught
     correct wording; "triple" is dropped and "poor condition" only counts
     next to a plug, drain or basin.
  Left as is (small, Review page only): a room in two parts whose first part
  is sorted late may show the keyword split on the phone's Review page. The
  Word file is right.


TESTS
  tests/test-round22.js: 539 checks, all pass (18 new for round 22). The
  private real-data copy passes too. tests/test-val-round22.mjs: 60 mocked
  checks for the cleanup val, all pass (2 new).
