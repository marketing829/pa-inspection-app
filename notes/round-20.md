PA INSPECTION APP: ROUND 20, 13 Oct 2026
========================================

Why: Daphne checked the room checklist against the PCR palm cards (Updated
Palm Cards 2025) and asked to:
  - follow the palm cards, but keep the checklist tidy and not too long;
  - replace Smoke Alarms in the mandatory items with Gas Meter Reading;
  - add a camera / upload for each mandatory item, with the photo required,
    and clearly named in Dropbox.

Branch: round-20 (built on top of round-19, which isn't merged yet).
App version 20, phone cache v24.


WHAT CHANGED IN THE ROOM CHECKLIST (palm cards)
  Added where the palm card had something the app didn't:
  - Front Gardens: Aircon Motor
  - Garage/Carport: Garbage Bins; "Walls/Shelves" is now "Walls/Shelves/Hooks"
  - Bedrooms 1 to 4 and Study: Screen Door/Handles (after the door)
  - Kitchen: "Skirting" is now "Skirting/Kickboards"
  - Ensuite, Bathroom, Toilets, Powder Room, Laundry, Balcony: "Flooring" is
    now "Flooring/Drains"
  - Rear Exterior: Aircon Motor and Garbage Bins; "Exterior Flooring" is now
    "Exterior Flooring/Drains". The single "Pool" row moved to its own room.
  New rooms on the Start screen (not ticked by default):
  - Pool/Spa: Fences/Gate, Garden Beds, Reticulation, Pool/Spa/Water
    Condition, Pool/Spa Pumps, Taps & Hoses, Additional. The row name reminds
    the inspector to describe the water.
  - Bathroom/Laundry: the bathroom rows, then the laundry ones kept apart
    (Laundry Tapware, Laundry Benchtops, Laundry Splash Back, Laundry
    Underbench Cupboards, Overhead Cupboards, Linen Cupboards). A room added
    with a name like "Bathroom Laundry" gets these rows too.
  Kept tidy: the palm card lists cupboards, pantry, verandah and pergola as
  5 to 8 lines each. In the app each stays one row (the inspector still says
  ceiling, light, walls … and it all files under that row). The longest room
  is Bathroom/Laundry with 35 rows.
  The typist editor uses the same rows (New job from audio).
  Jobs already in progress keep the rows they started with.


WHAT CHANGED IN THE MANDATORY ITEMS
  1. Smoke Alarms is gone. Gas Meter Reading is in its place. The items are
     now: Water Meter Reading, Water Meter Location, RCD Box / Electrical
     Meter, Gas Meter Reading, NBN Box.
  2. Each item has a photo tile: Water Meter (under the location), RCD Box,
     Gas Meter, NBN Box. Tapping it on the iPhone offers Take Photo or Photo
     Library. More than one photo per item is fine (for example, the meter
     and a close-up of the reading).
  3. Photos can be taken on the Start screen (they wait on the phone and send
     after Start) or on the Review page.
  4. Required: each missing photo is listed under "Before you finish" on
     Review, and Finish asks "Mandatory items still needed: … Finish this
     inspection?". It doesn't block Finish, because some properties have no
     gas meter. Tell me if you'd rather it blocked.
  5. In Dropbox, in the job's Photos folder, named so they list first:
       00 Mandatory - Water Meter 1 - 0912 - 57.jpg
       00 Mandatory - Water Meter 2 - 0913 - 58.jpg
       00 Mandatory - RCD Box 1 - 0915 - 59.jpg
       00 Mandatory - Gas Meter 1 - 0916 - 60.jpg
       00 Mandatory - NBN Box 1 - 0920 - 61.jpg
     (1, 2 = which photo of that item; 0912 = the time it was taken; the last
     number is the photo's number on the phone, so two photos can never get
     the same name and replace each other in Dropbox)
  6. The Word file's Security/Safety section lists the gas meter reading and
     how many photos of each item are in the Photos folder. The Smoke Alarms
     template row stays in the Word file for the VA, showing "Not recorded
     in the app". The inspection details file and the CSV have Gas Meter
     too.
  7. A job started before this update keeps any smoke alarm text already
     typed; the files still show it.

  8. Photos taken on the Start screen join the job at Start. If they're more
     than 12 hours old, or if you tap Resume on a saved job, the app asks
     first ("Add them to <address>?"). Cancel keeps them on the Start screen,
     so another property's photos never land in the wrong job.

Photo safety: photos follow the same rules as serial plate photos. Each one is
saved on the phone first, a copy is sent, and it stays on the phone until
Dropbox confirms it. A photo taken on the Start screen is only sent once it
belongs to a job, so it can't land in an "Unknown property" folder.


WHAT TO UPLOAD / PASTE
  - Push the round-20 branch with GitHub Desktop; once you say so it's
    merged to main (after round 19), which publishes index.html, sw.js and
    editor.html.
  - No val changes this round. Nothing to paste into Val Town.
  - No new environment variables.


WHAT TO TEST ON A REAL IPHONE
  1. Force-quit and reopen: Admin settings shows "app version 20".
  2. Start screen: tap a mandatory photo tile. Check that you're offered Take
     Photo and Photo Library, and both work.
  3. Take a water meter photo on the Start screen, leave the app for the
     Camera or a call, come back: the photo is still on the tile.
  4. Start the job: the photo appears in Dropbox as
     "Photos/00 Mandatory - Water Meter 1 - <time> - <number>.jpg" in the
     job's folder.
  5. On Review, add the RCD, gas and NBN photos. Each tile says "in Dropbox"
     once sent.
  6. Finish with one photo missing: the question names it. Cancel keeps the
     job open.
  7. Add the Pool/Spa and Bathroom/Laundry rooms on a test job and check the
     rows on the room checklist.


INDEPENDENT REVIEW (fresh reviewer, after the build)
  No audio risks found. Fixed what it found:
  1. Start-screen photos could join the wrong job (Resume on an older job,
     or photos left from a property that never started). Now it asks.
  2. In rare timing cases (the phone storage stalls at Finish, or the app is
     closed mid-send) a Start-screen photo could stay on the phone, never
     sent. It now keeps its job's details and still goes to that job's folder.
  3. Typist editor: for jobs started before this update, renamed rows
     ("Flooring" → "Flooring/Drains", "Skirting" → "Skirting/Kickboards" …)
     showed as Not mentioned plus a second row at the bottom. The old row's
     text now fills the renamed row.
  4. No false wrong-room warning between Bathroom/Laundry and Laundry or
     Bathroom, or between Pool/Spa and Rear Exterior. A real warning shows
     the room's name, not its code.
  5. Photo names include the phone's photo number (see above).
  6. Finish counts Start-screen photos still sending, and after Resume a
     photo sent while the job was closed shows as "in Dropbox".

TESTS
  tests/test-round20.js: 491 checks, all pass (42 new for round 20: palm card
  rows, new rooms, editor rows match the app, gas meter, photo tiles,
  camera-or-library, Start-screen photos kept and sent after Start, Dropbox
  names, numbering, Review and Finish wording, resume, older jobs' smoke
  alarm text, and the review fixes). The private real-data copy passes too.
