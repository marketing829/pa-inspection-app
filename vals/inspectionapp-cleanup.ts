// inspectionapp-cleanup — Val Town HTTP val
// Sorts one room's transcript into the room's subareas with Claude, fixes the
// mishears only context can resolve, and lists anything it wasn't sure about.
//
// Setup (Val Town, account propertyassist):
//   Created 6 Oct 2026 as propertyassist/inspectionapp-cleanup.
//   The one step left: Env vars → add ANTHROPIC_API_KEY (console.anthropic.com).
//   Open the val's URL in a browser: {"ok":true,...,"note":"ready"} means it's on.
//   index.html already points at it (DEFAULT_CLEANUP_URL); until the key is set
//   it answers ok:false and the app quietly uses its keyword split instead.
//
// Model: Claude Sonnet 5.5 (claude-sonnet-5-5) since 6 Oct 2026, was Haiku 4.5.
// To go back, set PA_MODEL to claude-haiku-4-5 in Env vars; the request adapts.
// Check a model change in a browser: open this val's address with
// ?test=1&k=<PA_KEY> and one short sample room goes through the model.
//
// Round 17 (12 Oct 2026), from the Stirling Street test:
//   - Flagging no longer stops at about 5 per room. Unusual condition words
//     ("spiderwebs", "bug screen"), self-contradicting sentences ("no
//     detachable showerhead in good condition") and garbled phrases are always
//     flagged, so a garbled room can't come back with nothing to check.
//   - More mishears fixed from context (downlights, secured, Foxtel,
//     fluorescent, frosted, globes, cutlery rack, dual flush button …), and the
//     less certain ones are fixed AND flagged.
//   - A type number is written "Type: …", never as the model number.
//   - Self-corrections keep only the corrected words; "Coming into the …"
//     walk-through phrases are dropped.
//   - Browser check of the Stirling rooms: open this val's address with
//     ?test=stirling&k=<PA_KEY>. It runs four short Stirling rooms through the
//     model and lists each expectation as PASS or FAIL.
//   - 17.1: the first live Stirling run got stuck repeating itself inside one
//     Bathroom 1 check entry and lost the rest of that room's check list. Now
//     "why" is kept to a few words, a stuck answer is asked again once (if
//     there's time), and if it's still stuck the room gets a "check list cut
//     short" entry for the VA.
//   - 17.2: a long room (120+ words) whose check list comes back empty is asked
//     again too, and the second answer is used only if it lists something.
//
// Contract (the app already speaks this — don't change field names):
//   POST { transcript, room, subsections: string[], address }
//   →    { ok, model, sections: [{name, text}], text, check: [{quote, heard, why, words}] }
// Round 12 (8 Oct 2026): check entries carry "words", the doubtful words as they
// read in the output, so the VA's Word file can highlight just those words.
// Flagging is stricter (only what really doesn't make sense), smoke alarms go
// with the ceiling, and parts of a fixture are filed with that fixture.
// Round 9 (7 Oct 2026): a phrase the model ADDS ("in clean condition", "in good
// condition", "secured and functional") comes back wrapped as {+ ... +} inside
// the section text. The app turns it into "[added: ...]" and colours it red in
// the room's Word file, with every check sentence.
// Any failure returns ok:false and the app falls back to its keyword split.

const MODEL = Deno.env.get("PA_MODEL") || "claude-sonnet-5-5";
// Claude 4.x models take the old request (temperature 0 and a forced tool
// call). Sonnet 5.5 refuses both with a 400 error, so it gets the new one: the
// tool marked strict, tool_choice auto, and no thinking before the answer.
const LEGACY = /^claude-(haiku|sonnet|opus)-4/.test(MODEL);
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
// Shared key the app sends as ?k=. Set PA_KEY in Env vars to the same value as
// PA_KEY in index.html. Until it's set, the val accepts calls without it.
const PA_KEY = Deno.env.get("PA_KEY") || "";
const MAX_TRANSCRIPT_CHARS = 40000; // a long room is ~10,000; anything bigger isn't from the app
type Think = "off" | "low" | "medium";
// How the model works on a room in the app (see requestBody). Sonnet 5.5 only.
const THINK: Think = "off";
const MIN_KEEP_RATIO = 0.75; // refuse our own output if it dropped more than a quarter of the words

// Only the deployed app may call this from a browser, so a stranger who finds
// the URL can't run up the Claude bill. A missing Origin (curl, tests) is allowed.
const ALLOWED_ORIGIN = "https://marketing829.github.io";

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const RULES = `You file a property inspector's spoken room notes for Property Assist, a Western Australian property inspection business. The text came from speech-to-text on a phone, recorded while walking through ONE room of a rental property. A typist will build the final condition report from your output.

Your job: put every statement under the right subarea from the list you are given, fix words the speech engine clearly mis-heard, tidy sentences, and list anything you were not sure about.

THREE ABSOLUTE RULES. Breaking any of them makes the report wrong:
1. Never invent detail. Do not add any colour, number, material, condition, brand or item that is not in the transcript. The ONLY exception is the ADDED PHRASES section below, and every such phrase must be wrapped in {+ +}. Do not expand a word into a longer phrase because a subarea is named that way ("no hooks or doors" stays as it is, it does not become "no hooks or door stoppers").
2. Never omit anything. Every statement in the transcript appears in exactly one section. You re-file and re-punctuate; you do not summarise or shorten.
3. Never soften or strengthen a condition. "Scuff marks" stays scuff marks; "chips to frame" stays chips to frame.

FILING
- Use the subarea names EXACTLY as given. Only use names from the list.
- Inspectors usually announce a subarea ("Ceiling.", "Light fittings.") then describe it. Everything after an announcement belongs to that subarea until the next one, unless the words are clearly about something else.
- When the inspector talks fast, a subarea name can appear mid-sentence with no full stop ("...scuff marks light fitting is a frosted glass..."). Split there.
- A passing mention is not an announcement: "marks near the door" in the walls description stays under walls.
- If a statement fits none of the subareas, file it under the closest one and add it to check with why "not sure which subarea".
- Keep the subareas in the order given. Leave out subareas with nothing said about them: never return a subarea whose text would only be its own name or an added phrase.
- Parts of a fixture go with that fixture when it has its own subarea: pantry doors under Pantry, the range hood light under Exhaust Fan/Range Hood, the shower screen door under Shower/Screen, shower wall and floor tiles under Shower Tiles, the laundry cupboard under the cupboard subarea.
- Smoke alarms and smoke sensors go under the ceiling subarea (Ceiling or Ceiling/Cornice) when the room has one.
- Keep the announced subarea word at the start of its text, as spoken.
- Downlights, oyster lights, fluorescent lights and their globes and covers go under Light Fittings, even when they are said in the same breath as the ceiling.
- Drop walk-through phrases that only say where the inspector is ("Coming into the bedroom.", "coming into the car bay area", "no additional present coming into the storeroom" keeps "No additional present." only). They belong to no subarea.

FIXING
- Fix mis-heard words only when the context makes the right word obvious. Common ones in this work: "similar" / "submetal" / "once-off" / "simple" for "silver metal"; "screw" / "skin" / "good on" / "skid on" for "secured"; "pool cord" for "pull cord"; "pinch plate" for "pinch pleat"; "glass paint" for "glass pane"; "hanging road" for "hanging rod"; "tile rail" for "towel rail"; "light fangs" for "light fittings"; "cinnamon cornices" for "ceiling/cornices"; "kennel" for "fan"; "egg" for "AEG"; "iPhone" for "Aiphone" (intercom); "NBN coax" for "NBN Co box"; "Undermount" when the context is "underbench".
- More mis-hearings to fix when the context makes them obvious: "up and down" / "down skirting" / "downlight skirting" for "downlights secured"; "skirting" right after an item and before "both sides", "to the wall", "to the ceiling" or "to the flooring" for "secured" ("handle skirting both sides" → "handle secured to both sides"); "7-way" / "7-meter" / "seven metre" for "silver metal" (as in "one silver metal weight secured to the bottom" of a blind); "foxhole" / "foxtail" / "box top" for "Foxtel"; "press-in light" / "press and light" for "fluorescent light"; "fossil plastic" for "frosted plastic"; "blows" / "gloves" (of a light) for "globes"; "white middle" / "middle base" (drawers, cupboards) for "white metal" / "metal and base"; "colour rack" (dishwasher) for "cutlery rack"; "secured neither" for "secured underneath"; "address burns" / "dual flash" for "dual flush button"; "Lincoln(s) present" for "indicators present"; "dustbin at present" for "dust build-up present"; "triplets" for "trivets"; "fish glass" for "fixed glass"; "pencil curtains" for "pencil pleat curtains"; "underhangers" for "no handles".
- FIX AND FLAG (fix it, then put it in check): "once over" / "once of" / "once the" / "one sort of" before a metal fitting for "one silver metal"; "single" before a metal fitting (drain, sink, handle, mixer, tap, towel rail, cooking rack) for "silver metal" (but "single" is correct before power point, light switch, data point, Foxtel point and bed); "one side of the … is good" for "one silver metal … secured"; "twin handle" for "silver metal handle"; "lock winder head" / "corner skirting" (of a door or window) for "lockable handle(s)"; "sinks white plastic" (toilet) for "seat and cover are white plastic"; "which means the aircon" for "Mitsubishi Electric aircon"; "note the little frame" / "no digital frame" at the start of a garage for "No door or door frame".
- Keep quantities as spoken words ("two white tilt cords" stays as it is). Write numerals only for model numbers, measurements and meter readings.
- Australian spelling: grey, colour, discolouration, centre, mould, aluminium.
- Hyphenation: build-up, self-closer, wood-look, stone-look, marble-look, doorstop.
- Remove fillers (um, uh, er, sorry) and any leftover "scratch that" / "delete that" together with the words it was cancelling.
- A self-correction keeps only the corrected words: "sand— sorry, dust" → "dust"; "left— sorry, right side" → "right side"; "Door is a— oh, sorry. Door frame is…" → "Door frame is…". When the inspector abandons a description and starts it again ("The original frame is a black painted metal with chipping. Door is a— sorry. Door frame is a grey painted metal with chipping."), keep only the restarted version and put the dropped words in check.
- A restart ("one one double power point") becomes the intended phrase ("one double power point") — and goes in check.
- Every section's text: sentences start with a capital and end with a full stop.
- Never change a model or serial number. Copy it exactly and always add it to check with why "check against the photo".
- Write model and serial numbers in exactly this format, each on its own line: "Model Numbers: (combination)" and "Serial Numbers: (combination)".
- A type number is not a model number. If the inspector reads a type ("type is 71ADC01AD", "our type is …"), write it on its own line as "Type: (combination)". If the inspector says there is no model number, write "Model Numbers: Not present". Never move a type, product or batch number into Model Numbers.
- Spell brand names the way the brand spells them, so they can be searched on Google (Fisher & Paykel, Westinghouse, Rinnai, AEG, Aiphone, Kelvinator, Colorbond).

ADDED PHRASES (the typists' house style)
- If the inspector says nothing about marks, dirt or damage for an item, end that item's description with {+in clean condition+} for surfaces and floor coverings (ceiling, walls, skirtings, flooring) or {+in good condition+} for doors, frames, windows, fittings, cupboards and benchtops.
- For a working fixture (power points, light switches, light fittings, taps, exhaust fans, smoke alarms, appliances) where the inspector does not say whether it is secured or working, add {+secured and functional+}.
- Never add a phrase when the inspector mentions ANY mark, chip, crack, stain, dust, damage, wear or fault for that item, or says it was not tested or not working.
- Always write the braces exactly: {+in clean condition+}. Never put braces around anything the inspector said. Do not add these phrases to the check list; they are already highlighted.
- Keep "wood" or "timber" exactly as the inspector said it.

CHECK LIST
The typist uses the check list to find the words most likely to be wrong. A wrong statement that reads normally is the worst outcome, so flag every one of these:
- words that do not make sense in an inspection note and are probably mis-heard ("government lockable handle", "cow symbol present", "pane of white" when "painted white" was meant), including every word you fixed with less than full confidence and every FIX AND FLAG item above;
- a sentence that contradicts another or itself: "no power points" and then a power point described; "no detachable showerhead, in good condition" (says there is none, then describes its condition); two different descriptions of the same ceiling, walls or floor in one room;
- any condition or damage word that is not one of the usual ones. The usual ones: marks, scuff marks, smudge marks, sticky residue, chips, chipping, paint chipping, scratches, scratching, dents, cracks, cracking, holes, discolouration, staining, oil staining, water marks, tarnishing, rust, rusting, dust, dust build-up, dust marks, grease, grease marks, calcium build-up, mould, debris, leaf debris, bug debris, wear, peeling, lifting. Anything else used as a condition ("spiderwebs present", "bug screen to the cover", "calcium etched", "discoloured and rutted") is often a mis-hearing of a usual one: keep the words as heard and flag them with why "unusual condition word";
- a statement that something is present where the usual wording is that it is absent, or the other way round, when the words around it are garbled ("two set of wooden seat and wind ledge" where "no windowsill or window ledge" is usual);
- numbers that matter (quantities of fittings, meter readings) where the audio may differ, every brand name you were not sure of, and every model, serial and type number.
Do NOT flag sentences that read normally and use the usual words, or words you fixed with full confidence from the lists above. Flag as many entries as the room needs: a clean room may have none, a garbled room may need ten or more. Never leave a garbled sentence unflagged. quote = the WHOLE sentence exactly as it now reads in your output, without the braces. words = only the doubtful words, copied exactly as they appear inside quote (a few words, never the whole sentence). heard = the original words from the transcript (so the typist can find them in the audio). why = two to eight plain words, written once ("mis-heard brand", "unusual condition word"). Never explain your thinking in why and never repeat yourself; when an entry is done, go on to the next one. If nothing is doubtful, return an empty list.

Always answer by calling the file_room tool, never in plain text.`;

const TOOL = {
  name: "file_room",
  description: "Return the room's notes sorted into subareas, plus the list of things to check against the audio.",
  input_schema: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Subarea name, exactly as given" },
            text: { type: "string" },
          },
          required: ["name", "text"],
          additionalProperties: false,
        },
      },
      check: {
        type: "array",
        items: {
          type: "object",
          properties: {
            quote: { type: "string" },
            words: { type: "string", description: "Only the doubtful words, exactly as they appear inside quote" },
            heard: { type: "string" },
            why: { type: "string" },
          },
          required: ["quote", "why"],
          additionalProperties: false,
        },
      },
    },
    required: ["sections", "check"],
    additionalProperties: false,
  },
};

function wordCount(t: string) {
  // Added {+ +} phrases don't count, so an addition can never hide an omission.
  return (String(t || "").replace(/\{\+[^}]*\+\}/g, " ").toLowerCase().match(/[a-z0-9']+/g) || [])
    .filter((w) => !["um", "uh", "er", "erm", "sorry", "scratch", "that"].includes(w)).length;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") {
    const t = new URL(req.url).searchParams.get("test");
    if (t === "1") return await selfTest(req);
    if (t === "stirling") return await stirlingTest(req);
    return json({ ok: !!KEY, round: 17, version: "17.2", provider: "anthropic", model: MODEL, key_required: !!PA_KEY, note: KEY ? "ready" : "ANTHROPIC_API_KEY is not set" });
  }
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (PA_KEY && new URL(req.url).searchParams.get("k") !== PA_KEY) return json({ ok: false, error: "not allowed" }, 403);
  const origin = req.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) return json({ ok: false, error: "origin not allowed" }, 403);
  if (!KEY) return json({ ok: false, error: "ANTHROPIC_API_KEY is not set" }, 500);

  let input: any;
  try { input = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const transcript = String(input?.transcript || "").trim();
  const room = String(input?.room || "").trim();
  const subsections: string[] = Array.isArray(input?.subsections)
    ? input.subsections.map((x: unknown) => String(x || "").trim()).filter(Boolean)
    : [];
  if (!transcript) return json({ ok: false, error: "empty transcript" }, 400);
  if (transcript.length > MAX_TRANSCRIPT_CHARS) return json({ ok: false, error: "too large" }, 413);
  if (!subsections.length) return json({ ok: false, error: "no subsections" }, 400);

  const r = await fileRoom(transcript, room, subsections);
  return json(r.body, r.status);
}

// One room through the model, tidied and checked. Used by POST and the Stirling test.
async function fileRoom(transcript: string, room: string, subsections: string[], think = THINK): Promise<{ status: number; body: any }> {
  const json = (body: unknown, status = 200) => ({ status, body });
  const user = `Room: ${room || "(not named)"}\n\nSubareas, in order:\n${subsections.map((s) => "- " + s).join("\n")}\n\nTranscript:\n"""\n${transcript}\n"""`;

  const started = Date.now();
  let asked = await askClaude(user, think);
  if (asked.error) return json({ ok: false, error: asked.error }, 502);
  // ROUND 17.1: the model can get stuck repeating itself inside one check entry
  // (Stirling Bathroom 1: "Ok. Done. Ok. End." until it ran out of room), and
  // the rest of the room's check list is lost. Ask once more if there is time
  // inside the app's 60-second wait.
  // Also when a long room comes back with nothing at all to check (live
  // Stirling Bedroom 1, 12 Oct: "spiderwebs" and a garbled windows sentence,
  // check list empty). A clean short room may truly have none.
  let retried = false;
  const silentFirst = !ranAway(asked.data) && flaggedNothing(asked.data, transcript);
  if ((ranAway(asked.data) || silentFirst) && Date.now() - started < RETRY_IF_UNDER_MS) {
    // Only the time left before ANSWER_BY_MS; if the second try can't finish,
    // the first answer is kept and marked "check list cut short".
    const again = await askClaude(user, think, ANSWER_BY_MS - (Date.now() - started));
    retried = true;
    // Use the second answer only if it is a real, unstuck answer that keeps the
    // words; a second answer in plain text or that drops words must not replace
    // a first answer that could still be used.
    if (silentFirst) {
      // Take the second only if it is sound and actually lists something.
      if (!again.error && usable(again.data, transcript) && !ranAway(again.data) && !flaggedNothing(again.data, transcript)) asked = again;
    } else if (!again.error && usable(again.data, transcript) && (!ranAway(again.data) || !usable(asked.data, transcript))) asked = again;
  }
  const data = asked.data;
  const cutShort = ranAway(data);

  const block = toolBlock(data);
  // With tool_choice auto the model could answer in words instead; that room
  // then falls back to the app's keyword split, like any other failure.
  if (!block) return json({ ok: false, error: "no file_room call (stop: " + (data?.stop_reason || "?") + ")" }, 502);
  const out = block?.input || {};
  const allowed = new Map(subsections.map((s) => [s.toLowerCase(), s]));
  const order = new Map(subsections.map((s, i) => [s.toLowerCase(), i]));

  // Merge duplicates, keep only real subarea names, keep the room's own order.
  // A name the model made up goes to the subarea sharing the most words with it
  // (else "Additional", else the last one), and is flagged — the words are kept.
  const words = (t: string) => new Set((t.toLowerCase().match(/[a-z]+/g) || []).map((w) => w.replace(/s$/, "")));
  const extraChecks: { quote: string; words: string; heard: string; why: string }[] = [];
  function resolveName(raw: string, text: string) {
    const hit = allowed.get(raw.toLowerCase());
    if (hit) return hit;
    const want = words(raw + " " + text.split(/\s+/).slice(0, 3).join(" "));
    let best = "", score = 0;
    for (const s of subsections) {
      const n = [...words(s)].filter((w) => want.has(w)).length;
      if (n > score) { score = n; best = s; }
    }
    const name = best || subsections.find((s) => /additional/i.test(s)) || subsections[subsections.length - 1];
    extraChecks.push({ quote: text.slice(0, 80), words: "", heard: text.slice(0, 80), why: `not sure which subarea — filed under ${name}` });
    return name;
  }
  const merged = new Map<string, string>();
  for (const s of Array.isArray(out.sections) ? out.sections : []) {
    const text = String(s?.text || "").trim();
    if (!text) continue;
    const name = resolveName(String(s?.name || "").trim(), text);
    merged.set(name, ((merged.get(name) || "") + " " + text).trim());
  }
  const sections = [...merged.entries()]
    .sort((a, b) => (order.get(a[0].toLowerCase()) ?? 99) - (order.get(b[0].toLowerCase()) ?? 99))
    .map(([name, text]) => ({ name, text }));
  if (!sections.length) return json({ ok: false, error: "no sections returned" }, 502);

  const text = sections.map((s) => s.text).join(" ");
  const ratio = wordCount(text) / Math.max(1, wordCount(transcript));
  if (ratio < MIN_KEEP_RATIO) {
    return json({ ok: false, error: `kept only ${Math.round(ratio * 100)}% of the words — refused` }, 422);
  }

  const check = (Array.isArray(out.check) ? out.check : [])
    .map((c: any) => ({
      quote: String(c?.quote || "").trim(),
      words: String(c?.words || "").trim(),
      heard: String(c?.heard || c?.quote || "").trim(),
      why: shortWhy(String(c?.why || "").trim()),
    }))
    .filter((c: any) => c.quote)
    .concat(extraChecks);
  // Model, serial and type numbers are always checked against the photo, even
  // when the model leaves them off the list (live Stirling kitchen: none listed).
  // A plate can sit mid-line ("… cutlery rack. Model Numbers: FSE73700P") or
  // share a line ("Model Numbers: X / Serial Numbers: Y"); a value needs a digit.
  for (const s of sections) {
    for (const m of s.text.matchAll(/\b(Model Numbers?|Serial Numbers?|Type)\s*:\s*([^\n]*?)(?=\s+\/\s+|\.(?:\s|$)|\n|$)/gi)) {
      const value = m[2].trim();
      if (!/\d/.test(value)) continue;
      const plate = `${m[1]}: ${value}`;
      if (check.some((c: any) => c.quote.includes(value) || c.words.includes(value))) continue;
      check.push({ quote: plate, words: value, heard: plate, why: "check against the photo" });
    }
  }
  // Still stuck after asking again: keep the sorted text (it passed the word
  // check) but tell the VA the check list is incomplete, so the room never
  // reads as having little to check.
  if (cutShort) {
    // The app reads cut_short and puts a note at the top of the room. This entry
    // also lists it with the checks; its quote leaves out added phrases so it
    // matches the sentence the app shows ("… [added: …]" is ignored there).
    const plain = sections[0].text.replace(/\{\+[^}]*\+\}/g, "").replace(/\s+([.,])/g, "$1").replace(/\s+/g, " ");
    const first = (plain.match(/^.*?[.!?](?=\s|$)/) || [plain])[0].trim();
    check.unshift({ quote: first, words: "", heard: first, why: "check list cut short — check the whole room against the audio" });
  }

  return json({ ok: true, model: data?.model || MODEL, sections, text, check, ...(retried ? { retried: true } : {}), ...(cutShort ? { cut_short: true } : {}) });
}

const RUNAWAY_WHY_CHARS = 160; // a "why" is a few words; longer means the model got stuck
const RUNAWAY_WORDS_CHARS = 600;
// Ask again only if the first answer came back within 30 s. A second try takes
// ~15-25 s; ANSWER_BY_MS stops it in time if it runs long (was 20 s before the
// 50 s limit existed; a stuck Lounge at 23 s was not asked again).
const RETRY_IF_UNDER_MS = 30000;
const ANSWER_BY_MS = 50000; // Val Town stops a request at 60 s (seen live 12 Oct); answer before that

const SILENT_MIN_WORDS = 120; // a room this long with nothing to check is asked again
// The model's own check list is empty (plates the val adds don't count) on a
// room long enough that a few doubtful words are all but certain.
function flaggedNothing(data: any, transcript: string) {
  const check = toolBlock(data)?.input?.check;
  return !!toolBlock(data) && (!Array.isArray(check) || check.length === 0) && wordCount(transcript) >= SILENT_MIN_WORDS;
}
// A real file_room answer whose sections keep enough of the transcript's words.
function usable(data: any, transcript: string) {
  const secs = toolBlock(data)?.input?.sections;
  if (!Array.isArray(secs) || !secs.length) return false;
  const text = secs.map((x: any) => String(x?.text || "")).join(" ");
  return wordCount(text) / Math.max(1, wordCount(transcript)) >= MIN_KEEP_RATIO;
}
function toolBlock(data: any) {
  return (data?.content || []).find((b: any) => b.type === "tool_use" && b.name === "file_room");
}
function ranAway(data: any) {
  if (data?.stop_reason === "max_tokens") return true;
  const check = toolBlock(data)?.input?.check;
  // A "why" that rambles (over 160 characters or across lines) came with a
  // check list that stopped early in the third live Stirling run.
  return Array.isArray(check) && check.some((c: any) =>
    String(c?.why || "").length > RUNAWAY_WHY_CHARS || /\n/.test(trimRunOn(String(c?.why || ""))) || String(c?.words || "").length > RUNAWAY_WORDS_CHARS);
}
// The model sometimes runs on into the next field ('… may be door.",\n "heard":"…').
function trimRunOn(why: string) {
  return why.slice(0, 2000).split(/"\s*,?\s*"?(?:heard|words|quote|why)"?\s*:/)[0].replace(/["\s]+$/, "").trim();
}
// Keep a runaway "why" readable: its first sentence, at most 120 characters.
function shortWhy(why: string) {
  why = trimRunOn(why);
  if (why.length <= 120) return why;
  const first = (why.match(/^.*?[.;](?=\s)/) || [why])[0];
  return (first.length <= 120 ? first : first.slice(0, 117) + "…").trim();
}

// The request, in whichever shape the model takes.
function requestBody(user: string, think: Think = THINK) {
  const base = { model: MODEL, system: RULES, messages: [{ role: "user", content: user }] };
  if (LEGACY) {
    return { ...base, max_tokens: 4096, temperature: 0, tools: [TOOL], tool_choice: { type: "tool", name: "file_room" } };
  }
  return {
    ...base,
    // Covers any thinking as well as the answer. Sonnet 5.5 counts more tokens
    // for the same text than Haiku 4.5, and a long room could pass 4,096.
    max_tokens: think === "off" ? 8192 : 16000,
    tools: [{ ...TOOL, strict: true }],
    tool_choice: { type: "auto" },
    // "off": no thinking before the answer. "low"/"medium": a short think first
    // (adaptive thinking at that effort). Live Stirling runs, 12 Oct: "low" was
    // quicker but twice left out a Bedroom 1 sentence, so the app stays "off".
    // ?test=stirling&compare=1 runs both side by side.
    ...(think === "off" ? { thinking: { type: "between_tools" } } : { thinking: { type: "adaptive" }, output_config: { effort: think } }),
  };
}

async function askClaude(user: string, think: Think = THINK, waitMs = ANSWER_BY_MS): Promise<{ data?: any; error?: string }> {
  // Val Town stops any request at 1 minute, so give up in time to answer.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, waitMs));
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody(user, think)),
    });
    const data = await res.json();
    if (!res.ok) return { error: "anthropic " + res.status + ": " + String(data?.error?.message || "").slice(0, 160) };
    return { data };
  } catch {
    return { error: ctrl.signal.aborted ? "anthropic took too long" : "anthropic unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

// One short sample room through the model, for checking a model change in a
// browser before an inspection depends on it. Costs a fraction of a cent.
async function selfTest(req: Request): Promise<Response> {
  if (PA_KEY && new URL(req.url).searchParams.get("k") !== PA_KEY) return json({ ok: false, error: "add &k=<PA_KEY> to the address" }, 403);
  if (!KEY) return json({ ok: false, error: "ANTHROPIC_API_KEY is not set" }, 500);
  const started = Date.now();
  const user = `Room: Kitchen\n\nSubareas, in order:\n- Ceiling\n- Walls\n- Light fittings\n\nTranscript:\n"""\nCeiling. White painted, no marks. Walls grey paint scuff marks near the door. Light fittings two similar downlights.\n"""`;
  const asked = await askClaude(user);
  if (asked.error) return json({ ok: false, model: MODEL, error: asked.error, took_ms: Date.now() - started }, 502);
  const block = (asked.data?.content || []).find((b: any) => b.type === "tool_use" && b.name === "file_room");
  return json({
    ok: !!block,
    model: asked.data?.model || MODEL,
    took_ms: Date.now() - started,
    stop_reason: asked.data?.stop_reason,
    sections: block?.input?.sections || null,
    check: block?.input?.check || null,
    ...(block ? {} : { error: "the model answered without calling file_room" }),
  });
}

// ROUND 17: the Stirling Street rooms (12 Oct 2026, AssemblyAI raw transcripts)
// through the model, with what the comparison against the VA's report says the
// output must do. Open ?test=stirling&k=<PA_KEY>. Costs a few cents.
const STIRLING: { room: string; subsections: string[]; transcript: string; expect: [string, (o: any) => boolean][] }[] = [
  {
    room: "Bedroom 1",
    subsections: ["Door/Doorway Frames/Handles", "Ceiling/cornice", "Light Fittings", "Walls/Hooks/door stoppers", "Windows/Screens", "Blinds/Curtains", "Power Points/Light Switches", "Skirting", "Flooring", "Ceiling Fan/Air Conditioner", "Wardrobe/Doors/ceiling/wall/skirting/flooring/Shelves", "Additional"],
    transcript: "Uh, coming into the bedroom, uh, door frame is a white painted metal. We have small chipping to the middle and lower left side of the door frame. Door is a wooden painted white. Uh, one twin handle is going to go side ceiling, is painted white. There is one white plastic inbuilt speaker, one white plastic circle panel. There is, um, sticky residue marks secured to the ceiling around the panel and the speaker, and spiderwebs present as well. 2 up and down secured at front door. Walls are white painted. There is small scuff and smudge marks middle and lower section of the walls. We have no hooks, one silver metal sub secured to the flooring. Windows, we have 3 glass panes, uh, second black under framing, 1 fixed, 2 one, 2 black on lock, 1 handy person, 2 black on fly screen, 2 side, no windowsill, window ledge, we have blind 1, grey roller blind 1, silver metal pull cords. Power points and light switches, 1 single light switch, 3 double power points, 1 single foxhole and data point combination. Skirting is wooden painted white. Scuff marks to the skirting, we have a red mark to the, uh, skirting in front of the left— sorry, in front of the right side of the wardrobe. Uh, our flooring is a grey carpet, um, and in good condition. We have aircon, there is 1 white plastic which means the aircon is secured to the wall. Model number is MSZGE22VAD. Serial number is 8001886. We have wardrobe. There's 2 mirrored sliding doors, uh, black metal framing. Each side has a black wooden inboard handle. Tracks in good condition. Ceiling is painted white. Walls are painted white with scuff and spot marks. Skirting is a wooden painted white. Flooring is a grey carpet. Shelf, walnut laminate shelves secured with a white laminate panel secured neither, and 2 silver hanging rods secured neither, in good condition. We also have one grey plastic, which would be the aircon remote, secured to the wall.",
    expect: [
      ["Downlights are under Light Fittings", (o) => /downlight/i.test(sec(o, "Light Fittings"))],
      ["\"spiderwebs\" is flagged", (o) => flagged(o, /spider/i) || !/spider/i.test(allText(o))],
      ["The garbled windows sentence is flagged", (o) => flagged(o, /glass pane|framing|handy|fly ?screen/i)],
      ["\"foxhole\" is fixed to Foxtel", (o) => /foxtel/i.test(allText(o)) && !/foxhole/i.test(allText(o))],
      ["At least 3 things to check", (o) => (o.check || []).length >= 3],
    ],
  },
  {
    room: "Lounge",
    subsections: ["Door/Doorway Frames/Handles", "Ceiling/cornice", "Light Fittings", "Walls/Hooks/door stoppers", "Windows/Screens", "Blinds/Curtains", "TV/Power Points/Light Switches", "Skirting", "Flooring", "Ceiling Fan/Air Conditioner", "Additional"],
    transcript: "Uh, coming into the lounge dining area, we have a door leading out to the— sorry, to the balcony. We have, uh, 2 glass panes, a black metal frame, one good sliding track in good condition, one black metal corner skirting both sides, one black metal fly screen door with a black metal handle skirting both sides. Curtains, we have one grey roller blind, small smart architrave section with blind, one 7-way skirting bottom with 2 silver metal pull cords. Ceiling is painted white, one white plastic circle panel to keep the ceiling, one white plastic smoke detector, green light is present, and 4 white metal down skirting box door. Walls are white painted. Small scuffs, smudge marks, lower section of the wall. There is chipping to the corner wall housing into bedroom 1, chipping to the corner wall housing into the bathroom. Uh, small chip above the foxtail and data point combination. We have no hooks and no door stoppers in this area. Windows, we have 3 glass panes, 1 fixed, 2 wind out, with 2 black metal lock winder head present, 2 black metal fly screens good thing, 2 set of wooden seat and wind ledge. We have blind, 1 grey roller blind, 1 set of white skirting, 1 to 2 set of metal pull cords. Power points and light switches, 1 single light switch, 2 double power points, 1 single box top point data point combination, and 1 double Data point. Skirting, one section is a wooden painted white, uh, scuff mark to the skirting, uh, other section is a brown wood look. There is a chip to the corner skirting housing into bedroom 1. Flooring is a brown vinyl, there are scratching and scuff marks to the flooring. Air conditioner, wall mount plastic Mitsubishi electric air conditioner screwed to the wall, model number is MSZ-GE60VAD, serial number is 8001128. No additional is present.",
    expect: [
      ["Downlights are under Light Fittings", (o) => /downlight/i.test(sec(o, "Light Fittings"))],
      ["\"wooden seat and wind ledge\" is flagged", (o) => flagged(o, /wooden seat|wind ledge|windowsill|window ledge|sill/i)],
      ["The blind's \"small smart architrave\" is flagged", (o) => flagged(o, /smart|architrave|smudge/i)],
      ["\"skirting both sides\" no longer reads as skirting", (o) => !/(corner|handle) skirting both sides/i.test(allText(o)) || flagged(o, /skirting/i)],
      ["\"box top\" / \"foxtail\" fixed to Foxtel", (o) => !/box top|foxtail/i.test(allText(o))],
    ],
  },
  {
    room: "Bathroom 1",
    subsections: ["Door/Doorway Frames/Handles", "Ceiling", "Heating/Exhaust Fan/Vent", "Light Fittings", "Walls/Picture Hooks", "Windows/Screens", "Blinds/Curtains", "Power Points/Light Switches", "Skirting", "Flooring", "Wash Basin", "Tapware", "Benchtop", "Splash Back", "Mirror", "Underbench Cupboards/Drawers", "Shower/Screen/Curtain", "Shower Tiles", "Shower Tapware", "Towel Rails", "Toilet/Cistern/Seat", "Toilet Roll Holder", "Bath", "Bath Tiles", "Bath Tapware", "Additional"],
    transcript: "Uh, coming into the bathroom, we have doors painted white, metal chip middle right of the door frame. There's a wooden panel white, one chip above the latch to the door, one single lock on the skirting on both sides. Ceiling is painted white, one white plastic circle panel skirting ceiling, one white plastic, um, no brand exhaust fan, secure and functional. 2 white metal secure and functional walls are white painted, chipping to the wall in front of the right side of the door frame. There is small smudge marks in lower sections of the wall. We have no hooks are present, one single door stopper secured to the flooring, no windows, power points and light switches, one power point, one double light switch. Skirting is a white tile, white grout, chipping to the tile on the the toilet roll holder, uh, one chip to the tile behind the door stopper, one chip to the tile underneath the right side of the underbench cupboard. Flooring is a grey tile, grey grout, discoloured and rutted, once overdrained, tarnishing to the drain. Wash basin is a white ceramic, once overdrained and fogged in with scratching. Um, tap is once overmowed and mixed up, any caps are both present. Benchtop is a black ceramic, splashback is a black ceramic, mirrored cupboard combination, there's 3 mirrored cupboard doors, tarnishing edges of the doors, no handles. Interior is a grey laminate with 2 grey laminate shelves into each, in good condition. Underbench cupboards, there's 3 brown look laminate cupboard doors, no handles. Interior is a grey laminate, no shelves are present. Shelf Screen through glass panes, got a black vinyl framing, uh, 2 fixed ones, 4, 1 black vinyl. Here, glass pane, showers, wall tiles are white or white grout, discoloration to the grout. Floors are grey tile, grey grout, discoloration. Once the drain taps into the drain tap, once the big vanity case present, once of no detachable showerhead in good condition. Towel, once in the top, towel secured to the wall. Toilets, both areas are white ceramic, sinks white plastic, white ceramic, once of no address burns, no isolation present, towel holders secured to the wall, um, no additional present.",
    expect: [
      ["\"no detachable showerhead\" is fixed or flagged", (o) => !/no detachable/i.test(allText(o)) || flagged(o, /detachable|showerhead/i)],
      ["The garbled shower screen is flagged", (o) => flagged(o, /vinyl|shelf screen|glass pane|framing/i)],
      ["The toilet seat / flush button is fixed or flagged", (o) => /dual flush/i.test(allText(o)) || flagged(o, /address|burns|sinks|seat/i)],
      ["The toilet roll holder has its own row", (o) => sec(o, "Toilet Roll Holder") !== ""],
      ["At least 5 things to check", (o) => (o.check || []).length >= 5],
    ],
  },
  {
    room: "Kitchen",
    subsections: ["Door/Doorway Frames/Handles", "Ceiling", "Light Fittings", "Walls/Picture Hooks", "Windows/Window Safety Devices", "Blinds/Curtains", "Power Points/Light Switches", "Skirting", "Flooring", "Overhead Cupboards", "Drawers", "Underbench Cupboards", "Bench Tops", "Splash Back/Tiling", "Sink", "Tapware", "Exhaust Fan/Range Hood", "Stove Top/Hot Plates", "Oven/Griller", "Pantry", "Dishwasher", "Fridge Recess Cabinetry", "Additional"],
    transcript: "Oven is white silver AEG oven, one single handle, skid to the front. Uh, one black plastic button is present, indicators are present. 2 grey plastic dials, indicators are present. Door is a glass pane, interior is a grey metal. Lights present and functional. 2 grabbin' cooking trays, 2 single cooking racks. Uh, model number is not present. Our type is 71ADC01AD. Serial number is 82897294. We have dishwasher, front of dishwasher is a white laminate, um, brand is a silver metal XXL, also AEG XXL dishwasher. Um, interior has 1 grey plastic sensor, 1 silver filter in good condition, 1 grey plastic colour rack, 2 grey metal dishwashing racks. Uh, we have mononumber is S— sorry, FSE73700P. Serial number is 83840019.",
    expect: [
      ["Oven type written as \"Type: 71ADC01AD\"", (o) => /Type:\s*71ADC01AD/i.test(sec(o, "Oven/Griller"))],
      ["Type number not put in Model Numbers", (o) => !/Model Numbers?:\s*71ADC01AD/i.test(allText(o))],
      ["\"colour rack\" fixed to cutlery rack", (o) => /cutlery rack/i.test(sec(o, "Dishwasher"))],
      ["Dishwasher model kept exactly", (o) => /Model Numbers?:\s*FSE73700P/i.test(sec(o, "Dishwasher"))],
    ],
  },
];
function sec(o: any, name: string) {
  const s = (o?.sections || []).find((x: any) => String(x.name).toLowerCase() === name.toLowerCase());
  return s ? String(s.text || "") : "";
}
function allText(o: any) { return (o?.sections || []).map((x: any) => x.text).join(" "); }
function flagged(o: any, re: RegExp) {
  return (o?.check || []).some((c: any) => re.test(String(c.words || "")) || re.test(String(c.quote || "")) || re.test(String(c.heard || "")));
}
async function stirlingTest(req: Request): Promise<Response> {
  if (PA_KEY && new URL(req.url).searchParams.get("k") !== PA_KEY) return json({ ok: false, error: "add &k=<PA_KEY> to the address" }, 403);
  if (!KEY) return json({ ok: false, error: "ANTHROPIC_API_KEY is not set" }, 500);
  const started = Date.now();
  // Each way of working (no thinking, short thinking) on the four rooms, all at once.
  // &compare=1 also runs short thinking side by side (twice the rooms; can pass a minute).
  const modes: Think[] = !LEGACY && new URL(req.url).searchParams.get("compare") === "1" ? ["off", "low"] : [THINK];
  const runs = await Promise.all(modes.map(async (mode) => {
    const outs = await Promise.all(STIRLING.map(async (r) => {
      const t0 = Date.now();
      const o = await fileRoom(r.transcript, r.room, r.subsections, mode);
      return { o, ms: Date.now() - t0 };
    }));
    const results: { room: string; expect: string; result: string }[] = [];
    const rooms: Record<string, unknown> = {};
    STIRLING.forEach((r, i) => {
      const o = outs[i].o.body;
      rooms[r.room] = o.ok
        ? { seconds: Math.round(outs[i].ms / 1000), retried: !!o.retried, cut_short: !!o.cut_short, check: o.check, sections: o.sections }
        : { seconds: Math.round(outs[i].ms / 1000), error: o.error };
      r.expect.forEach(([label, fn]) => {
        let ok = false;
        try { ok = !!o.ok && fn(o); } catch { ok = false; }
        results.push({ room: r.room, expect: label, result: ok ? "PASS" : "FAIL" });
      });
    });
    const passed = results.filter((x) => x.result === "PASS").length;
    return { mode, passed, total: results.length, slowest_room_seconds: Math.max(...outs.map((x) => Math.round(x.ms / 1000))), results, rooms };
  }));
  const main = runs[0];
  return json({
    ok: main.passed === main.total, model: MODEL, round: 17, version: "17.2", took_ms: Date.now() - started,
    passed: main.passed + " of " + main.total, in_use: THINK,
    compare: runs.map((r) => ({ thinking: r.mode, passed: r.passed + " of " + r.total, slowest_room_seconds: r.slowest_room_seconds,
      fails: r.results.filter((x) => x.result !== "PASS").map((x) => x.room + ": " + x.expect) })),
    results: main.results, rooms: main.rooms, runs,
  });
}
