PA INSPECTION APP: ROUND 21, 13 Oct 2026
========================================

Why: Daphne replayed the Stirling Street recordings into the app (version 20,
on an Android phone) and compared the app's Word file with the VA's final
report, room by room. Findings:
  - No damage notes lost. The second store room was missing only because it
    wasn't replayed.
  - About eight wrong words read like normal sentences and weren't
    highlighted. Almost all came from the speech engine mishearing, not from
    Claude: "Drawer is a glass pane" (door), a dishwasher "sensor" (soap
    dispenser), "12-volt and data point" (Foxtel), "two red sliding doors"
    (mirrored), "walnut laminate shelves" (one white), "black vinyl framing"
    (black metal), "along a section of wall" (lower section), "No island tops
    present" (isolation tap).
  - An older store room transcript shows the engine stuck repeating "Doorframe
    is a grey painted metal with chipping" and skipping the door's chips and
    scuff marks. Nothing can highlight words that never reached the text.
  - Small things: a false "said but not in the sorted text" for "Coming into
    the entry/kitchen", the same bathroom note three times, "Bathroom 2" for
    the only bathroom, serial numbers running into the next sentence in the
    details file, and Balcony "Check list cut short" (its text was complete;
    only Claude's list of words to check was lost).
Daphne also asked for four app fixes: tidy the checklist for long rows, remove
"Send this property's audio to the VA" (it didn't work), add Discard
inspection, and fix the playback bar sitting at the end in Recordings.

Branch: round-21. App version 21, phone cache v25. Cleanup val version 21.


WHAT CHANGED FOR THE TYPIST (Word file and Dropbox files)
  1. More words are always highlighted in yellow, whatever the AI flagged:
     drawer/door on an oven, a plastic "sensor", "12-volt … data", "red
     sliding", "walnut", "vinyl framing", "island tops", "along a section of
     wall", "got to be a", "skidder", "window down", "zip closures",
     "blenders", "decanter", "Walmart", "grabber", "once a", and from the
     older store room "person", "security function", "clothes", "discretion",
     "grey tall", "serum number", "motor number". Checked against the right
     words too: downlights, Foxtel, mirrored, smoke sensor, lower section,
     globes and so on are not highlighted.
  2. New note at the top of a room when the speech engine repeats the same
     words three times or more in a row (said twice is usually the inspector
     starting again, so that isn't flagged):
     "The same words repeat: "Doorframe is a grey painted metal with
     chipping" (0:06–0:16). The speech engine may have got stuck and skipped
     what was said there. Listen to this part of the audio." The same warning
     is at the top of the room's .txt file ("LISTEN HERE") and in its .json.
  3. When the AI quotes two sentences as one, the doubtful words are
     highlighted in the right sentence instead of being listed at the top.
     A sentence listed at the top appears once, with all its reasons.
  4. "Coming into the entry/kitchen" is no longer reported as missing.
  5. Details file: a model, serial or type number ends its line
     ("Serial Numbers: 82897294" then "We have pantry…" on the next line).
  6. A room's .json now says why its check list was cut short (after the new
     cleanup val is pasted), so we can tell next time whether Claude got stuck.

WHAT CHANGED FOR THE INSPECTOR
  1. Discard this inspection: a small link under Finish on the Review page.
     It asks once ("Discard this inspection and start again? … Nothing is
     deleted."), then goes back to the Start screen without the "every room
     recorded" check or the mandatory items question.
     Daphne decided (13 Oct): nothing is deleted. Anything recorded stays
     under Recordings and still goes to Dropbox. The details file and (if
     nothing else is in the folder) the Word file say "Discarded on the
     phone. Don't type it unless told to." The discarded job's details file
     has its own name ("00 - Inspection details - DISCARDED 1432.txt"). If
     the inspector starts again at the same address the same day, the Word
     file is the new job only; the discarded rooms' audio and files stay in
     the folder.
  2. Long checklist rows ("Wardrobe/Doors/Ceiling/Wall/Skirting/Flooring/
     Shelves") wrap onto a second line instead of running off the screen.
     Each part starts with a capital on screen; the row names in the Word
     file don't change.
  3. "Send this property's audio to the VA" is gone from Recordings. Back is
     still there during a job (the bottom tabs do it on the Start screen),
     and each recording keeps its own Send and Save.
  4. Recordings on Android play with the right length: the bar starts at the
     left and shows the full time (0:14 of 1:27), not stuck at the end.
  5. A property with one bathroom (no ensuite) calls it "Bathroom". With an
     ensuite it is still "Bathroom 2".
  6. Review showed "Mandatory items still needed" twice once a field was
     typed (left over from round 20). Now once.
  7. Audio and data safety: if a room was mid-send at Finish, the send step
     could save over Finish's marks with its older copy. That could lose a
     serial number typed on the phone from the room's files, and would lose
     the new "discarded" mark. Those marks are now always kept.

CLEANUP VAL (version 21, to paste)
  - Fixes from context, and flags: skidder → secured; "window down skidder"
    → white metal downlights secured (under Light Fittings); "secure to
    functional" / "security function" → secured and functional; discretion →
    discolouration; "grey tall" → grey tile; serum/motor number → serial/
    model number; "once a big" → one silver metal; Walmart Classic → white
    plastic; grabber → grey metal; decanter → indicators; an oven's "Drawer
    is a glass pane" → Door; "12-volt and data point" → Foxtel; "island
    tops" → isolation tap (toilet); "person" → fluorescent; "clothes" →
    globes.
  - Always flags without changing: red sliding doors, walnut laminate,
    vinyl framing, a dishwasher sensor, "along a section" of wall, zip
    closures, blenders, in-wall speaker.
  - A dash with no "sorry" before a different item keeps both items (the
    Lounge ceiling lost "one white plastic circle panel" this way).
  - A cut-short answer says why (cut_reason).


WHAT TO UPLOAD / PASTE
  - Push the round-21 branch with GitHub Desktop; once you say so it's merged
    to main, which publishes index.html and sw.js.
  - Paste vals/inspectionapp-cleanup.ts (the whole file) into the Val Town
    val inspectionapp-cleanup. Open its address: it should show
    "version": "21".
  - Still to paste from round 19 if not done yet: dropbox-archive val 19.
  - No new environment variables.


WHAT TO TEST ON A REAL PHONE (iPhone and the Android)
  1. Force-quit and reopen: Admin settings shows "app version 21".
  2. Open Bedroom 1's checklist: the wardrobe row wraps onto two lines.
  3. Recordings on the Android: play a room. The bar starts at the left and
     shows the full length. On the iPhone, check playback still works as
     before.
  4. Recordings: the "Send this property's audio" button is gone; Back works
     during a job.
  5. Start a test job, record one room, then Review → Discard this
     inspection. Check: one question, back to Start, the room is still under
     Recordings and reaches Dropbox; "00 - Inspection details.txt" starts
     with DISCARDED ON THE PHONE.
  6. Start again at the same address: record a room and Finish. The Word file
     has only the new job's rooms.
  7. A test job with one bathroom: the room is called "Bathroom".
  8. Replay the Stirling rooms again: the words in the table above are
     highlighted, the kitchen has no "Coming into the entry/kitchen" note,
     and the bathroom's note at the top isn't repeated.
  9. Replay the old store room recording (the one with the repeats): its room
     in the Word file starts with "The same words repeat … Listen to this
     part of the audio."


INDEPENDENT REVIEW (fresh reviewer, after the build)
  No audio-loss risks found: discarded recordings still keep their audio until
  Dropbox confirms it, plus 14 days. Fixed what it found:
  1. Serious: one new line used a kind of pattern that iPhones before iOS
     16.4 can't read. The whole app would have stopped loading on those
     phones, and their recordings couldn't send. Rewritten; a test now
     checks the app never uses it.
  2. A discarded job with nothing recorded made a normal-looking empty Word
     file. It now says "Discarded".
  3. A restarted job's Word file could show the discarded job (Discard while
     offline, a restarted job with typed rooms only, a recording that
     finished saving just after Discard), or keep the old finish time. The
     Word file now follows the newest job only.
  4. The discarded job's details file could replace the restarted job's.
     It now has its own name.
  5. The repeat warning fired on ordinary restarts said twice. Now it needs
     three times or more.
  6. Some new highlights caught correct words ("along the lower section",
     "clothes line", "clothes hooks", "tall boy"). Fixed.
  7. The cleanup val fixed two guesses without flagging them ("white window
     down" → downlights, "white tall" → tile). Now fixed AND flagged.
  Small: a serial read with a space ("1234 5678") is no longer split onto
  two lines; Discard no longer sends a "PHONE PROBLEM" log entry.


TESTS
  tests/test-round21.js: 521 checks, all pass (30 new for round 21). The
  private real-data copy passes too. tests/test-val-round21.mjs: 58 mocked
  checks for the cleanup val, all pass (6 new).
