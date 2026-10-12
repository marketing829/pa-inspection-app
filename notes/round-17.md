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
  test-val-round17.mjs: 22 of 22 (15 before, plus 7 for 17.1).
