PA INSPECTION APP: ROUND 19, 13 Oct 2026
========================================

Why: Daphne asked for a full review of everything built so far (smooth
recording, syncing to Dropbox, accurate transcription and sorting, polishing
without changing meanings), with her rules for sorting and polishing:
  - don't rewrite, summarise or change the meaning; don't remove anything;
  - keep every area, in the order said; don't duplicate an area the inspector
    comes back to unless it is clearly separate; flag an unclear area rather
    than guess;
  - Australian English, but "wood" stays "wood" when the inspector said it;
  - no damage or dirt mentioned: "in clean condition" / "in good condition";
    working fixtures (power points, light switches …): "secured and
    functional" where it applies.
Three reviewers went through the phone app, the vals and the typist editor.
What they found and what changed is below.

WHAT CHANGED FOR THE VA (Word file)
  1. "There is one deep scratch that runs along the door" was being deleted:
     the app took "scratch that" for the delete command. A scratch being
     described is now kept. "Scratch that" on its own still deletes.
  2. Claude now sees "sorry", so "sand, sorry, dust build-up" becomes "dust
     build-up" instead of "sand dust build-up". "Sorry" never reaches the
     Word file. Every self-correction is now on the check list.
  3. "In clean condition", "in good condition" and "secured and functional"
     that the inspector never said always show as added (grey italic), even
     when Claude forgets the brackets. One added next to a stain or mark goes
     on the check list ("added phrase next to a condition note").
  4. "Said but not in the sorted text" now also catches: a dropped damage
     note while the item is still described ("scuff marks to the door
     frame"), a changed count ("3" → "two"), a lost "no" ("No hooks" →
     "Hooks"), a swapped left/right, and "not working" replaced by "secured
     and functional". A "coming into the …" phrase with damage in it is
     checked too.
  5. A room Claude didn't sort (it timed out or refused) now says so at the
     top: "Not sorted by the AI. The rows were split by keyword …". It used to
     look like a room with nothing to check.
  6. Model, serial and type numbers are always highlighted, also when written
     out ("model number is MSZ-GE60VAD") and in rooms Claude didn't sort.
  7. A flag Claude made that couldn't be matched to a sentence is listed at
     the top of the room ("Also to check …") instead of disappearing.
  8. Fewer false highlights: real skirting ("chip to the corner skirting
     housing into bedroom 1", "scuff marks to the skirting on both sides") is
     no longer highlighted. "Hand towel" and "paper towel dispenser" no
     longer become "towel rail".
  9. A row that only names its item, said on its own ("Ceiling fan."), is
     kept instead of showing "Not mentioned".

WHAT CHANGED IN CLAUDE'S SORTING (cleanup val, version 19)
  Your rules are now written into Claude's instructions:
  - keep the inspector's words in the order said; only punctuation, capitals,
    clear mishears and Australian spelling change; no rewording or summary;
  - every mark, damage word, count, "no"/"not" and left/right stays in;
  - unclear area: filed under the closest subarea and flagged "unclear area";
  - coming back to a subarea adds to it; a second item of the same kind
    (a second wardrobe) is flagged;
  - the wardrobe's own ceiling, walls, skirting and flooring go under the
    wardrobe row, not the room's;
  - counts written as words ("3 double power points" → "three double power
    points"), never a different number;
  - Australian English; "wood" and "timber" never swapped;
  - read everything said about an item before adding "in clean/good
    condition"; working fixtures get only "secured and functional", and
    nothing when the inspector already said secured or working.
  Also: subarea names with different spacing ("Ceiling / Cornice") are no
  longer flagged as unclear.

  Decided with Daphne, 13 Oct (her rules, applied this way):
  - Order: the Word file keeps the PA template's row order (that's how the
    VA's report is laid out). The order things were said is kept in the time
    on each row and the room index.
  - "Don't remove anything": walk-through phrases ("Coming into the
    bedroom.") and words the inspector cancelled ("scratch that", "sorry")
    are still left out. Anything left out with damage, a count or a "no" in
    it is listed under "Said but not in the sorted text".
  - Counts are written as words ("three double power points"), as in the
    report.

WHAT CHANGED FOR THE INSPECTOR (phone)
  Nothing new on screen except these:
  - If the microphone doesn't open within 15 s (seen after coming back to the
    app), the room says the mic didn't open, instead of a running clock that
    records nothing. Done then says "Nothing was recorded. Record this room
    again", not "Saved".
  - Pause saves the last few seconds straight away (a pause is often
    followed by the camera).
  - If the phone was full and a room's audio is only in the app's memory,
    Finish asks to save it to Files first.
  Behind the scenes:
  - A backup copy of a recording could lose its label while a send was
    running, and the room was then called unreadable while good audio sat on
    the phone. Fixed, and the app now looks for that copy anyway.
  - Unreadable audio that never reached Dropbox is no longer deleted after
    14 days.
  - A room only counts as in Dropbox when Dropbox confirms the file size.
  - A stuck phone database, or a Word file builder that never loads, no
    longer holds up sending.

DROPBOX VAL (version 19)
  - Audio already in Dropbox is never replaced. Sending the same recording
    again is a no-op; a different-size copy is kept beside it (and logged).
  - The 60-second limit is counted from the start, so a slow upload gets a
    clear "try again" instead of being cut off half way.

TYPIST EDITOR
  - Shows the phone's notes at the top of the room (said but not in the
    sorted text with ▶ times, check list cut short, not sorted by the AI),
    and lists those rooms in the export check.
  - New job from audio: separate rooms with the same name ("bedroom" said
    three times) stay separate as Bedroom, Bedroom 2, Bedroom 3.
  - Recordings over two hours keep the right times.
  - Old from-audio drafts are cleaned up after 60 days (finished or never
    started ones only), so the browser doesn't fill up.
  - Dropbox reads give up after 45 s with a clear message.

VERSION
  App version 19, service worker cache v23. Cleanup val 19. Dropbox val 19.
  Assemblyai val unchanged (17).

WHAT TO UPLOAD
  1. GitHub: publish the round-19 branch and merge it into main (GitHub
     Desktop, same steps as before). This updates the phone app and the
     typist editor.
  2. Val Town: paste the whole of vals/inspectionapp-cleanup.ts into
     inspectionapp-cleanup. Check: opening its address shows "version": "19".
  3. Val Town: paste the whole of vals/dropbox-archive.ts into
     dropbox-archive. Check: opening its address shows "version": "19".
  No new environment variables.
  Order: paste the Dropbox val before (or together with) the GitHub merge.
  The round 14 val already sends the file size, so the app works with either,
  but the new val is what stops audio being overwritten.

INDEPENDENT REVIEW (fresh agent), fixed:
  1. The storage fix could, on a phone already saving as plain bytes, keep
     only the part of a room saved mid-recording and say it was saved (then
     Finish wouldn't offer to save the whole). Fixed: a record carrying more
     audio than the bytes kept keeps its own audio.
  2. "Tap is loose, scratch that, is secured" was no longer cancelled, and
     "Scratch that runs along the bottom edge" was still deleted. Both fixed.
  3. The inspector's own "in good condition" / "secured and functional" were
     sometimes marked added (when a nearby word was a fixed mishear). Now a
     phrase said as often as written is never marked added.
  4. "Lock on the skirting on both sides" (a Stirling mishear) had stopped
     being highlighted. It is again; real skirting after a mark isn't.
  5. Correct AI fixes ("7-way" → silver metal, "box top" → Foxtel, a
     corrected left/right) were listed as "said but not in the sorted text".
     Fixed.
  6. "No marks [added: in clean condition]" was flagged as added next to a
     condition note. "No marks", "no cracks or chips" don't count now.
  7. "Floor type is 2 tone" highlighted "2" as a type number. Fixed.
  8. "Two blows" (globes) is highlighted again now that counts are words.
  9. Needs an iPhone check: Finish's "save to Files" may download instead of
     opening the share sheet. The second question ("Is the audio saved in
     Files?") is the safeguard.

TESTS
  tests/test-round19.js: 449 of 449 (all round 18 checks, 7 updated for the
  new version numbers and one made safe to run just after midnight, plus 37
  new). The private copy also 449 of 449.
  tests/test-val-round19.mjs: 52 of 52 (38 from round 17, 2 updated, 14 new).
  Editor and Dropbox val: checked with scratch tests (16 val checks, 29
  editor checks), not yet in the repo's test files.

TO CHECK ON A PHONE (iPhone)
  - Force-quit and reopen: Admin settings shows "app version 19".
  - Record a room, Pause, open the camera, come back, Done: the room's audio
    is whole.
  - Fill the phone (or use one that's nearly full), record, Finish: it asks
    to save the audio to Files, and the share sheet opens.
  - Leave the app for a few minutes, come back, record: the mic opens (or the
    room clearly says it didn't).
  - After the next real job, in the Word file: are the "Said but not in the
    sorted text" notes real misses or false alarms? Any "added phrase next to
    a condition note" flags that are wrong?

STILL OPEN (not changed this round)
  - Very long rooms on weak signal: each upload must finish within Val
    Town's 60 seconds. A 20-40 MB room on a slow connection may keep
    retrying. The audio stays safe on the phone, but it may not arrive until
    better signal. Fix options for a later round: send big files to Dropbox
    in parts, or straight to Dropbox with a one-time upload link.
  - A room Claude didn't sort isn't asked again later; it gets the "Not
    sorted by the AI" note instead.
  - The AssemblyAI word list asks for both "silver metal" and "stainless
    steel". Worth watching whether "silver metal" ever comes back as
    "stainless steel".
  - If AssemblyAI ever refuses the word list, the val transcribes without it
    and says so ("degraded"), but the app doesn't show that yet.
  - The proofread val (room split for New job from audio) is still not in
    the repo, so its rules (order, [unclear], no duplicates) couldn't be
    checked. Paste a copy into vals/ next time it's open in Val Town.
  - Typist editor: changing room dividers after typing can still move typed
    work to the wrong room in a from-audio job.

HOSTING AND NATIVE APP (asked 13 Oct)
  Parked. Val Town's only real limit for us is 60 s per upload, and the fix
  (big recordings go straight to Dropbox in parts) is the same on any host.
  Plan: put round 19 live, watch the PHONE PROBLEM logs and stuck rooms after
  a couple of real jobs, do the Dropbox-in-parts change as round 20 if big
  rooms do get stuck. Native iPhone app (background sending) decided after
  the typist editor is finished, as before.
