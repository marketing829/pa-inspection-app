/**
 * Property Assist — inspection audio transcription (AssemblyAI)
 * ---------------------------------------------------------------------------
 * A drop-in twin of the existing Deepgram val. Same contract in both
 * directions, so the app switches engines by pointing at a different URL and
 * nothing else in the chain — the Dropbox archive val included — has to change.
 *
 *   POST <this url>            body = the raw audio bytes (what the app sends)
 *   POST <this url>            body = {"url": "https://…"}  a file already online
 *   POST <this url>            body = {"id": "…"}   round 11: pick up a job that was still
 *                              running when the last request ran out of time (the 504
 *                              below carries its id), instead of uploading it again
 *   GET  <this url>            health check: is the key set, what's configured
 *
 *   → 200 {"transcript": "...", "engine": "assemblyai", ...}
 *
 * Setup: add ASSEMBLYAI_API_KEY to this val's environment variables.
 * Lock (round 7): add PA_KEY too, the same value as PA_KEY in index.html.
 * Every POST must then carry ?k=<PA_KEY>, which the app adds itself. Until
 * PA_KEY is set, calls without it still work. Files over 60 MB get a 413,
 * which the app treats as final instead of retrying.
 * Round 14 (after Archibald): the app adds &size=<bytes>; a body that arrives
 * shorter is refused (400) so the phone sends it again. Calls to AssemblyAI
 * have time limits, a failed poll no longer ends the request, and every
 * request is logged ("transcribe ok" / "transcribe FAILED", bytes, time).
 * Optional: PA_MAX_WAIT_MS (default 50000) — how long to wait for a job before
 * giving up and letting the app retry. Val Town kills a request at 60s on the
 * free plan and 10 min on Pro, so raise this only if the account is on Pro.
 * Round 17 (version 17): ten more words in the keyterms list, from the Stirling
 * Street mishears. Nothing else changed.
 */

const API = "https://api.assemblyai.com";
// Shared key the app sends as ?k= (see the note at the top).
const PA_KEY = Deno.env.get("PA_KEY") || "";
const MAX_BYTES = 60 * 1024 * 1024; // the same 60 MB line the app and the archive val use

// Deepgram calls these keyterms, AssemblyAI calls them a keyterms prompt; both
// do the same job — tell the model which words are likely, so it stops turning
// "stainless steel" into "submetal" and "ceiling fan" into "kennel". Everything
// here came out of a real mishear in tester feedback or off the room library.
const KEYTERMS = [
  "stainless steel",
  "cornice",
  "skirting",
  "architrave",
  "flick mixer",
  "mixer tap",
  "towel rail",
  "towel ladder",
  "rangehood",
  "exhaust fan",
  "ceiling fan",
  "downlight",
  "light fitting",
  "batten holder",
  "pelmet",
  "Venetian blind",
  "vertical blind",
  "roller blind",
  "sheer curtain",
  "pinch pleat",
  "tilt wand",
  "pull cord",
  "tilt cord",
  "window winder",
  "flyscreen",
  "security screen",
  "door stopper",
  "self closer",
  "laminate",
  "melamine",
  "kickboard",
  "splashback",
  "benchtop",
  "cistern",
  "vanity",
  "basin",
  "laundry trough",
  "Colorbond",
  "terracotta",
  "weatherboard",
  "reticulation",
  "RCD",
  "NBN",
  "smoke alarm",
  "water meter",
  "meter box",
  "serial number",
  "model number",
  "grout",
  "silicone",
  "scuff marks",
  "doors and frames",
  "windows and screens",
  "blinds and curtains",
  "power points and light switches",
  "hanging rod",
  "glass pane",
  "Westinghouse",
  "Fisher and Paykel",
  "Rinnai",
  "Bosch",
  "Chef",
  // Round 7. AEG, Aiphone and NBN Co are already fixed after the fact by the
  // cleanup val ("egg", "iPhone", "NBN coax"); asking for them here stops the
  // mishear at the source. Kelvinator is on the cleanup val's brand list too.
  "AEG",
  "Aiphone",
  "Kelvinator",
  "NBN Co",
  // Added from the 402/612 Beaufort Street corrections, 9 September. Each one
  // is a phrase the engine got wrong on that job — better to stop the mishear
  // here than to patch it in the app afterwards.
  "silver metal",
  "metal frame",
  "discolouration",
  "discoloured",
  "smudge marks",
  "no hooks",
  "high traffic areas",
  "seat and lid",
  "cistern",
  "dual flush",
  "toilet roll holder",
  "towel rail",
  "wood look laminate",
  "marble look stone",
  "grey tile",
  "grey grout",
  "wind out handle",
  "fly screens",
  "data point",
  "triple light switch",
  "drip tray",
  "cutlery tray",
  "induction cooktop",
  "showerhead",
  "manhole",
  "sprinkler",
  "nib wall",
  "kickboard",
  // Round 17: words AssemblyAI got wrong at Stirling Street (12 Oct) — "foxhole",
  // "wind ledge", "colour rack", "which means the aircon", "sub" and others.
  "Foxtel",
  "windowsill",
  "window ledge",
  "cutlery rack",
  "fluorescent",
  "frosted",
  "shower screen",
  "lockable handle",
  "doorstop",
  "Mitsubishi Electric",
];
// A few terms appear twice above (cistern, towel rail, kickboard); each is sent once.
const TERMS = [...new Set(KEYTERMS)];

// Context for the model, in plain language. AssemblyAI uses this to understand
// the subject matter — it ignores formatting instructions, so there's no point
// asking it here for headings or Australian spelling. The spelling comes from
// the en_au locale below, the structure from the app.
// The speakers are named as Australian on purpose. AssemblyAI's en_au setting
// changes spelling only, not how the audio is heard, so the accent has to be
// carried here — this prompt is the one place the model is told about it.
// Kept under 50 words: AssemblyAI's guidance is that a prompt past that adds
// nothing, and the room vocabulary is already carried by the keyterms.
const PROMPT =
  "An Australian residential property inspection, spoken by inspectors with " +
  "Australian accents. They walk through a house room by room describing " +
  "condition: ceilings, walls, skirting, flooring, doors, windows, blinds, " +
  "power points, light fittings, wet areas, fixtures and appliances, with " +
  "brand names and model and serial numbers.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function (req: Request): Promise<Response> {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const key = Deno.env.get("ASSEMBLYAI_API_KEY");
  if (!key) {
    return json({
      error:
        "ASSEMBLYAI_API_KEY is not set on this val — add it in Environment Variables.",
    }, 500);
  }
  const auth = { authorization: key };
  // `|| 50000` twice on purpose: unset falls back, and so does a typo'd value,
  // rather than becoming NaN and polling until Val Town kills the request.
  const maxWaitMs = Number(Deno.env.get("PA_MAX_WAIT_MS") || 50000) || 50000;

  if (req.method === "GET") {
    return json({
      ok: true,
      engine: "assemblyai",
      model: "universal-3-5-pro (falls back to universal-2)",
      language: "en_au",
      keyterms: TERMS.length,
      maxWaitMs,
      key_required: !!PA_KEY,
      max_mb: 60,
      resume: true, // round 11
      version: 17,
      size_check: true,
    });
  }
  if (req.method !== "POST") {
    return json({ error: "POST the audio to this URL" }, 405);
  }
  // The shared key, checked before anything is read or sent on.
  if (PA_KEY && new URL(req.url).searchParams.get("k") !== PA_KEY) {
    return json({ error: "not allowed" }, 403);
  }
  // Turn an oversized file away before reading it, when its size is declared.
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES) {
    return json({ error: "too large — 60 MB max" }, 413);
  }

  // Round 14: every answer that isn't a transcript is logged, with the size.
  let sizeIn = 0;
  const fail = (body: Record<string, unknown>, status: number) => {
    console.log("transcribe FAILED", status, sizeIn, "bytes", Date.now() - startedAt, "ms", JSON.stringify(body).slice(0, 300));
    return json(body, status);
  };

  try {
    // ── 1. Get the audio somewhere AssemblyAI can read it ────────────────────
    // The app posts the raw blob, so it gets uploaded first. A JSON {url} body
    // skips that — useful for a file already sitting in Dropbox with a link.
    let audioUrl = "";
    let resumeId = ""; // round 11: a job already submitted on an earlier request
    const contentType = (req.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.id === "string" && /^[A-Za-z0-9_-]{6,80}$/.test(body.id)) {
        resumeId = body.id;
      } else {
        if (!body || typeof body.url !== "string" || !/^https:\/\//i.test(body.url)) {
          return json({ error: 'JSON body needs a "url" field' }, 400);
        }
        audioUrl = body.url;
      }
    } else {
      const bytes = await req.arrayBuffer();
      if (!bytes.byteLength) return fail({ error: "empty audio body" }, 400);
      if (bytes.byteLength > MAX_BYTES) return fail({ error: "too large — 60 MB max" }, 413);
      // Round 14: the app says how big the file is. Short = cut off on the way.
      const declared = new URL(req.url).searchParams.get("size");
      if (declared !== null && /^\d+$/.test(declared) && Number(declared) !== bytes.byteLength) {
        return fail({ error: "incomplete upload — send it again", got: bytes.byteLength, expected: Number(declared) }, 400);
      }
      sizeIn = bytes.byteLength;
      const up = await fetch(`${API}/v2/upload`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/octet-stream" },
        body: bytes,
        signal: AbortSignal.timeout(Math.max(10000, Math.min(35000, maxWaitMs - 15000))),
      });
      if (!up.ok) {
        return fail({
          error: "upload to AssemblyAI failed",
          status: up.status,
          detail: (await up.text()).slice(0, 500),
        }, 502);
      }
      audioUrl = (await up.json()).upload_url;
    }

    // ── 2. Submit the job ────────────────────────────────────────────────────
    // speech_models is deliberately not set: the account default is
    // Universal-3.5 Pro with Universal-2 as the fallback, which is what we want.
    // Australian English only applies through language detection with a
    // localisation hint — "en_au" is not accepted as a plain language_code.
    const full = {
      audio_url: audioUrl,
      language_detection: true,
      language_detection_options: { localization: ["en_au"] },
      punctuate: true,
      format_text: true,
      disfluencies: false, // drops the umms and ahhs before they're ever typed
      prompt: PROMPT,
      keyterms_prompt: TERMS,
    };

    async function submit(payload: Record<string, unknown>) {
      return await fetch(`${API}/v2/transcript`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    }

    let degraded: string | undefined;
    // Round 11: resuming skips the upload and the submit, straight to waiting.
    let job: any = resumeId ? { id: resumeId } : null;
    if (!job) {
    let res = await submit(full);

    // If AssemblyAI rejects one of the tuning fields — they move with the model
    // line — fall back to a plain request rather than failing the room. A room
    // transcribed without the keyterms beats no transcript at all, and the
    // response says so, so it shows up rather than passing silently.
    if (res.status === 400) {
      const detail = (await res.text()).slice(0, 300);
      degraded = "tuning rejected, transcribed plain: " + detail;
      res = await submit({
        audio_url: audioUrl,
        punctuate: true,
        format_text: true,
      });
    }
    if (!res.ok) {
      return fail({
        error: "submit failed",
        status: res.status,
        detail: (await res.text()).slice(0, 500),
      }, 502);
    }
    job = await res.json();
    }

    // ── 3. Wait for it ───────────────────────────────────────────────────────
    // AssemblyAI is asynchronous, unlike Deepgram. Polling here keeps that
    // invisible to the app, which just wants a transcript back on the same
    // request. If the job outlasts the budget the app is told to retry — the
    // audio is still on the phone, so nothing is lost by giving up early.
    while (true) {
      const left = maxWaitMs - (Date.now() - startedAt);
      if (left <= 0) {
        return fail({
          error: "transcription still running when time ran out",
          id: job.id,
          retry: true,
        }, 504);
      }
      await sleep(Math.min(2000, left));
      // Round 14: one poll that fails or hangs is a blip, not the end of the request.
      let poll: Response;
      try {
        poll = await fetch(`${API}/v2/transcript/${job.id}`, {
          headers: auth,
          signal: AbortSignal.timeout(Math.max(2000, Math.min(10000, maxWaitMs - (Date.now() - startedAt)))),
        });
      } catch (_) {
        continue;
      }
      if (!poll.ok) {
        // Round 11: a resumed id AssemblyAI doesn't know — tell the app to send the audio.
        if (resumeId && (poll.status === 400 || poll.status === 404)) {
          return fail({ error: "job not found", id: job.id }, 404);
        }
        continue; // a blip on one poll isn't a failed job
      }
      const t = await poll.json().catch(() => null);
      if (!t) continue;

      if (t.status === "completed") {
        console.log("transcribe ok", sizeIn, "bytes", Math.round(t.audio_duration || 0), "s audio", Date.now() - startedAt, "ms");
        return json({
          transcript: (t.text || "").trim(),
          engine: "assemblyai",
          model: t.speech_model || "universal-3-5-pro",
          language: t.language_code || "en_au",
          audio_seconds: t.audio_duration,
          took_ms: Date.now() - startedAt,
          id: t.id,
          // Word timings, so the app can put [m:ss] beside every sentence and the
          // typist can jump straight to a misheard word. AssemblyAI counts in
          // milliseconds; sent as seconds so a very short clip can't be misread.
          words: Array.isArray(t.words)
            ? t.words.map((w: any) => ({
              word: w.text,
              start: Math.round(w.start / 100) / 10,
            }))
            : [],
          ...(degraded ? { degraded } : {}),
        });
      }
      if (t.status === "error") {
        return fail(
          { error: t.error || "transcription failed", id: job.id },
          502,
        );
      }
    }
  } catch (e) {
    return fail({ error: String((e as Error)?.message || e) }, 500);
  }
}