PA INSPECTION APP: ROUND 17, 12 Oct 2026
========================================

Fixes from the Stirling Street test (round 16 Word file compared with
the VA's report). Recording, saving and sending are the same as round 16.

WHAT TO UPLOAD AND PASTE
  1. Val Town: open the inspectionapp-cleanup val and replace all of its code
     with "inspectionapp-cleanup (round 17, paste into Val Town).txt". Save.
     Keep the Env vars as they are (ANTHROPIC_API_KEY, PA_KEY, PA_MODEL).
  2. GitHub: upload index.html and sw.js (cache v21). Nothing else changes.

WHAT CHANGED IN THE CLEANUP VAL (the Claude step)
  1. Flagging no longer stops at about 5 per room. These are always flagged:
     - unusual condition words ("spiderwebs present", "bug screen to the
       cover", "calcium etched");
     - sentences that contradict themselves ("no detachable showerhead, in
       good condition");
     - garbled phrases, and statements where a lost "no" flips the meaning
       ("two set of wooden seat and wind ledge").
  2. More mishears fixed from context: downlights ("up and down"), secured
     ("skirting both sides"), Foxtel, fluorescent, frosted, globes, cutlery
     rack, dual flush button and others. The less certain ones ("single" for
     silver metal, "twin handle") are fixed and flagged.
  3. A type number is written "Type: 71ADC01AD", never as the model number.
  4. Self-corrections keep only the corrected words ("sand— sorry, dust" →
     "dust"). "Coming into the bedroom" type phrases are dropped.
  5. Downlights and other lights go under Light Fittings.
  6. New browser check (see TESTING, step 2).

WHAT CHANGED IN THE APP (the Word file and Review)
  1. Known mishears are always highlighted in the Word file, whatever the AI
     flagged. On the Stirling output this adds 7 highlights in Bedroom 1
     (was "nothing to check"), 9 in the Lounge and 10 in Bathroom 1.
  2. When two recordings of one room describe the same 3 or more rows, the
     Word file adds a note ("Parts 1 and 2 both describe Ceiling, …. One part
     may be a different room, for example a second store room.") and marks
     each row "pt 1 + pt 2", highlighted and counted to check.
  3. Model and serial table gets a Type column when there is a type number.
  4. When a room's first 4+ rows are empty and 4+ later rows are filled:
     - Word file: "Nothing for the first 6 rows (Door … to Blinds …). The
       start of this room may not have been recorded. Check the photos."
     - Review, Before you finish: "Kitchen: nothing for Door … to Blinds ….
       Record it if you missed it." Only once every recording of the room is
       in and sorted.
  5. Row times: a row's time is where its first sentence was said (Stirling
     kitchen underbench showed 0:38, should be 1:07).

TESTS
  test-round17.js: 397 of 397 headless checks pass (all 375 round 6–16
  checks, 5 of them updated for the new version numbers, plus 22 new).
  test-val-round17.mjs: 15 of 15 mocked checks on the cleanup val.
  An independent review raised 4 findings (false highlights on ordinary
  wording, a Review note while a part had failed, a slow plate reader on long
  spaces, "type:" alone making a plate row). All fixed and tested.
  The new prompt has NOT been run against the live Claude API from here.
  Step 2 of TESTING does that.

TESTING
  1. Open the cleanup val's address in a browser. It should show
     "round": 17 and "model": "claude-sonnet-5-5".
  2. Open the same address with ?test=stirling&k=<PA_KEY> on the end.
     It runs four Stirling rooms (Bedroom 1, Lounge, Bathroom 1, part of the
     Kitchen) through Claude and lists 19 checks as PASS or FAIL. Takes up to
     a minute. Send the result to Claude if anything says FAIL.
  3. After the GitHub upload: on each phone, force-quit and reopen the app.
     Settings (gear) > Admin settings should show "app version 17".
  4. Re-run the Stirling test walk-through with the same script, this time:
     - record Kitchen part 1 (door, ceiling, lights, walls, windows);
     - record the second store room (the VA's "Balcony (1)") as its own room:
       Add room > "Store Room 2";
     - leave everything else as before.
  5. Compare the new Word file with the VA's report, room by room, using the
     same table as claude/pa-stirling-va-comparison.md. Pass bar:
     - no lost rooms;
     - no lost damage notes;
     - no meaning change that isn't highlighted.
  6. Optional: record one room and skip its first rows on purpose. Review
     should ask about it.

FILES
  patch-round17.py rebuilds round 17 from round 16:
    python3 patch-round17.py <round16 index.html> <round16 sw.js> <out folder>
  round16-to-round17.diff and cleanup-round12-to-round17.diff show every change.

ROUND 17.1 (cleanup val only, same day)
  The first live ?test=stirling run passed 15 of 19. All 4 fails were Bathroom 1:
  Claude got stuck repeating "Ok. Done. End." inside its first check entry and
  the rest of that room's check list was lost (the sorted text was fine).
  The val now asks for short reasons, asks Claude again once if an answer gets
  stuck (when there is time inside the app's 60-second wait), and if it is still
  stuck it keeps the sorted text and puts "check list cut short — check the
  whole room against the audio" first in that room's check list.
  The val address now shows "version": "17.1". The Stirling test shows, per
  room, whether it was asked again (retried) or cut short.
  Second live run (old code still pasted) passed 17 of 19. It also showed:
  the Kitchen came back with nothing to check, not even the oven's serial and
  type numbers; and some Bathroom reasons had stray text stuck on the end.
  17.1 now adds every model, serial and type number to the check list itself
  ("check against the photo") and trims that stray text. The Lounge misses
  ("wooden seat and wind ledge", "small smart architrave") are still
  highlighted in the Word file by the app's own list.
  Third live run (17.1 pasted) passed 11 of 19: Bedroom 1 and Bathroom 1
  each stopped after one flag whose reason rambled. Results vary a lot from
  run to run (15, 17, 11) when Claude answers without thinking first.
  17.1 now also asks again when a reason rambles (over 160 characters or
  across lines), and the Stirling test runs each room twice side by side:
  no thinking (what the app uses) and a short think first ("low" effort),
  with pass counts and the slowest room's time for each. The app keeps
  no thinking until we choose.
  Side-by-side runs: no thinking passed 19 of 19 twice (slowest room 27 s and
  23 s; the "ask again" step rescued Bathroom 1 once). Short thinking was
  quicker (13-17 s) but passed 18 of 19 both times, and once left out the
  Bedroom 1 downlights sentence entirely. The app stays on no thinking.
  The third run hit Val Town's 1-minute limit ("Val timed out after 1m"):
  every val request is stopped at 60 s on the current plan. The val now
  gives up on Claude at 50 s so it always answers; if asking again can't
  finish in time, it keeps the first answer marked "check list cut short".
  The Stirling test now runs only the app's way; add &compare=1 for both.
  test-val-round17.mjs: 30 of 30 (15 before, plus 15 for 17.1).
  Fourth live run (with the 50 s limit): 17 of 19 in 25 s. Bathroom 1 and
  Kitchen got stuck and were rescued by asking again; the Lounge got stuck
  after 23 s, past the 20 s cut-off, so it kept its first answer marked
  "check list cut short". The cut-off is now 30 s (the 50 s limit still
  stops a slow second try in time).

ROUND 17 SPEECH-TO-TEXT VAL (inspectionapp-assemblyai, version 17)
  Ten Stirling mishears added to the words AssemblyAI is told to expect:
  Foxtel, windowsill, window ledge, cutlery rack, fluorescent, frosted,
  shower screen, lockable handle, doorstop, Mitsubishi Electric (101 terms).
  Nothing else changed. Paste vals/inspectionapp-assemblyai.ts into the
  inspectionapp-assemblyai val; its address then shows "version": 17 and
  "keyterms": 101.

CONFIRMED 12 Oct: the round 14 vals were live (assemblyai and dropbox-archive
both showed "version": 14).

INDEPENDENT REVIEW (12 Oct, fresh agent, after the val changes)
  No audio-loss risk, no secrets or personal data. Fixed what it found:
  1. The "check list cut short" warning could miss the VA's job Word file:
     its quote kept the added words ("in good condition"), so it matched no
     sentence, and the app ignored cut_short. Now the app keeps cut_short on
     the recording and the Word file puts "Check list cut short. The AI
     stopped before listing everything to check. Check the whole room
     against the audio." at the top of the room (per part for two-part
     rooms). The val's warning quote leaves added phrases out.
     THIS CHANGES index.html (still app version 17, cache v21, not yet live),
     so the repo index.html is now newer than the Downloads round 17 copy
     and patch-round17.py no longer rebuilds it. Upload the repo copy.
  2. Model, serial and type numbers partway through a line, on a shared
     " / " line, or with a space ("HAF 2000") are now flagged too.
  3. A second answer in plain words, or one that drops words, no longer
     replaces a usable first answer.
  4. Trade-off to know: a very long room that used to answer in 50-58 s now
     stops at 50 s and uses the app's keyword split (better than being cut
     off by Val Town at 60 s).
  5. Reason clean-up is capped at 2,000 characters; test labels made honest.
  Tests: test-round17.js 400 of 400 (397 + 3); test-val-round17.mjs 34 of 34.

ROUND 17 LIVE (12 Oct): merged to main (pull request 1). The site serves
cache v21 and "app version 17".

CLEANUP VAL 17.2 (after the merge, val only)
  The last Stirling run passed 16 of 19: Bedroom 1 came back with an empty
  check list ("spiderwebs" and the garbled windows sentence not flagged),
  without getting stuck. Now a room of 120+ words whose check list comes
  back empty is asked again (same 30 s / 50 s limits), and the second answer
  is used only if it is sound and lists something. If it is empty again,
  the answer is kept as is (the room may really be clean). The app's own
  highlight list still marks known mishears in the Word file either way.
  Paste vals/inspectionapp-cleanup.ts; the address then shows
  "version": "17.2". test-val-round17.mjs: 38 of 38.

17.2 LIVE TEST (12 Oct): 12 of 19, version 17.2 confirmed. Bedroom 1 and
  Bathroom 1 were asked again and came back nearly empty both times.
  More serious: in Bedroom 1 Claude LEFT OUT "2 up and down secured at front
  door" (no Light Fittings row at all) and quietly reworded garbled phrases
  ("second black under framing" -> "black aluminium framing", "one twin
  handle is going to go side" -> "One silver metal handle secured") with no
  flag. That breaks rule 9 and the 75% word check can't catch one sentence.
  The words are still in the Word file's "Raw transcript (as heard)" pages at
  the back, but nothing points the VA to them.
  Proposed for round 18: an app-side check that compares each transcript
  sentence with the sorted text and puts "Possibly left out: '…' (time)" at
  the top of the room, so it doesn't depend on Claude behaving. Optionally
  try Claude Opus 5.5 for the cleanup (slower, about twice the cost).
