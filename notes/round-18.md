PA INSPECTION APP: ROUND 18, 12 Oct 2026
========================================

Why: in the live Stirling tests the AI (cleanup val, Sonnet 5.5) sometimes
left a sentence out ("2 up and down secured at front door") or quietly
reworded garbled words into normal-sounding text ("once of no address burns"
became "no dual flush button"), without flagging it. The 75% word check is
too coarse to catch one sentence. Decision (Daphne, 12 Oct): fix it in the
app, stay on Sonnet 5.5 for budget; if it is still not good enough, look at
other options (including the OpenAI API) later.

WHAT CHANGED IN THE APP (the VA's Word file only)
  For every recording the AI sorted, the app compares what the inspector said
  (the raw transcript, phrase by phrase at commas and full stops) with the
  sorted text. A phrase is listed when fewer than half of its key words are
  in any one sorted sentence. The room then gets a note at the top:
    "Said but not in the sorted text, left out or changed by the AI:
     “2 up and down secured at front door” (0:52); “…” (1:10). Check against
     the audio and the raw transcript."
  - Times come from the engine's word timings, like the other notes.
  - Up to 8 phrases are shown, then "and N more". Each counts to check.
  - Two-part rooms say which part.
  - Not listed: fixed mishears ("foxhole" → Foxtel), digits written as words,
    fillers, and "coming into the …" walk-through phrases.
  - Rooms the AI did not sort (keyword split) get no note.
  - An unpunctuated transcript is checked about six key words at a time.
  Nothing changes on the phone screens, in recording, saving or sending.

  On the last Stirling run it lists: Bedroom 1 "one twin handle is going to go
  side", "2 up and down secured at front door", "1 handy person"; Lounge "4
  white metal down skirting box door"; Bathroom 1 "tap is once overmowed and
  mixed up", "once of no address burns"; Kitchen nothing. It stays silent when
  the sorted text keeps everything (checked on all four Stirling rooms, with
  and without punctuation). It can miss a subtle rewording where half the
  words still match ("second black under framing" → "black aluminium
  framing").

VERSION
  App version 18, service worker cache v22. Also on this branch: cleanup
  val 17.2 (already pasted) and its notes.

WHAT TO UPLOAD
  GitHub: publish the round-18 branch and merge it into main (GitHub Desktop,
  same steps as round 17). Nothing to paste into Val Town.

TESTS
  tests/test-round18.js: 408 of 408 (all 400 round 17 checks, 6 updated for
  the new version numbers, plus 8 new). The private copy also 408 of 408.
  tests/test-val-round17.mjs: 38 of 38.

TO CHECK ON A PHONE
  Force-quit and reopen: Admin settings shows "app version 18".
  After the next real job, open the Word file and look for "Said but not in
  the sorted text" notes: are they real misses, or false alarms?
