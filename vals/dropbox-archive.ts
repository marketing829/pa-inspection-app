// Property Assist — Dropbox archive endpoint (Val Town)
// ---------------------------------------------------------------------------
// The app POSTs each room's audio (and its transcript as a .txt) here. This
// service holds the Dropbox credentials and files everything into a sandboxed
// base folder. The Dropbox tokens NEVER live in the public app — only here.
//
// Required Val Town environment variables (Settings → Environment variables):
//   DROPBOX_APP_KEY        — your Dropbox app's "App key"
//   DROPBOX_APP_SECRET     — your Dropbox app's "App secret"
//   DROPBOX_REFRESH_TOKEN  — a long-lived OAuth refresh token (see setup notes)
//
// Optional (round 11, typist editor):
//   EDITOR_KEY             — a SEPARATE key for the typist editor to READ the
//                            inspections folder. Not the same as PA_KEY: PA_KEY
//                            sits in the public app, so it can only ever guard
//                            writes. Until EDITOR_KEY is set, reading is off.
//
// Optional (round 7):
//   PA_KEY                 — the shared key, the same value as PA_KEY in
//                            index.html. Once set, every POST must carry
//                            ?k=<PA_KEY> (the app adds it). Until it's set,
//                            calls without it still work.
//
// The app calls this as:
//   POST <thisUrl>?path=<relative/path/file.ext>&mode=overwrite&k=<PA_KEY>
// with the file bytes as the request body. The relative path is sandboxed
// under BASE_FOLDER and checked against the path rules below, so nothing can
// be written anywhere else.
//
// mode=overwrite replaces a file of the same name instead of adding a "(1)"
// copy. Dropbox keeps the replaced version in the file's version history.
// Without it (a phone still on an older build) the val adds and renames, as
// it always did.
//
// Answer: { ok: true, path: "<where the file actually landed>" }. The app
// writes that name into the room's .txt so the typist opens the right audio.
// A plain visit in a browser shows whether the key is switched on.
//
// Round 11 — reading, for the typist editor (GET, needs ?k=<EDITOR_KEY>):
//   ?action=list&path=<folder>   folders and files in one folder ("" = the base)
//   ?action=get&path=<file>      a .txt or .json file's text (5 MB max)
//   ?action=link&path=<file>     a 4-hour Dropbox link to play an audio file
// Same base folder and path rules as writing; nothing outside it can be read.
// Round 11 also allows .json uploads (the app's per-room file for the editor);
// round 7 refused them, so no room .json has reached Dropbox yet.
//
// Round 14 — after Archibald (9 Oct), where a phone sent photos and text but
// never one recording, and nobody could see why:
//   POST ?action=log&k=<PA_KEY>   the app reports a sending problem (plain-text
//                                 JSON: stage, error, phone, room, recent errors).
//                                 It is written to this val's log as
//                                 "PHONE PROBLEM", nothing else. Look in Logs.
//   &size=<bytes> on an upload    the app says how big the file is; a body that
//                                 arrives shorter is refused (400) so the phone
//                                 sends it again, instead of a cut-off file.
//   { ..., size }                 every upload answer says how many bytes
//                                 Dropbox stored; the app checks it.
//   Every upload is logged ("upload ok" / "upload FAILED", path, bytes, time).
//   Dropbox calls have time limits; an expired Dropbox token is renewed and the
//   upload tried once more; a busy Dropbox (429 / 5xx) gets one more go.

const ALLOWED_ORIGIN = "https://marketing829.github.io";
const BASE_FOLDER = "/Property Assist Inspections";
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB per file — a long room is well under this
const PA_KEY = Deno.env.get("PA_KEY") || "";
const EDITOR_KEY = Deno.env.get("EDITOR_KEY") || "";
const MAX_READ_BYTES = 5 * 1024 * 1024; // text and json only; audio is streamed via a link
const MAX_LOG_BYTES = 16 * 1024; // one problem report from a phone
const UPLOAD_TIMEOUT_MS = 50000; // Val Town ends a request at 60 s on the free plan
const TOKEN_TIMEOUT_MS = 15000;

// Path rules. The app only ever sends "<date> - <address>/<file name>", with
// the address already stripped of characters Dropbox can't hold. Anything else
// is refused: more than three levels, a name over 200 characters, a hidden
// file, or a file type the app doesn't make.
const MAX_DEPTH = 3;
const MAX_NAME = 200;
const ALLOWED_EXT = new Set([
  "m4a", "mp4", "aac", "webm", "ogg", "mp3", "wav", "audio", // room recordings
  "txt", // room transcripts, inspection details, failure notes
  "json", // round 10: each room as data, for the typist editor
  "docx", // the PCR Word file
  "jpg", "jpeg", "png", "heic", "webp", // serial plate photos
]);

// Access tokens last ~4 hours; cache the minted one in module memory and refresh
// only when it's close to expiry. Val instances are short-lived, so this just
// avoids re-minting within a single warm instance.
let cachedToken = "";
let cachedExpiry = 0;

export default async function (req: Request): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method === "GET") {
    const action = new URL(req.url).searchParams.get("action");
    if (action) return await readAction(req, action, cors);
    return json(
      {
        ok: true, service: "dropbox-archive", key_required: !!PA_KEY, max_mb: 60,
        version: 14, editor_reading: !!EDITOR_KEY, problem_log: true, size_check: true,
      },
      200,
      cors,
    );
  }
  if (req.method !== "POST") {
    return json({ error: "Send a POST with the file in the body." }, 405, cors);
  }
  // The shared key, checked before anything is read or written.
  if (PA_KEY && new URL(req.url).searchParams.get("k") !== PA_KEY) {
    return json({ error: "Not allowed." }, 403, cors);
  }

  // Only our deployed app may call this from a browser. A missing Origin (native
  // testing via curl/Shortcuts) is allowed; real browsers always send one.
  const origin = req.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) {
    return json({ error: "Origin not allowed." }, 403, cors);
  }

  // Round 14: a problem report from a phone. Logged, nothing stored.
  if (new URL(req.url).searchParams.get("action") === "log") {
    if (Number(req.headers.get("content-length") || 0) > MAX_LOG_BYTES * 4) {
      return json({ error: "Report too large." }, 413, cors);
    }
    const text = await readLimited(req, MAX_LOG_BYTES);
    let entry: unknown = text;
    try { entry = JSON.parse(text); } catch (_) { /* keep the raw text */ }
    console.log("PHONE PROBLEM", JSON.stringify(entry));
    return json({ ok: true }, 200, cors);
  }

  // Resolve + sandbox the target path.
  const url = new URL(req.url);
  const checked = cleanPath(url.searchParams.get("path") || "");
  if (!checked.path) return json({ error: checked.error }, 400, cors);
  const dropboxPath = checked.path;
  const overwrite = url.searchParams.get("mode") === "overwrite";

  // Turn an oversized file away before reading it, when its size is declared.
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES) {
    return json({ error: "File too large — 60 MB max." }, 413, cors);
  }
  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: "No file received." }, 400, cors);
  }
  if (body.byteLength > MAX_BYTES) {
    return json({ error: "File too large — 60 MB max." }, 413, cors);
  }
  // Round 14: the app says how big the file is. Short = cut off on the way.
  const declared = url.searchParams.get("size");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) !== body.byteLength) {
    console.log("upload REFUSED (incomplete)", dropboxPath, body.byteLength, "of", declared);
    return json(
      { error: "Incomplete upload — send it again.", got: body.byteLength, expected: Number(declared) },
      400,
      cors,
    );
  }

  const started = Date.now();
  const arg = headerJson({
    path: dropboxPath,
    mode: overwrite ? "overwrite" : "add",
    autorename: !overwrite,
    mute: true,
  });
  let db: Response | null = null;
  let lastProblem = "";
  // Round 14: up to two goes. An expired token is renewed first; a busy
  // Dropbox (429 / 5xx) gets a short wait.
  for (let go = 1; go <= 2; go++) {
    let token: string;
    try {
      token = await getAccessToken(go > 1 && db?.status === 401);
    } catch (e) {
      console.log("upload FAILED (token)", dropboxPath, String(e).slice(0, 200));
      return json(
        { error: "Could not authenticate with Dropbox.", detail: String(e).slice(0, 200) },
        502,
        cors,
      );
    }
    try {
      db = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Dropbox-API-Arg": arg,
          "Content-Type": "application/octet-stream",
        },
        body,
        // Never past Val Town's 60 s, counting the first go.
        signal: AbortSignal.timeout(Math.max(5000, Math.min(UPLOAD_TIMEOUT_MS, 55000 - (Date.now() - started)))),
      });
    } catch (e) {
      db = null;
      lastProblem = "could not reach Dropbox: " + String((e as Error)?.message || e).slice(0, 120);
      break; // a timeout already used most of the request's 60 s
    }
    if (db.ok) break;
    const retryable = db.status === 401 || db.status === 429 || db.status >= 500;
    lastProblem = "Dropbox " + db.status + ": " + (await db.text().catch(() => "")).slice(0, 300);
    // A second go only if there's time for it inside Val Town's 60 s.
    if (!retryable || go === 2 || Date.now() - started > 20000) break;
    if (db.status !== 401) {
      const ra = Number(db.headers.get("Retry-After") || 0);
      await new Promise((r) => setTimeout(r, Math.min(5000, Math.max(1000, ra * 1000))));
    }
  }
  if (!db || !db.ok) {
    console.log("upload FAILED", dropboxPath, body.byteLength, "bytes", Date.now() - started, "ms", lastProblem);
    return json(
      { error: "Dropbox upload failed", status: db ? db.status : 0, detail: lastProblem },
      502,
      cors,
    );
  }
  const data = await db.json();
  const stored = typeof data.size === "number" ? data.size : body.byteLength;
  console.log("upload ok", data.path_display || dropboxPath, stored, "bytes", Date.now() - started, "ms");
  return json(
    { ok: true, path: data.path_display || dropboxPath, mode: overwrite ? "overwrite" : "add", size: stored },
    200,
    cors,
  );
}

// Round 11: read-only actions for the typist editor. Fails closed: with no
// EDITOR_KEY set, nothing can be read.
async function readAction(
  req: Request,
  action: string,
  cors: Record<string, string>,
): Promise<Response> {
  const url = new URL(req.url);
  if (!EDITOR_KEY) {
    return json({ error: "Reading is switched off. Add EDITOR_KEY to this val." }, 403, cors);
  }
  if (url.searchParams.get("k") !== EDITOR_KEY) {
    return json({ error: "Wrong editor key." }, 403, cors);
  }
  const origin = req.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) {
    return json({ error: "Origin not allowed." }, 403, cors);
  }
  const rel = url.searchParams.get("path") || "";
  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    return json({ error: "Could not authenticate with Dropbox.", detail: String(e).slice(0, 200) }, 502, cors);
  }
  const api = (endpoint: string, body: unknown) =>
    fetch("https://api.dropboxapi.com/2/" + endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  if (action === "list") {
    const folder = cleanFolder(rel);
    if (folder.error) return json({ error: folder.error }, 400, cors);
    const entries: unknown[] = [];
    let res = await api("files/list_folder", { path: folder.path, limit: 2000 });
    for (let page = 0; page < 10; page++) {
      if (!res.ok) {
        return json({ error: "Dropbox list failed", status: res.status, detail: (await res.text()).slice(0, 300) }, 502, cors);
      }
      const d = await res.json();
      for (const e of d.entries || []) {
        entries.push({
          name: e.name,
          kind: e[".tag"] === "folder" ? "folder" : "file",
          size: e.size || 0,
          modified: e.server_modified || null,
        });
      }
      if (!d.has_more) break;
      res = await api("files/list_folder/continue", { cursor: d.cursor });
    }
    return json({ ok: true, path: rel, entries }, 200, cors);
  }

  const file = cleanPath(rel);
  if (!file.path) return json({ error: file.error }, 400, cors);
  const ext = file.path.slice(file.path.lastIndexOf(".") + 1).toLowerCase();

  if (action === "get") {
    if (ext !== "txt" && ext !== "json") return json({ error: "Only .txt and .json can be read here." }, 400, cors);
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Dropbox-API-Arg": headerJson({ path: file.path }) },
    });
    if (!res.ok) {
      return json({ error: "Dropbox read failed", status: res.status, detail: (await res.text()).slice(0, 300) }, res.status === 409 ? 404 : 502, cors);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_READ_BYTES) return json({ error: "File too large to read here." }, 413, cors);
    return new Response(buf, {
      status: 200,
      headers: { "Content-Type": ext === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", ...cors },
    });
  }

  if (action === "link") {
    const res = await api("files/get_temporary_link", { path: file.path });
    if (!res.ok) {
      return json({ error: "Dropbox link failed", status: res.status, detail: (await res.text()).slice(0, 300) }, res.status === 409 ? 404 : 502, cors);
    }
    const d = await res.json();
    return json({ ok: true, link: d.link, expires_in: 4 * 3600 }, 200, cors);
  }

  return json({ error: "Unknown action." }, 400, cors);
}

// Round 14: read at most max bytes of a body, however it was sent.
async function readLimited(req: Request, max: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  try {
    while (got < max) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      parts.push(value);
      got += value.byteLength;
    }
  } catch (_) { /* keep what arrived */ }
  try { await reader.cancel(); } catch (_) { /* already finished */ }
  const all = new Uint8Array(Math.min(got, max));
  let at = 0;
  for (const p of parts) {
    const take = Math.min(p.byteLength, all.length - at);
    all.set(p.subarray(0, take), at);
    at += take;
    if (at >= all.length) break;
  }
  return new TextDecoder().decode(all);
}

// A folder inside the base folder, for listing. "" is the base itself.
function cleanFolder(raw: string): { path: string; error?: string } {
  const segs = String(raw).replace(/\\/g, "/").split("/")
    .map((s) => s.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^\.+/, "").replace(/[. ]+$/, ""))
    .filter(Boolean);
  if (segs.length > MAX_DEPTH - 1) return { path: "", error: "Path too deep." };
  if (segs.some((s) => s.length > MAX_NAME)) return { path: "", error: "Name too long." };
  return { path: segs.length ? BASE_FOLDER + "/" + segs.join("/") : BASE_FOLDER };
}

// Mint a short-lived access token from the long-lived refresh token.
async function getAccessToken(forceNew = false): Promise<string> {
  const now = Date.now();
  if (!forceNew && cachedToken && now < cachedExpiry - 60000) return cachedToken;

  const key = Deno.env.get("DROPBOX_APP_KEY");
  const secret = Deno.env.get("DROPBOX_APP_SECRET");
  const refresh = Deno.env.get("DROPBOX_REFRESH_TOKEN");
  if (!key || !secret || !refresh) {
    throw new Error(
      "Missing DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN",
    );
  }

  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(key + ":" + secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      "token " + res.status + " " + (await res.text()).slice(0, 200),
    );
  }
  const d = await res.json();
  cachedToken = d.access_token;
  cachedExpiry = now + (d.expires_in ? d.expires_in * 1000 : 4 * 3600 * 1000);
  return cachedToken;
}

function json(
  obj: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Apply the path rules. Returns the full Dropbox path, or why it was refused.
function cleanPath(raw: string): { path?: string; error?: string } {
  const segs = String(raw).replace(/\\/g, "/").split("/")
    .map((s) =>
      s.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, " ") // characters Dropbox or Windows can't hold
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+/, "") // no hidden files, and "." or ".." can't climb out
        .replace(/[. ]+$/, "") // Windows drops a trailing dot or space
    )
    .filter(Boolean);
  if (!segs.length) return { error: "Missing ?path= for the file." };
  if (segs.length > MAX_DEPTH) return { error: "Path too deep." };
  if (segs.some((s) => s.length > MAX_NAME)) return { error: "Name too long." };
  const name = segs[segs.length - 1];
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (!ALLOWED_EXT.has(ext)) return { error: "File type not allowed." };
  return { path: BASE_FOLDER + "/" + segs.join("/") };
}

// Dropbox reads the upload instructions from an HTTP header, and a header can
// only carry plain ASCII. An address typed on an iPhone can hold a curly
// apostrophe (O’Connor) or an accent (Café), and either one stops the upload.
// Dropbox's documented fix is to write those characters as \u escapes.
function headerJson(obj: unknown): string {
  return JSON.stringify(obj).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
