// Headless checks for the round 21 build (round 21: more misheard words highlighted, a warning where the speech engine repeated itself and may have skipped audio, Discard inspection, long checklist rows wrap, the send-all-audio button removed, recordings play with the right length on Android). Round 20 build (round 20: rooms follow the PCR palm cards; Gas Meter replaces Smoke Alarms; a required photo for each mandatory item, named "00 Mandatory - …" in Dropbox). Round 19 header follows:
// Headless checks for the round 19 build (round 19: review fixes — "scratch that" kept as damage, "sorry" sent to the AI, added phrases always marked, fuller "said but not in the sorted text" list, notes for rooms not sorted and checks not placed, audio safety on the phone). Round 18 header follows:
// Headless checks for the round 18 build (round 18: "said but not in the sorted text" notes in the Word file). Round 17 header follows:
// Headless checks for the round 17 build (round 17: Stirling Street fixes — known-mishear highlights, parts that describe the same rows, Type numbers, missing room start, row times). Round 16 header follows:
// Headless checks for the round 16 build (round 16: Recordings by date, mandatory items on Start, inventory rows). Round 15 header follows:
// Headless checks for the round 15 build: all round 6 to 14 checks (some updated where round 15 changes wording, versions or
// moves Admin settings into the Settings sheet on purpose), plus round 15's own (room order, add room, tab bar, Today list,
// checklist Check all / Uncheck all, swipe between rooms, sheets).
// Serve the repo root on 127.0.0.1:8767 (python3 -m http.server 8767 --bind 127.0.0.1), then from the repo root: node tests/test-round18.js
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const BASE = 'http://127.0.0.1:8767/index.html';
const VAL = /web\.val\.run/;

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`);
}

// Fake speech engine the test can drive: window.__srEmit('text') sends a final result.
const INIT = `
  window.__toasts = [];
  window.__srCount = 0;
  class FakeSR {
    constructor() { window.__srCount++; window.__sr = this; this.onresult = null; this.onend = null; this.onerror = null; }
    start() { this.started = true; }
    stop() { const e = this.onend; this.started = false; if (e) setTimeout(() => e(), 0); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  window.__srEmit = (text) => {
    const sr = window.__sr; if (!sr || !sr.onresult) return false;
    const r = [{ transcript: text }]; r.isFinal = true;
    sr.onresult({ results: [r] }); return true;
  };
  // Optional delay on opening the mic, to reproduce the room-switch race.
  window.__micDelay = 0;
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => { if (window.__micDelay) await new Promise(r => setTimeout(r, window.__micDelay)); return gum(c); };
`;

async function newPage(browser, { storage = {}, valHandler } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, permissions: ['microphone'] });
  await ctx.addInitScript(INIT);
  await ctx.addInitScript((st) => { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); Object.entries(st).forEach(([k, v]) => localStorage.setItem(k, v)); sessionStorage.setItem('__seeded', '1'); } }, storage);
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(String(e)));
  page.__val = valHandler || (route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) }));
  // ROUND 19: the phone only counts a file as in Dropbox when the answer says
  // its size, as the live val (round 14 on) always does. A fake answer that
  // says ok without a size gets the size the phone sent, like the real one.
  await page.route(VAL, (route) => {
    const u = route.request().url(), size = (u.match(/[?&]size=(\d+)/) || [])[1];
    if (!size || !u.includes('9ecaffe4859311f181ad1607ee4eb77e') || u.includes('action=')) return page.__val(route);
    const fulfill = route.fulfill.bind(route);
    route.fulfill = (o) => {
      try { const b = JSON.parse(o.body); if (b && b.ok === true && typeof b.size !== 'number') o = Object.assign({}, o, { body: JSON.stringify(Object.assign(b, { size: Number(size) })) }); } catch (e) {}
      return fulfill(o);
    };
    return page.__val(route);
  });
  await page.goto(BASE);
  await page.evaluate(() => { const o = window.showToast; window.showToast = (m) => { window.__toasts.push(m); o(m); }; });
  return page;
}
async function startJob(page, address = '1 Test St') {
  await page.fill('#propAddress', address);
  await page.fill('#propClient', 'Test Client');
  await page.fill('#propInspector', 'Sam Tester');
  await page.click('#btnStartInspection');
  await page.waitForSelector('#screenInspection.active');
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

  // ── Setup screen ──────────────────────────────────────────────────────────
  {
    const page = await newPage(browser);
    check('loads with no script errors', page.__errors.length === 0, page.__errors);
    check('admin settings collapsed by default', !(await page.isVisible('#transcribeUrl')) && !(await page.isVisible('#engineSelect')));
    await page.evaluate(() => openSettings()); await wait(600);
    await page.click('#adminSettings summary');
    check('admin settings open on tap', await page.isVisible('#transcribeUrl'));
    check('AssemblyAI is the default engine', (await page.textContent('#engineSelect .engine-toggle.selected')) === 'AssemblyAI');
    check('cleanup not used while val not ready', await page.evaluate(() => cleanupEnabled() === false));
    await page.close();
  }
  {
    const page = await newPage(browser, { storage: { pa_engine: 'deepgram', pa_cleanup_url: '' } });
    check('untouched saved Deepgram moves to AssemblyAI once', await page.evaluate(() => ENGINE === 'assemblyai'));
    check('saved blank cleanup URL cleared once', await page.evaluate(() => localStorage.getItem('pa_cleanup_url') === null));
    await page.close();
  }
  {
    const page = await newPage(browser, { storage: { pa_engine: 'deepgram', pa_engine_chosen: '1' } });
    check('Deepgram chosen in the picker is kept', await page.evaluate(() => ENGINE === 'deepgram'));
    await page.close();
  }
  {
    // Cleanup readiness check
    const page = await newPage(browser);
    page.__val = (route) => {
      const u = route.request().url();
      if (u.includes('cleanup-test') && route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    };
    const ready = await page.evaluate(async () => { CLEANUP_URL = 'https://x-cleanup-test.web.val.run'; return await checkCleanupReady(); });
    check('cleanup ready when val answers ok:true', ready && await page.evaluate(() => cleanupEnabled()));
    const notReady = await page.evaluate(async () => { CLEANUP_URL = 'https://other.web.val.run'; return await checkCleanupReady(); });
    check('cleanup off when val answers ok:false', notReady === false);
    await page.close();
  }

  // ── Text rules ────────────────────────────────────────────────────────────
  {
    const page = await newPage(browser);
    const t = await page.evaluate(() => ({
      ring: applyCorrections('Towel ring secure.'),
      hooks: applyCorrections('Towel hooks x2 secure.'),
      bar: applyCorrections('Towel bar clean.'),
      bare: applyCorrections('Towel. Clean and secure.'),
      rail: applyCorrections('Towel rail clean.'),
      floor: detectSpokenRoom('This is the floor tiles, clean.'),
      powder: detectSpokenRoom('This is the powder coated frame.'),
      powderRoom: detectSpokenRoom('Coming into the powder room now.'),
      toilet: detectSpokenRoom('Coming into the toilet.'),
      hallway: detectSpokenRoom('Moving into the hallway.'),
      build: applyCorrections('Some buildup to grout. Build up near drain.'),
      door: applyCorrections('Door stop fitted. Two door stops.'),
      closer: applyCorrections('Self closer working.'),
      look: applyCorrections('Wood look laminate. Marble look benchtop.'),
      nbn: applyCorrections('NBN coax box on wall.'),
      er: stripFillers('Walls, er, painted white. Er, ceiling clean.'),
    }));
    check('towel ring left alone', t.ring === 'Towel ring secure.', t.ring);
    check('towel hooks left alone', t.hooks === 'Towel hooks x2 secure.', t.hooks);
    check('towel bar left alone', t.bar === 'Towel bar clean.', t.bar);
    check('bare towel still becomes towel rail', /^Towel rail\./.test(t.bare), t.bare);
    check('towel rail unchanged', t.rail === 'Towel rail clean.', t.rail);
    check('"the floor" no longer matches loo', t.floor === null, t.floor);
    check('"powder coated" no longer matches Powder Room', t.powder === null, t.powder);
    check('"powder room" still matches', t.powderRoom && t.powderRoom.roomId === 'powder_room', t.powderRoom);
    check('"toilet" still matches', t.toilet && t.toilet.roomId === 'toilet', t.toilet);
    check('"hallway" matches passage', t.hallway && t.hallway.roomId === 'passage', t.hallway);
    check('build-up rule', /build-up to grout/.test(t.build) && /Build-up near/.test(t.build), t.build);
    check('doorstop rule', /Doorstop fitted/.test(t.door) && /doorstops/.test(t.door), t.door);
    check('self-closer rule', /Self-closer/.test(t.closer), t.closer);
    check('x-look rule', /Wood-look laminate/.test(t.look) && /Marble-look benchtop/.test(t.look), t.look);
    check('NBN Co box rule', /NBN Co box on wall/.test(t.nbn), t.nbn);
    check('", er," stripped', !/\ber\b/i.test(t.er) && /Walls, painted white/.test(t.er), t.er);
    check('upload timeout scales with size', await page.evaluate(() => uploadTimeout(60000, 0) === 60000 && uploadTimeout(60000, 40e6) === 380000 && uploadTimeout(60000, 500e6) === 600000));
    await page.close();
  }

  // ── Room screen layout ────────────────────────────────────────────────────
  {
    const page = await newPage(browser);
    await startJob(page);
    check('top hint bar removed', (await page.$$('.dictation-hint')).length === 0);
    const dock = await page.evaluate(() => {
      const d = document.querySelector('.rec-dock').getBoundingClientRect();
      const prev = document.getElementById('btnPrevRoom').getBoundingClientRect();
      const fab = document.getElementById('fabRecord').getBoundingClientRect();
      const next = document.getElementById('btnNextRoom').getBoundingClientRect();
      return { h: d.height, oneRow: Math.abs(prev.top + prev.height / 2 - (fab.top + fab.height / 2)) < 4 && Math.abs(next.top + next.height / 2 - (fab.top + fab.height / 2)) < 4, order: prev.right <= fab.left && fab.right <= next.left, bottomBar: !!document.querySelector('.bottom-bar') };
    });
    check('Prev, record, Next in one row', dock.oneRow && dock.order, dock);
    check('dock is under 130px tall (was ~190)', dock.h < 130, dock.h);
    check('old separate nav bar gone', !dock.bottomBar);
    check('status chips sit directly under the room title', await page.evaluate(() => document.querySelector('.room-header').nextElementSibling.id === 'roomState'));
    check('instruction sits inside the rows list (round 13), not on the screen', await page.evaluate(() => document.querySelectorAll('.field-note.one-line').length === 0 && !!document.querySelector('#checklistBox .checklist-tip') && !/say the name, pause/.test(document.getElementById('nextSub').textContent)));
    check('no horizontal scroll at phone width', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.setViewportSize({ width: 320, height: 568 });
    check('dock fits at 320px', await page.evaluate(() => { const n = document.getElementById('btnNextRoom').getBoundingClientRect(); return n.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth; }));
    await page.close();
  }

  // ── Recording: Done swaps with Next; save toasts are honest ───────────────
  {
    const page = await newPage(browser);
    await startJob(page);
    await page.click('#fabRecord');
    await page.waitForFunction(() => !!currentRecSession);
    check('Done replaces Next while recording', (await page.isVisible('#fabDone')) && !(await page.isVisible('#btnNextRoom')));
    await wait(1200);
    await page.evaluate(() => window.__srEmit('ceiling painted white'));
    const idx0 = await page.evaluate(() => state.currentRoomIdx);
    await page.click('#fabDone');
    await page.click('#btnNextRoom');   // a fast second tap on the same spot
    check('a quick second tap after Done does not skip the room', await page.evaluate((i) => state.currentRoomIdx === i, idx0));
    await page.waitForFunction(() => window.__toasts.some(t => /Recording saved/.test(t)), null, { timeout: 5000 }).catch(() => {});
    check('"Recording saved" only after it is stored', await page.evaluate(async () => (await dbAll()).some(r => r.status !== 'recording')) && await page.evaluate(() => window.__toasts.some(t => /Recording saved/.test(t))));
    await wait(800);
    await page.click('#btnNextRoom');
    check('Next works after the pause', await page.evaluate((i) => state.currentRoomIdx === i + 1, idx0));
    check('no script errors while recording', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Item 1: switching rooms while the mic is opening ──────────────────────
  {
    const page = await newPage(browser);
    await startJob(page);
    const first = await page.evaluate(() => { const id = currentRoomId(); state.roomNotes[id] = 'Existing kitchen note.'; renderInspection(); return id; });
    await page.evaluate(() => { window.__micDelay = 1200; window.__srCount = 0; });
    await page.click('#fabRecord');
    await wait(150);
    await page.click('#roomNav .room-tab:nth-child(2)');
    await wait(2500);
    const r = await page.evaluate((id) => ({ note: state.roomNotes[id], sr: window.__srCount, rec: !!currentRecSession, listening: listeningRoom }), first);
    check('previous room note survives a fast room switch', r.note === 'Existing kitchen note.', r);
    check('no stray speech engine started', r.sr === 0, r);
    check('no stray recorder left running', !r.rec && r.listening === null, r);
    // and a normal start afterwards still works
    await page.evaluate(() => { window.__micDelay = 0; });
    await page.click('#fabRecord');
    await page.waitForFunction(() => !!currentRecSession && window.__srCount === 1, null, { timeout: 4000 }).catch(() => {});
    check('recording still starts normally afterwards', await page.evaluate(() => !!currentRecSession && listeningRoom === currentRoomId()));
    await page.click('#fabDone');
    await page.close();
  }

  // ── Item 2: recorder dies under the inspector ─────────────────────────────
  {
    const page = await newPage(browser);
    await startJob(page);
    await page.click('#fabRecord');
    await page.waitForFunction(() => !!currentRecSession);
    await wait(600);
    await page.evaluate(() => { try { currentRecSession.mr.stop(); } catch (e) {} });
    await page.waitForFunction(() => document.getElementById('recStatus').classList.contains('mic-problem'), null, { timeout: 3000 }).catch(() => {});
    check('red mic warning when the recorder stops by itself', await page.evaluate(() => document.getElementById('recStatus').classList.contains('mic-problem')));
    check('dock no longer claims "Recording"', await page.evaluate(() => !/^Recording$/.test(document.getElementById('recStatus').textContent)));
    await page.click('#fabDone');
    await page.waitForFunction(async () => !(await dbAll()).some(r => r.status === 'recording'), null, { timeout: 6000 }).catch(() => {});
    check('Done on a dead recorder finishes (no hang, nothing left on "recording")', await page.evaluate(async () => !(await dbAll()).some(r => r.status === 'recording') && !currentRecSession));
    await page.close();
  }

  // ── Item 3: phone storage full ────────────────────────────────────────────
  {
    const page = await newPage(browser);
    await startJob(page);
    await page.click('#fabRecord');
    await page.waitForFunction(() => !!currentRecSession);
    await wait(5600);   // one audio slice
    await page.evaluate(() => window.__srEmit('ceiling painted white minor marks'));
    await page.evaluate(() => { window.dbPut = () => Promise.reject(new Error('QuotaExceededError')); });
    await page.click('#fabDone');
    await wait(1500);
    const r = await page.evaluate(() => ({ toasts: window.__toasts.slice(), note: state.roomNotes[currentRoomId()], banner: document.getElementById('warnBanner').textContent }));
    check('no "Recording saved" when the save failed', !r.toasts.some(t => /Recording saved/.test(t)), r.toasts);
    check('save failure is shown', r.toasts.some(t => /NOT saved|isn't saving/.test(t)), r.toasts);
    check('phone text kept in the note as a fallback', /AUDIO NOT SAVED/.test(r.note || '') && /ceiling painted white/i.test(r.note || ''), r.note);
    check('warning banner stays up', /out of storage/.test(r.banner), r.banner);
    // photo
    await page.evaluate(() => { window.photoAdd = () => Promise.reject(new Error('QuotaExceededError')); });
    const before = await page.evaluate(() => ((state.serialPhotos[currentRoomId()]) || []).length);
    await page.evaluate(async () => { const f = new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' }); await onSerialPhoto(currentRoomId(), { files: [f], value: '' }); });
    const after = await page.evaluate(() => ({ n: ((state.serialPhotos[currentRoomId()]) || []).length, status: document.getElementById('serialphoto-status-' + currentRoomId()).textContent }));
    check('failed photo shows no "backing up" marker', after.n === before && !/backing up/.test(after.status), after);
    check('no script errors on storage failure', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Item 4: retries ───────────────────────────────────────────────────────
  {
    const page = await newPage(browser);
    let mode = 'offline';
    page.__val = (route) => {
      const u = route.request().url();
      if (u.includes('9ecaffe4')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });   // archive
      if (mode === 'offline') return route.abort('internetdisconnected');
      if (mode === '500') return route.fulfill({ status: 500, body: 'err' });
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"transcript":""}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transcript: 'Ceiling painted white, clean.', words: [] }) });
    };
    await startJob(page);
    const roomId = await page.evaluate(() => currentRoomId());
    // Put one pending recording on the phone directly.
    await page.evaluate(async (rid) => {
      queueRunId++; queueRunning = false;
      const blob = new Blob([new Uint8Array(2000)], { type: 'audio/webm' });
      window.__id = await dbAdd({ roomId: rid, roomName: 'Room', address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: 'ceiling painted white', blob, type: 'audio/webm', status: 'pending', createdAt: Date.now(), attempts: 0 });
    }, roomId);
    const get = () => page.evaluate(async () => (await dbAll()).find(r => r.id === window.__id));
    const run = async () => { await page.evaluate(async () => { const r = (await dbAll()).find(x => x.id === window.__id); if (r.status === 'pending') { delete r.nextTryAt; await dbPut(r); } queueRunning = false; await processQueue(); }); };
    for (let i = 0; i < 7; i++) await run();
    let r = await get();
    check('no-signal blips do not use up tries', r.status === 'pending' && !r.attempts && r.netFails === 7, { s: r.status, a: r.attempts, n: r.netFails });
    check('back-off before the next try', r.nextTryAt > Date.now() + 60000, r.nextTryAt - Date.now());
    const skipped = await page.evaluate(async () => { const r = (await dbAll()).find(x => x.id === window.__id); const n = r.netFails; queueRunning = false; await processQueue(); const r2 = (await dbAll()).find(x => x.id === window.__id); return r2.netFails === n; });
    check('a record waiting out its back-off is not resent', skipped);
    mode = 'empty'; await run(); r = await get();
    check('empty transcript counts as a failure, not done', r.status === 'pending' && r.attempts === 1 && r.lastError === 'empty transcript', { s: r.status, a: r.attempts, e: r.lastError });
    mode = '500'; for (let i = 0; i < 4; i++) await run(); r = await get();
    check('five real failures → failed', r.status === 'failed' && r.attempts === 5, { s: r.status, a: r.attempts });
    check('failed room scheduled to retry by itself', r.autoRetryAt > Date.now());
    let note = await page.evaluate((rid) => state.roomNotes[rid], roomId);
    check('fallback block shown while failed', /NOT TRANSCRIBED/.test(note), note);
    mode = 'ok';
    await page.evaluate(async () => { const r = (await dbAll()).find(x => x.id === window.__id); r.autoRetryAt = Date.now() - 1; await dbPut(r); });
    const moved = await page.evaluate(async () => await autoRetryFailed());
    await page.evaluate(async () => { queueRunning = false; await processQueue(); });
    r = await get();
    note = await page.evaluate((rid) => state.roomNotes[rid], roomId);
    check('auto retry picks the failed room back up', moved && r.status === 'done', { moved, s: r.status });
    check('real transcript replaces the NOT TRANSCRIBED block', !/NOT TRANSCRIBED/.test(note) && /Ceiling painted white/.test(note), note);
    check('no script errors in retries', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Job ids ───────────────────────────────────────────────────────────────
  {
    const page = await newPage(browser);
    await startJob(page, '5 Same St');
    const jobA = await page.evaluate(() => state.jobId);
    await page.evaluate(() => { clearSaved(); state.startedAt = 0; state.roomNotes = {}; });
    await page.goto(BASE);
    await page.evaluate(() => { const o = window.showToast; window.showToast = (m) => { window.__toasts.push(m); o(m); }; });
    await startJob(page, '5 Same St');
    const jobB = await page.evaluate(() => state.jobId);
    const r = await page.evaluate((a) => {
      const rid = currentRoomId();
      applyTranscript({ roomId: rid, roomName: 'Room', address: state.address, jobId: a, subsections: [] }, 'From the earlier job.');
      return { note: state.roomNotes[rid] || '', legacy: sameJob({ address: state.address }) };
    }, jobA);
    check('each job gets its own id', jobA && jobB && jobA !== jobB, { jobA, jobB });
    check('same address, earlier job → not written into this job', !/earlier job/.test(r.note), r.note);
    check('records from older builds still match by address', r.legacy === true);
    await page.close();
  }

  // ── Review + Recordings still render ──────────────────────────────────────
  {
    const page = await newPage(browser);
    await startJob(page);
    await page.evaluate(() => { state.currentRoomIdx = state.rooms.length - 1; renderInspection(); });
    check('last room shows "Review"', (await page.textContent('#btnNextRoom')).trim() === 'Review');
    await page.click('#btnNextRoom');
    await page.waitForSelector('#screenReview.active', { timeout: 3000 }).catch(() => {});
    check('review screen opens', await page.isVisible('#screenReview'));
    await page.evaluate(() => showRecordings());
    await wait(300);
    check('recordings screen opens', await page.isVisible('#screenRecordings'));
    check('no script errors on review/recordings', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ════════ ROUND 7 ════════
  // Setup fields
  {
    const page = await newPage(browser);
    check('bed/bath dropdowns gone', (await page.$$('#propBeds, #propBaths')).length === 0);
    await page.fill('#propAddress', '1 A St'); await page.fill('#propClient', 'C');
    await page.click('#btnStartInspection');
    check('inspector name required', !(await page.isVisible('#screenInspection')) && await page.evaluate(() => window.__toasts.some(t => /your name/.test(t))));
    check('no inspection type picker (PCR / Entry only)', (await page.$$('#inspTypeSelect')).length === 0);
    await page.fill('#propInspector', 'Sam Tester'); await page.click('#btnStartInspection');
    await page.waitForSelector('#screenInspection.active', { timeout: 3000 }).catch(() => {});
    check('starts with no type to choose', await page.isVisible('#screenInspection'));
    const meta = await page.evaluate(() => ({ t: state.inspType, lines: detailLines(state.address, inspectionMeta()).join('|'), beds: state.beds }));
    check('every file says Entry (PCR)', meta.t === 'Entry (PCR)' && /Inspection type: Entry \(PCR\)/.test(meta.lines), meta);
    check('beds counted from room toggles', meta.beds >= 1, meta);
    const hdr = await page.evaluate(() => { const t = document.getElementById('headerTitle'); t.textContent = '14/37 Sample Street, Testing Vale WA 6999'; const r = t.getBoundingClientRect(); return { w: r.width, full: t.scrollWidth <= t.clientWidth + 1, vw: innerWidth }; });
    check('address has its own full-width line, not cut off', hdr.w > hdr.vw * 0.8 && hdr.full, hdr);
    check('name remembered on this phone', await page.evaluate(() => localStorage.getItem('pa_inspector_name') === 'Sam Tester'));
    await page.close();
  }
  // Safari banner
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
    const page = await ctx.newPage();
    await page.route(/web\.val\.run/, r => r.fulfill({ status: 200, body: '{}' }));
    await page.goto(BASE);
    check('Safari tab warning on iPhone', await page.isVisible('#safariBanner'));
    await ctx.close();
    const page2 = await newPage(browser);
    check('no Safari warning elsewhere', !(await page2.isVisible('#safariBanner')));
    await page2.close();
  }
  // Typed only, archive text, file names, key, overwrite, too large, sweep, two-part AI sort, review fold, PCR
  {
    const page = await newPage(browser);
    const calls = [];
    page.__val = (route) => {
      const u = route.request().url(); calls.push(u);
      if (u.includes('9ecaffe4')) {
        if (/huge/.test(decodeURIComponent(u))) return route.fulfill({ status: 413, body: 'too big' });
        const m = decodeURIComponent(u).match(/path=([^&]*)/);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + (m ? m[1].split('/').pop() : '') }) });
      }
      if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transcript: 'Ceiling painted white.', words: [] }) });
    };
    await startJob(page);
    const r1 = await page.evaluate(async () => {
      const rid = state.rooms[1].id;
      state.roomNotes[rid] = 'Typed walls note.';
      let rows = await computeAreaStatus();
      const before = rows.find(r => r.id === rid);
      toggleTypedOnly(rid);
      rows = await computeAreaStatus();
      const after = rows.find(r => r.id === rid);
      return { canTyped: before.canTyped, readyBefore: before.ready, readyAfter: after.ready, label: after.dbx.label };
    });
    check('"Typed only" offered for a typed room', r1.canTyped && !r1.readyBefore, r1);
    check('"Typed only" clears the Finish lock for that room', r1.readyAfter, r1);
    const r2 = await page.evaluate(async () => {
      const rid = currentRoomId();
      const rec = { id: 42, roomId: rid, roomName: 'Front Gardens', address: state.address, jobId: state.jobId, subsections: ['Exterior Walls'], transcript: 'Exterior walls painted white.', words: [], createdAt: Date.now(), type: 'audio/webm', blob: new Blob([new Uint8Array(10)]) };
      let txt = '', err = '';
      try { txt = buildArchiveText(rec, 'Exterior walls painted white.'); } catch (e) { err = String(e); }
      return { base: archiveBaseName(rec), txt: txt.slice(0, 400), err };
    });
    check('Dropbox .txt builds without error (round 6 bug)', !r2.err && /Inspector: Sam Tester/.test(r2.txt), r2);
    check('record number in every file name', /- rec 42$/.test(r2.base), r2.base);
    await page.evaluate(async () => { await archivePut('folder/file.txt', 'x', 'text/plain'); });
    const last = calls[calls.length - 1];
    check('archive calls ask to overwrite and carry the key', /[?&]path=/.test(last) && /mode=overwrite/.test(last) && /[?&]k=/.test(last), last);
    const r3 = await page.evaluate(async () => {
      const rid = currentRoomId();
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      const id = await dbAdd({ roomId: rid, roomName: 'huge', address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: '', blob, type: 'audio/webm', status: 'done', transcript: 'x', createdAt: Date.now() });
      const rec = (await dbAll()).find(r => r.id === id);
      try { await archiveAudio(rec); } catch (e) {}
      await dbPut(rec);
      return { tooLarge: rec.audioTooLarge };
    });
    { const n0 = calls.length; await page.evaluate(async () => { await archivePass(); await archivePass(); }); r3.resent = calls.filter((u, i) => i >= n0 && /huge/.test(decodeURIComponent(u))).length; }
    check('file too large is marked final', r3.tooLarge === true, r3);
    check('too-large file is not re-sent over and over', r3.resent === 0, r3);
    const r4 = await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(70e6)], { type: 'audio/webm' });
      const id = await dbAdd({ roomId: currentRoomId(), roomName: 'Big', address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: 'r', blob, type: 'audio/webm', status: 'pending', createdAt: Date.now(), attempts: 0, audioArchived: true });
      queueRunning = false; await processQueue();
      const rec = (await dbAll()).find(r => r.id === id);
      return { status: rec.status, final: rec.finalError, auto: rec.autoRetryAt };
    });
    check('over 60 MB fails for good, no auto retry', r4.status === 'failed' && /too large/.test(r4.final) && !r4.auto, r4);
    const r5 = await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      const old = await dbAdd({ roomId: 'kitchen', roomName: 'K', address: 'Old job', jobId: 'Jold', blob, type: 'audio/webm', status: 'done', archived: true, audioArchived: true, archivedAt: Date.now() - 15 * 864e5, createdAt: Date.now() - 15 * 864e5 });
      const recent = await dbAdd({ roomId: 'kitchen', roomName: 'K', address: 'Old job', jobId: 'Jold', blob, type: 'audio/webm', status: 'done', archived: true, audioArchived: true, archivedAt: Date.now() - 13 * 864e5, createdAt: Date.now() - 13 * 864e5 });
      const mine = await dbAdd({ roomId: currentRoomId(), roomName: 'R', address: state.address, jobId: state.jobId, blob, type: 'audio/webm', status: 'done', archived: true, createdAt: Date.now() });
      const unsafe = await dbAdd({ roomId: 'kitchen', roomName: 'K', address: 'Old job', jobId: 'Jold', blob, type: 'audio/webm', status: 'pending', createdAt: Date.now() });
      await sweepOldJobs();
      const ids = (await dbAll()).map(r => r.id);
      return { oldGone: !ids.includes(old), recentKept: ids.includes(recent), mineKept: ids.includes(mine), unsafeKept: ids.includes(unsafe) };
    });
    check('old job in Dropbox for over 14 days is cleared off the phone', r5.oldGone, r5);
    check('old job in Dropbox for under 14 days is kept', r5.recentKept, r5);
    check('this job and anything not yet safe are kept', r5.mineKept && r5.unsafeKept, r5);
    const r6 = await page.evaluate(() => {
      const room = state.rooms[0];
      state.roomNotes[room.id] = '';
      const p1 = { roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, subsections: room.subsections, sections: [{ name: 'Exterior Walls', text: 'Exterior walls painted cream.' }, { name: 'Eaves', text: 'Eaves clean.' }], check: [] };
      const p2 = { roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, subsections: room.subsections, sections: [{ name: 'Exterior Walls', text: 'Minor marks to the rear wall.' }, { name: 'Driveway', text: 'Driveway clean.' }], check: [] };
      applyTranscript(p1, ''); applyTranscript(p2, '');
      const b = subareasForRoom(room, state.roomNotes[room.id]);
      return b.map(x => x.subarea + '=' + x.text);
    });
    check('room recorded in two parts keeps the AI sort', r6.length === 3 && r6[0] === 'Exterior Walls=Exterior walls painted cream. Minor marks to the rear wall.', r6);
    // Review fold
    await page.evaluate(() => showReview());
    await wait(300);
    const fold = await page.evaluate(() => { const d = [...document.querySelectorAll('#reviewBody details.review-room')]; return { n: d.length, open: d.filter(x => x.open).length }; });
    check('review rooms start folded', fold.n === (await page.evaluate(() => state.rooms.length)) && fold.open === 0, fold);
    // PCR is gone (round 9)
    const gone = await page.evaluate(() => ({ b: typeof buildPcrDocx, q: typeof queuePcrDocx }));
    check('PCR Word file code removed', gone.b === 'undefined' && gone.q === 'undefined', gone);
    check('no script errors in round 7 checks', page.__errors.length === 0, page.__errors);
    await page.close();
  }


  // ════════ ROUND 8 ════════
  // Saved service links
  {
    const page = await newPage(browser, { storage: {
      pa_transcribe_url_assemblyai: 'https://propertyassist--7e43f138ad2311f186b71607ee4eb77e.web.val.run',
      pa_archive_url: 'https://propertyassist--9ecaffe4859311f181ad1607ee4eb77e.web.val.run',
      pa_transcribe_url_deepgram: 'https://my-own-deepgram.web.val.run'
    } });
    const r = await page.evaluate(() => ({
      a: localStorage.getItem('pa_transcribe_url_assemblyai'), arch: localStorage.getItem('pa_archive_url'),
      dg: localStorage.getItem('pa_transcribe_url_deepgram'), url: TRANSCRIBE_URL, archUrl: ARCHIVE_URL }));
    check('saved copy of a built-in link is dropped at start-up', r.a === null && r.arch === null, r);
    check('the app still uses the built-in links', /7e43f138/.test(r.url) && /9ecaffe4/.test(r.archUrl), r);
    check('a link someone changed is kept', r.dg === 'https://my-own-deepgram.web.val.run', r);
    await startJob(page);
    const after = await page.evaluate(() => ({ a: localStorage.getItem('pa_transcribe_url_assemblyai'), arch: localStorage.getItem('pa_archive_url'), c: localStorage.getItem('pa_cleanup_url') }));
    check('Start no longer saves untouched links', after.a === null && after.arch === null && after.c === null, after);
    const blank = await page.evaluate(() => { saveServiceUrl('pa_archive_url', '', DEFAULT_ARCHIVE_URL); return localStorage.getItem('pa_archive_url'); });
    check('a deliberate blank (off) is still kept', blank === '', blank);
    await page.close();
  }
  // Finish & Clear
  {
    const page = await newPage(browser);
    const confirms = [];
    page.on('dialog', d => { confirms.push(d.message()); d.type() === 'prompt' ? d.dismiss() : d.accept(); });
    page.__val = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/y' }) });
    await startJob(page);
    // Every room accounted for: one with a failed transcript but its audio in Dropbox.
    await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      for (const [i, room] of state.rooms.entries()) {
        await dbAdd({ roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, subsections: [], part: 1, blob, type: 'audio/webm',
          status: i === 0 ? 'failed' : 'done', audioArchived: true, archived: i === 0 ? false : true, autoRetries: 6, createdAt: Date.now() });
      }
      queueRunning = true;   // keep the queue still for this check
    });
    await page.evaluate(() => finishAndClear());
    await wait(500);
    check('no second "hasn\'t backed up" question for a failed room whose audio is in Dropbox', confirms.length === 1 && /Every room is recorded/.test(confirms[0]), confirms);
    check('finished and cleared', await page.isVisible('#screenSetup'));
    await page.close();
  }
  {
    const page = await newPage(browser);
    page.on('dialog', d => d.dismiss());
    page.__val = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    await startJob(page);
    await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      for (const room of state.rooms) state.skippedRooms = Object.assign(state.skippedRooms || {}, { [room.id]: true });
      // A photo not yet sent makes the second question come up.
      await photoAdd({ roomId: state.rooms[0].id, roomName: 'x', address: state.address, jobId: state.jobId, createdAt: Date.now(), blob, type: 'image/jpeg', uploaded: false });
      photoQueueRunning = true;
    });
    await page.evaluate(() => finishAndClear());
    await wait(500);
    const q = await page.evaluate(async () => (await photoAll()).filter(p => p.kind === 'summary' || p.kind === 'pcr').length);
    check('cancelling the finish question sends no details file', q === 0, q);
    check('cancelled finish leaves the inspection open', await page.isVisible('#screenReview') || await page.isVisible('#screenInspection'));
    await page.close();
  }
  // Stale copies
  {
    const page = await newPage(browser);
    let release;
    const gate = new Promise(r => { release = r; });
    page.__val = async (route) => {
      const u = route.request().url();
      if (u.includes('9ecaffe4') && route.request().method() === 'POST') { await gate; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"path":"/x/a.webm"}' }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    };
    await startJob(page);
    const id = await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      return await dbAdd({ roomId: currentRoomId(), roomName: 'R', address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: 'r', blob, type: 'audio/webm', status: 'failed', createdAt: Date.now(), attempts: 5 });
    });
    const pass = page.evaluate(() => archivePass());
    await wait(300);
    // Retry tapped while the Dropbox pass is holding its old copy.
    await page.evaluate(async (id) => { await dbUpdate(id, r => { r.status = 'pending'; r.attempts = 0; }); }, id);
    release();
    await pass;
    const rec = await page.evaluate(async (id) => (await dbAll()).find(r => r.id === id), id);
    check('Dropbox pass no longer puts back an old status over a Retry', rec.status === 'pending', rec.status);
    check('the audio upload it finished is still recorded', rec.audioArchived === true, rec.audioArchived);
    await page.close();
  }
  // Area status only drawn on the review screen
  {
    const page = await newPage(browser);
    await startJob(page);
    const n = await page.evaluate(async () => {
      let c = 0; const o = computeAreaStatus; window.computeAreaStatus = async () => { c++; return o(); };
      for (let i = 0; i < 5; i++) await updatePendingUI();
      await new Promise(r => setTimeout(r, 200));
      return c;
    });
    check('area status not rebuilt on every save while inspecting', n === 0, n);
    await page.evaluate(() => showReview()); await wait(300);
    const m = await page.evaluate(async () => { let c = 0; const o = computeAreaStatus; window.computeAreaStatus = async () => { c++; return o(); }; await updatePendingUI(); await new Promise(r => setTimeout(r, 200)); return c; });
    check('area status refreshes once per update on the review screen', m === 1, m);
    check('RCD now checked with the mandatory items', await page.evaluate(() => checkMandatory().includes('RCD Box')));
    await page.close();
  }
  // UI
  {
    const page = await newPage(browser);
    const ui = await page.evaluate(() => {
      const sel = document.querySelector('#roomsSelect .room-toggle.selected');
      return { bg: getComputedStyle(sel).backgroundColor, tick: getComputedStyle(sel, '::before').content, hero: document.querySelector('.setup-hero h1').textContent };
    });
    check('selected rooms show a tick and are never yellow', ui.bg !== 'rgb(255, 222, 0)' && /✓/.test(ui.tick), ui);
    check('setup says Start Inspection (round 13)', /Start\s*Inspection/.test(ui.hero), ui.hero);
    await startJob(page);
    const toast = await page.evaluate(() => { showToast('x'); const t = document.getElementById('toast').getBoundingClientRect(); const d = document.querySelector('.rec-dock').getBoundingClientRect(); return { above: t.bottom <= d.top + 1, gap: d.top - t.bottom }; });
    await wait(300);
    const toast2 = await page.evaluate(() => { const t = document.getElementById('toast').getBoundingClientRect(); const d = document.querySelector('.rec-dock').getBoundingClientRect(); return { above: t.bottom <= d.top + 1, gap: Math.round(d.top - t.bottom) }; });
    check('toast sits just above the record dock', toast2.above && toast2.gap < 40, toast2);
    await page.evaluate(async () => { const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' }); await dbAdd({ roomId: currentRoomId(), roomName: 'R', address: state.address, jobId: state.jobId, blob, type: 'audio/webm', status: 'pending', createdAt: Date.now() }); showRecordings(); });
    await wait(400);
    check('Recordings uses plain words', /Waiting to send/.test(await page.textContent('#recordingsBody')));
    const icon = await page.evaluate(async () => [(await fetch('icon-192.png')).status, (await fetch('icon-512.png')).status, (await fetch('apple-touch-icon.png')).status, document.querySelector('link[rel=apple-touch-icon]').getAttribute('href')]);
    check('Home Screen icons present (192, 512, iPhone 180)', icon[0] === 200 && icon[1] === 200 && icon[2] === 200 && icon[3] === 'apple-touch-icon.png', icon);
    const logo = await page.evaluate(() => { const i = document.querySelector('.header-logo img'); return i ? { ok: i.complete && i.naturalWidth > 0, h: Math.round(i.getBoundingClientRect().height), alt: i.alt } : null; });
    check('PA house tile in the header', logo && logo.ok && logo.h === 34 && logo.alt === 'Property Assist', logo);
    check('PROPERTY ASSIST lettering beside it', await page.evaluate(() => document.querySelector('.header-logo .brand-word').textContent === 'PROPERTY ASSIST'));
    // Audio backup from the review page
    const bk = await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/mp4' });
      await dbAdd({ roomId: currentRoomId(), roomName: 'Kitchen', address: state.address, jobId: state.jobId, blob, type: 'audio/mp4', status: 'done', archived: true, part: 1, createdAt: new Date(2026, 9, 7, 10, 47).getTime() });
      await dbAdd({ roomId: 'x', roomName: 'Other job', address: 'Elsewhere', jobId: 'Jother', blob, type: 'audio/mp4', status: 'done', createdAt: Date.now() });
      let shared = null;
      navigator.canShare = () => true;
      navigator.share = async (d) => { shared = d; };
      showReview();
      const btn = [...document.querySelectorAll('#screenReview button')].find(b => /Save the audio/.test(b.textContent));
      btn.click();
      await new Promise(r => setTimeout(r, 300));
      return { btn: !!btn, names: shared ? shared.files.map(f => f.name) : null, text: shared && shared.text };
    });
    check('review backup button saves audio', bk.btn && bk.names && bk.names.length === 2 && bk.names.every(n => /\.(m4a|webm)$/.test(n)), bk);
    check('backup is this job only, named like Dropbox', bk.names && bk.names.some(n => /^1 Test St - Kitchen - 1047 - rec \d+\.m4a$/.test(n)) && !bk.names.some(n => /Elsewhere/.test(n)), bk.names);
    check('backup sends no text report', !bk.text, bk.text);
    check('review has no long hint paragraph and no PCR', (await page.$$('#reviewBody .review-hint')).length === 0 && !/PCR Word/.test(await page.textContent('#reviewBody')));
    check('no script errors in round 8 checks', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ════════ ROUND 9 ════════
  {
    const page = await newPage(browser);
    const puts = [];
    page.__val = async (route) => {
      const req = route.request(); const u = req.url();
      if (u.includes('9ecaffe4')) {
        const m = decodeURIComponent(u).match(/path=([^&]*)/);
        puts.push({ path: m ? m[1] : '', type: req.headers()['content-type'], body: req.postDataBuffer() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + (m ? m[1].split('/').pop() : '') }) });
      }
      if (u.includes('a1d7b510') && req.method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'claude-sonnet-5-5',
          sections: [
            { name: 'Ceiling', text: 'Ceiling painted white {+in clean condition+}.' },
            { name: 'Walls', text: 'Walls painted grey, scuff marks near the door. Walls beside light fittings green.' },
            { name: 'Light fittings', text: 'Light fittings, two silver metal downlights {+secured and functional+}.' }
          ],
          check: [{ quote: 'Walls beside light fittings green.', heard: 'walls beside light fittings green', why: 'does not make sense' }] }) });
      }
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    };
    await startJob(page);
    const words = [];
    const say = (t, at) => t.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean).forEach((w, i) => words.push({ w, s: at + i * 0.4 }));
    say('ceiling painted white', 0); say('walls painted grey scuff marks near the door', 6); say('walls beside light fittings green', 31); say('light fittings two similar downlights', 40);
    const r = await page.evaluate(async (words) => {
      const rec = { id: 77, roomId: currentRoomId(), roomName: 'Bedroom 1', address: state.address, jobId: state.jobId,
        subsections: ['Ceiling', 'Walls', 'Light fittings'], transcript: 'Ceiling painted white walls painted grey scuff marks near the door walls beside light fittings green light fittings two similar downlights',
        words, createdAt: Date.now(), type: 'audio/webm', blob: new Blob([new Uint8Array(10)]), engine: 'assemblyai', status: 'done' };
      cleanupReady = true;
      await runCleanup(rec);
      const clean = rec.transcript;
      const txt = buildArchiveText(rec, clean);
      await archiveToDropbox(rec);
      // Nothing lost by the sentence splitter, even with a stray bracket.
      const sample = 'One [odd bracket here. Walls grey [added: in clean condition]. Model Numbers: AOT18LVCC no stop';
      const joined = timedSentences(sample, null).map(x => x.sentence).join(' ');
      return { sections: rec.sections, check: rec.check, txt, joined, sample, docxOk: rec.docxArchived, docxErr: rec.docxError || '' };
    }, words);
    check('added phrase becomes [added: …]', r.sections[0].text === 'Ceiling painted white [added: in clean condition].', r.sections[0]);
    check('check quote carries no braces and has its time', r.check[0].quote === 'Walls beside light fittings green.' && r.check[0].clock === '0:31', r.check);
    check('.txt has the section index in spoken order', /SECTIONS IN THE AUDIO\n  Ceiling — 0:00\n  Walls — 0:06\n  Light fittings — 0:40/.test(r.txt), r.txt.slice(0, 900));
    check('.txt marks the flagged sentence only', />>CHECK<< \[0:31\] Walls beside light fittings green\./.test(r.txt) && (r.txt.match(/>>CHECK<< \[/g) || []).length === 1, r.txt);
    check('.txt subarea headings show where they start', /WALLS  \(starts 0:06\)/.test(r.txt), r.txt);
    check('.txt keeps [added: secured and functional]', /\[added: secured and functional\]/.test(r.txt));
    check('sentence splitter loses nothing', r.joined.replace(/\s+/g, ' ') === r.sample.replace(/\s+/g, ' '), r);
    // Round 12: no Word file per room. The job's one Word file goes up once the room lands.
    await page.evaluate(() => { markJobDoc(archiveFolderName({ address: state.address, meta: inspectionMeta(), createdAt: Date.now() }), jobSnapshot()); return jobDocPass(); });
    await wait(300);
    check('no Word file per room any more', !puts.some(p => /rec 77\.docx$/.test(p.path)), puts.map(p => p.path));
    const dx = puts.find(p => /\/1 Test St - Inspection\.docx$/.test(p.path));
    const tx = puts.find(p => /\.txt$/.test(p.path));
    check('.txt and .json go in App data, audio in Audio', tx && /\/App data\//.test(tx.path) && puts.some(p => /\/App data\/.*\.json$/.test(p.path)) && puts.some(p => /\/Audio\/.*\.webm$/.test(p.path)), puts.map(p => p.path));
    check('job Word file sent as docx type, at the top of the job folder', dx && /wordprocessingml/.test(dx.type) && dx.path.split('/').length === 2, dx && [dx.path, dx.type]);
    if (dx) require('fs').writeFileSync(__dirname + '/private/room-test.docx', dx.body);
    const fin = await page.evaluate(async () => {
      for (const room of state.rooms) state.skippedRooms = Object.assign(state.skippedRooms || {}, { [room.id]: true });
      window.confirm = () => true;
      await finishAndClear();
      await new Promise(r => setTimeout(r, 400));
      return (await photoAll()).map(p => p.kind || 'photo');
    });
    check('Finish sends no PCR', !fin.includes('pcr'), fin);
    const sw = require('fs').readFileSync(__dirname + '/../sw.js', 'utf8');
    check('service worker v25 (updated R21), no PCR template', /pa-inspect-v25/.test(sw) && !/pcr-template/.test(sw));
    check('no script errors in round 9 checks', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ════════ ROUND 10 ════════
  // Finish: rooms still sending don't hold it, and nothing is deleted.
  {
    const page = await newPage(browser);
    const asked = [];
    page.on('dialog', d => { asked.push(d.type() + ': ' + d.message()); d.accept(); });
    await startJob(page);
    const r = await page.evaluate(async () => {
      queueRunning = true; archiveRunning = true;   // keep the queues still for this check
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      const ids = [];
      for (const [i, room] of state.rooms.entries()) {
        ids.push(await dbAdd({ roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, subsections: [], part: 1, blob, type: 'audio/webm',
          status: i === 0 ? 'pending' : 'done', audioArchived: i !== 0, archived: i !== 0, archivedAt: Date.now(), createdAt: Date.now() }));
      }
      const rows = await computeAreaStatus();
      showReview();
      await new Promise(r => setTimeout(r, 300));
      const btn = document.getElementById('btnFinish');
      const gate = { locked: btn.classList.contains('locked'), label: btn.textContent, status: document.getElementById('finishStatus').className, text: document.getElementById('finishStatus').textContent };
      const jobId = state.jobId;
      await finishAndClear();
      await new Promise(r => setTimeout(r, 300));
      const after = await dbAll();
      return { sending: rows.filter(x => x.sending).length, blocking: rows.filter(x => !x.ready && !x.sending).length, gate,
        kept: ids.every(id => after.some(x => x.id === id)), closed: after.filter(x => x.jobId === jobId).every(x => x.closed === true),
        onStart: document.getElementById('screenSetup').classList.contains('active'), toasts: window.__toasts.slice(-1)[0],
        card: getComputedStyle(document.getElementById('syncCard')).display, cardText: document.getElementById('syncCardTitle').textContent };
    });
    check('a room still sending is "sending", not blocking', r.sending === 1 && r.blocking === 0, r);
    check('Finish is not locked while audio is still sending', !r.gate.locked && r.gate.label === 'Finish inspection', r.gate);
    check('review says which rooms are still sending and that you can finish', r.gate.status === 'finish-status sending' && /still sending/.test(r.gate.text) && /You can finish now/.test(r.gate.text), r.gate);
    check('one question only, and it says what is still sending (R20: after any mandatory items still needed)', asked.length === 1 && /^confirm: (?:Mandatory items still needed: [^\n]+\n\n)?1 recording still sending to Dropbox/.test(asked[0]), asked);
    check('Finish deletes nothing from the phone', r.kept, r);
    check('every recording of the finished job is marked closed', r.closed, r);
    check('back on the Start screen after Finish', r.onStart);
    check('finish toast says what is still sending', /still sending/.test(r.toasts), r.toasts);
    check('Start screen shows what is still sending', r.card !== 'none' && r.cardText === '1 recording sending', r);
    check('no em dash in the new Finish words', !/—/.test(r.gate.text + asked.join('') + r.toasts));
    check('no script errors in round 10 finish checks', page.__errors.length === 0, page.__errors);
    await page.close();
  }
  // A room with nothing recorded still holds Finish.
  {
    const page = await newPage(browser);
    const asked = [];
    page.on('dialog', d => { asked.push(d.type()); d.dismiss(); });
    await startJob(page);
    const r = await page.evaluate(async () => {
      showReview(); await new Promise(r => setTimeout(r, 300));
      const btn = document.getElementById('btnFinish');
      const locked = btn.classList.contains('locked');
      await finishAndClear();
      return { locked, label: btn.textContent, still: document.getElementById('screenReview').classList.contains('active') };
    });
    check('a room with no audio still locks Finish', r.locked && /^Finish: \d+ rooms? to go$/.test(r.label), r);
    check('and asks for the manager FINISH word', asked[0] === 'prompt' && r.still, { asked, r });
    await page.close();
  }
  // Start screen card hides when nothing is waiting.
  {
    const page = await newPage(browser);
    const r = await page.evaluate(async () => {
      await updatePendingUI();
      const hidden = getComputedStyle(document.getElementById('syncCard')).display === 'none';
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      await dbAdd({ roomId: 'k', roomName: 'K', address: 'Old job', jobId: 'Jold', blob, type: 'audio/webm', status: 'done', archived: true, audioArchived: true, archivedAt: Date.now(), createdAt: Date.now() });
      await updatePendingUI();
      const stillHidden = getComputedStyle(document.getElementById('syncCard')).display === 'none';
      await dbAdd({ roomId: 'b', roomName: 'B', address: 'Old job', jobId: 'Jold', blob, type: 'audio/webm', status: 'pending', createdAt: Date.now() });
      await updatePendingUI();
      return { hidden, stillHidden, shown: getComputedStyle(document.getElementById('syncCard')).display !== 'none', title: document.getElementById('syncCardTitle').textContent };
    });
    check('Start screen card hidden with nothing waiting', r.hidden && r.stillHidden, r);
    check('Start screen card shows a recording waiting to send', r.shown && r.title === '1 recording sending', r);
    await page.close();
  }
  // Fix a word on the review page, the room .json, and the files sent again.
  {
    const page = await newPage(browser);
    const puts = [];
    page.__val = async (route) => {
      const req = route.request(); const u = req.url();
      if (u.includes('9ecaffe4')) {
        const m = decodeURIComponent(u).match(/path=([^&]*)/);
        puts.push({ path: m ? m[1] : '', type: req.headers()['content-type'], body: req.postDataBuffer() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + (m ? m[1].split('/').pop() : '') }) });
      }
      if (u.includes('a1d7b510') && req.method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'claude-sonnet-5-5',
          sections: [
            { name: 'Ceiling', text: 'Ceiling painted white {+in clean condition+}.' },
            { name: 'Walls', text: 'Walls painted grey, scuff marks near the door. Ensuite pigeon has light discolouration.' },
            { name: 'Light fittings', text: 'Two silver metal downlights {+secured and functional+}.' }
          ],
          check: [
            { quote: 'Ensuite pigeon has light discolouration.', heard: 'ensuite pigeon', why: 'might be grout' },
            { quote: 'Two silver metal downlights.', heard: 'two silver metal downlights', why: 'check the word' }
          ] }) });
      }
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    };
    await startJob(page);
    const words = [];
    const say = (t, at) => t.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean).forEach((w, i) => words.push({ w, s: at + i * 0.4 }));
    say('ceiling painted white', 0); say('walls painted grey scuff marks near the door', 6); say('ensuite pigeon has light discolouration', 31); say('two silver metal downlights', 40);
    const r1 = await page.evaluate(async (words) => {
      queueRunning = true;
      const room = state.rooms[0];
      const id = await dbAdd({ roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, meta: inspectionMeta(),
        subsections: ['Ceiling', 'Walls', 'Light fittings'], transcript: 'Ceiling painted white walls painted grey scuff marks near the door ensuite pigeon has light discolouration two silver metal downlights',
        words, createdAt: Date.now(), type: 'audio/webm', blob: new Blob([new Uint8Array(10)], { type: 'audio/webm' }), engine: 'assemblyai', status: 'uploading', audioArchived: true });
      const rec = (await dbAll()).find(x => x.id === id);
      cleanupReady = true;
      await runCleanup(rec);
      await archiveToDropbox(rec); rec.archived = true; rec.archivedAt = Date.now(); rec.status = 'done';
      await dbPut(rec);
      applyTranscript(rec, rec.transcript);
      return { id, checks: state.roomChecks[room.id] };
    }, words);
    check('checks on the review page remember their recording', r1.checks.length === 2 && r1.checks.every(c => c.recId === r1.id), r1.checks);
    const js = puts.find(p => /\.json$/.test(p.path));
    const tx = puts.find(p => /\.txt$/.test(p.path));
    check('a .json goes beside the .txt with the same name', js && tx && js.path.replace(/\.json$/, '') === tx.path.replace(/\.txt$/, ''), puts.map(p => p.path));
    check('.json sent as JSON', js && /application\/json/.test(js.type), js && js.type);
    let j = null; try { j = JSON.parse(js.body.toString('utf8')); } catch (e) {}
    check('.json reads back', j && j.format === 'pa-room' && j.version === 1, j && j.format);
    check('.json has the job details', j && j.property === '1 Test St' && j.client === 'Test Client' && j.inspector === 'Sam Tester' && j.room === 'Front Gardens', j && { p: j.property, c: j.client, i: j.inspector, r: j.room });
    check('.json has subareas with timed sentences', j && j.sections.length === 3 && j.sections[1].name === 'Walls' && j.sections[1].clock === '0:06' && j.sections[1].sentences.some(s => s.check && s.clock === '0:31'), j && j.sections[1]);
    check('.json keeps added phrases apart', j && j.sections[0].sentences[0].added[0] === 'in clean condition' && j.sections[0].sentences[0].plain === 'Ceiling painted white.', j && j.sections[0].sentences[0]);
    check('.json has the check list, word timings and the raw text', j && j.check.length === 2 && j.check[0].clock === '0:31' && j.words.length === words.length && Array.isArray(j.words[0]) && /pigeon/.test(j.raw), j && { c: j.check, w: j.words.length });
    check('.json names its audio, text and Word files', j && /\.webm$/.test(j.audioFile) && /\.txt$/.test(j.textFile) && /\.docx$/.test(j.wordFile), j && [j.audioFile, j.textFile, j.wordFile]);

    // Review page: Fix a word buttons.
    await page.evaluate(() => { showReview(); document.querySelector('details.review-room.fold').open = true; });
    await wait(300);
    const btns = await page.$$eval('.rc-fix', b => b.length);
    check('each sentence to check has a Fix a word button', btns === 2, btns);
    await page.click('.rc-fix');
    await wait(700);
    const sheet = await page.evaluate(() => {
      const s = document.getElementById('fixSheet'); const r = s.getBoundingClientRect();
      return { open: s.classList.contains('open'), inView: r.bottom <= innerHeight + 1 && r.top >= 0, quote: document.getElementById('fixQuote').textContent,
        heard: document.getElementById('fixHeard').textContent, text: document.getElementById('fixText').value, sub: document.getElementById('fixSub').textContent };
    });
    check('Fix a word opens as a bottom sheet in view', sheet.open && sheet.inView, sheet);
    check('sheet shows the sentence, what was heard and the time', sheet.quote === 'Ensuite pigeon has light discolouration.' && /ensuite pigeon/.test(sheet.heard) && /0:31/.test(sheet.sub), sheet);
    const play = await page.evaluate(async () => { await playFixClip(); return document.getElementById('fixPlay').textContent; });
    check('Hear what I said finds the room audio on the phone', !/No audio/.test(play), play);
    await page.fill('#fixText', 'Ensuite grout has light discolouration.');
    puts.length = 0;
    await page.evaluate(() => saveFix(false));
    await wait(800);
    const r2 = await page.evaluate(async (id) => {
      const room = state.rooms[0];
      const rec = (await dbAll()).find(x => x.id === id);
      return { note: state.roomNotes[room.id], sections: JSON.stringify(state.roomSections[room.id]), check: state.roomChecks[room.id][0],
        recSections: JSON.stringify(rec.sections), recCheck: rec.check[0], fixes: rec.fixes, archived: rec.archived,
        sheetOpen: document.getElementById('fixSheet').classList.contains('open'),
        row: document.querySelector('.review-check-row').textContent, left: document.querySelectorAll('.rc-fix').length };
    }, r1.id);
    check('fix changes the room note', /Ensuite grout has light discolouration\./.test(r2.note) && !/pigeon/.test(r2.note), r2.note);
    check('fix changes the sorted subareas', /grout has/.test(r2.sections) && !/pigeon/.test(r2.sections), r2.sections);
    check('check marked fixed with the new words', r2.check.resolved === 'fixed' && r2.check.fixedTo === 'Ensuite grout has light discolouration.', r2.check);
    check('recording carries the fix', /grout has/.test(r2.recSections) && r2.recCheck.resolved === 'fixed', r2);
    check('fix kept on the recording for the phrase list', r2.fixes && r2.fixes.length === 1 && r2.fixes[0].heard === 'ensuite pigeon' && r2.fixes[0].to === 'Ensuite grout has light discolouration.' && r2.fixes[0].by === 'inspector', r2.fixes);
    check('sheet closes and the row says what changed', !r2.sheetOpen && /Changed to “Ensuite grout has light discolouration\.”/.test(r2.row) && r2.left === 1, r2);
    // The room's files went to Dropbox again by themselves (signal on).
    const tx2 = puts.find(p => /\.txt$/.test(p.path)); const js2 = puts.find(p => /\.json$/.test(p.path)); const dx2 = puts.find(p => /\.docx$/.test(p.path));
    const t2 = tx2 ? tx2.body.toString('utf8') : '';
    check('fixed room sends .txt, .json and the job Word file again by itself (audio not sent twice)', tx2 && js2 && dx2 && / - Inspection\.docx$/.test(dx2.path) && !puts.some(p => /\.webm$/.test(p.path)), puts.map(p => p.path));
    check('.txt lists it under ALREADY CHECKED BY THE INSPECTOR', /ALREADY CHECKED BY THE INSPECTOR \(1\)\n  \[0:31\] "Ensuite pigeon has light discolouration\." changed to "Ensuite grout has light discolouration\."/.test(t2), t2.slice(0, 1400));
    check('.txt still asks for the other one, and only that', /CHECK THESE AGAINST THE AUDIO \(1\)/.test(t2) && (t2.match(/>>CHECK<< \[/g) || []).length === 1 && />>CHECK<< \[0:40\] Two silver metal downlights/.test(t2), t2);
    check('.txt body has the fixed sentence', /Ensuite grout has light discolouration\./.test(t2.split('BY SUBAREA')[1] || ''), t2);
    const j2 = js2 ? JSON.parse(js2.body.toString('utf8')) : null;
    check('.json shows the fix', j2 && j2.check[0].resolved === 'fixed' && j2.fixes.length === 1, j2 && j2.check);
    const recAfter = await page.evaluate(async (id) => (await dbAll()).find(x => x.id === id), r1.id);
    check('room back to saved in Dropbox after sending again', recAfter.archived === true && recAfter.archivedAt > 0, recAfter.archived);
    // Keep as is.
    await page.evaluate(() => { document.querySelector('details.review-room.fold').open = true; });
    await page.click('.rc-fix');
    await wait(400);
    await page.evaluate(() => saveFix(true));
    await wait(200);
    const r3 = await page.evaluate(() => ({ c: state.roomChecks[state.rooms[0].id][1], left: document.querySelectorAll('.rc-fix').length, title: document.querySelector('.review-check-title').textContent, note: state.roomNotes[state.rooms[0].id] }));
    check('Keep as is marks it checked and changes nothing', r3.c.resolved === 'kept' && !r3.c.fixedTo && /Two silver metal downlights/.test(r3.note), r3);
    check('room says All checked once both are done', r3.left === 0 && /All checked/.test(r3.title), r3);
    const word = await page.evaluate(async (id) => {
      const rec = (await dbAll()).find(x => x.id === id);
      const xml = buildRoomDocxXml(rec, roomLayout(rec, rec.transcript));
      return { kept: rec.check[1].resolved, xml };
    }, r1.id);
    check('Word file lists the settled ones, not in red', /ALREADY CHECKED BY THE INSPECTOR \(2\)/.test(word.xml) && /Nothing left to check in this room/.test(word.xml), word.kept);
    check('no script errors in Fix a word checks', page.__errors.length === 0, page.__errors);
    await page.close();
  }
  // Polish: no emoji anywhere the inspector looks.
  {
    const page = await newPage(browser);
    const EMOJI = /[←-⇿⌀-⏿①-➿⤀-⯿■-◿️＋]|[\u{1F000}-\u{1FAFF}]/u;
    const seen = {};
    const look = async (name) => { seen[name] = await page.evaluate(() => document.body.innerText); };
    await page.evaluate(async () => { const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' }); await dbAdd({ roomId: 'k', roomName: 'K', address: 'Old', jobId: 'Jold', blob, type: 'audio/webm', status: 'pending', createdAt: Date.now() }); await updatePendingUI(); });
    await look('start');
    await startJob(page);
    await page.evaluate(() => {
      const room = state.rooms[0];
      applyTranscript({ id: 5, roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, subsections: room.subsections,
        sections: [{ name: 'Walls', text: 'Walls clean.' }], check: [{ quote: 'Walls clean.', heard: 'walls clean', why: 'x', clock: '0:02', at: 2 }] }, '');
      toggleRoomTools(); setFabRecording(true); showToast('✓ Recording saved');
    });
    await look('room');
    await page.evaluate(() => { setFabRecording(false); setFabPaused(true); setFabError(); });
    await look('room2');
    await page.evaluate(() => showReview());
    await wait(400);
    await look('reviewFolded');
    await page.evaluate(() => document.querySelectorAll('#reviewBody details').forEach(d => d.open = true));
    await look('review');
    await page.evaluate(() => openFixSheet(state.rooms[0].id, 0));
    await wait(300);
    await look('fix');
    await page.evaluate(() => { closeFixSheet(); showRecordings(); });
    await wait(400);
    await look('recordings');
    const bad = Object.entries(seen).filter(([k, t]) => EMOJI.test(t)).map(([k, t]) => k + ': ' + (t.match(new RegExp(EMOJI.source, 'gu')) || []).join(''));
    check('no emoji on Start, room, review, Fix a word or Recordings', bad.length === 0, bad);
    check('icons are drawn as SVG', await page.evaluate(() => document.querySelectorAll('svg.ico').length > 5));
    const words = (seen.reviewFolded.match(/\S+/g) || []).length;
    check('review page reads short as it opens (under 205 words for 15 rooms; R21 adds the Discard link)', words < 205, words);
    check('no script errors in polish checks', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // The look: light and dark follow the phone, yellow kept to its jobs.
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, colorScheme: scheme, permissions: ['microphone'] });
    await ctx.addInitScript(INIT);
    // Dark is chosen in Admin settings; light is the default.
    await ctx.addInitScript((t) => { try { localStorage.setItem('pa_theme', t); } catch (e) {} }, scheme);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route(VAL, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.goto(BASE);
    const r = await page.evaluate(() => {
      const cs = (sel, p) => getComputedStyle(document.querySelector(sel), p);
      return { bg: getComputedStyle(document.documentElement).backgroundColor, ink: getComputedStyle(document.body).color,
        primary: cs('#btnStartInspection').backgroundImage, header: cs('.header').backdropFilter || cs('.header').webkitBackdropFilter,
        card: cs('.setup-form').backdropFilter, recLabel: document.querySelector('.recordings-link').textContent.trim(),
        h1: cs('.setup-hero h1').fontSize, wide: document.documentElement.scrollWidth <= innerWidth };
    });
    const want = scheme === 'dark' ? { bg: 'rgb(15, 16, 18)', ink: 'rgb(243, 243, 241)' } : { bg: 'rgb(236, 236, 234)', ink: 'rgb(43, 45, 49)' };
    check(`${scheme}: background and text are the approved colours`, r.bg === want.bg && r.ink === want.ink, r);
    check(`${scheme}: main button is the yellow gradient`, /linear-gradient/.test(r.primary) && /255, 222, 0/.test(r.primary), r.primary);
    check(`${scheme}: top bar is frosted, cards are not`, /blur\(24px\)/.test(r.header) && (!r.card || r.card === 'none'), r);
    check(`${scheme}: header button says Recordings`, /^Recordings/.test(r.recLabel) && !/☁/.test(r.recLabel), r.recLabel);
    check(`${scheme}: big heading and no sideways scroll`, r.h1 === '40px' && r.wide, r);
    await page.fill('#propAddress', '1 Test St'); await page.fill('#propClient', 'C'); await page.fill('#propInspector', 'B');
    await page.click('#btnStartInspection');
    await page.waitForSelector('#screenInspection.active');
    await wait(700);
    const rec = await page.evaluate(async () => {
      const fab = document.getElementById('fabRecord');
      const idle = getComputedStyle(fab).backgroundImage;
      setFabRecording(true);
      await new Promise(r => setTimeout(r, 400));   // let the colour change finish
      const on = getComputedStyle(fab).backgroundColor;
      const ring = getComputedStyle(fab, '::after').animationName;
      setFabRecording(false);
      const d = document.querySelector('.rec-dock').getBoundingClientRect();
      return { idleYellow: /255, 222, 0/.test(idle), onRed: on === 'rgb(217, 48, 37)', ring, dockInView: d.bottom <= innerHeight && d.left >= 0 && d.right <= innerWidth };
    });
    check(`${scheme}: record button turns red with a breathing ring while recording (round 12)`, !rec.idleYellow && rec.onRed && rec.ring === 'recBreathe', rec);
    check(`${scheme}: floating dock sits inside the screen`, rec.dockInView, rec);
    check(`${scheme}: no script errors`, errs.length === 0, errs);
    await ctx.close();
  }
  // Light by default, whatever the phone is set to.
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, colorScheme: 'dark' });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await page.route(VAL, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.goto(BASE);
    const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    const meta = () => page.evaluate(() => document.getElementById('metaTheme').content);
    const d = { bg: await bg(), meta: await meta(), theme: await page.evaluate(() => document.documentElement.dataset.theme),
      sel: await page.evaluate(() => document.querySelector('#themeSelect .selected').textContent) };
    check('phone in dark mode, app still opens light', d.bg === 'rgb(236, 236, 234)' && d.meta === '#ECECEA' && d.theme === 'light' && d.sel === 'Light', d);
    await page.evaluate(() => openSettings()); await wait(600);
    await page.click('#themeSelect [data-theme-choice="dark"]');
    const dk = { bg: await bg(), meta: await meta() };
    check('Admin settings > Appearance > Dark turns it dark', dk.bg === 'rgb(15, 16, 18)' && dk.meta === '#0F1012', dk);
    await page.reload();
    check('Dark is remembered after reopening', await bg() === 'rgb(15, 16, 18)');
    await page.evaluate(() => setTheme('auto'));
    check('Match phone follows the phone (dark here)', await bg() === 'rgb(15, 16, 18)');
    await page.emulateMedia({ colorScheme: 'light' });
    await wait(100);
    check('Match phone switches when the phone does', await bg() === 'rgb(236, 236, 234)');
    await page.evaluate(() => setTheme('light'));
    await page.emulateMedia({ colorScheme: 'dark' });
    check('back to Light stays light', await bg() === 'rgb(236, 236, 234)');
    await ctx.close();
  }
  // Reduce Motion switches the movement off.
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await page.route(VAL, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.goto(BASE);
    const a = await page.evaluate(() => getComputedStyle(document.querySelector('#screenSetup > .setup-form')).animationName);
    check('Reduce Motion: screens don\'t move', a === 'none', a);
    await ctx.close();
  }

  // ── Round 11 ──────────────────────────────────────────────────────────────
  {
    const ARCH = '9ecaffe4859311f181ad1607ee4eb77e', TRANS = '7e43f138ad2311f186b71607ee4eb77e';
    const log = [];
    let audioMode = 'ok', transMode = [];
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
      if (u.includes(ARCH)) {
        const path = decodeURIComponent((u.match(/path=([^&]*)/) || [])[1] || '');
        log.push(path);
        if (/\.(webm|m4a)$/.test(path)) {
          if (audioMode === 'slowfail') { await wait(400); return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }); }
          if (audioMode === 'fail') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"x"}' });
          if (audioMode === 'slowok') { await wait(400); }
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + path.split('/').pop() }) });
      }
      if (u.includes(TRANS)) {
        const ct = req.headers()['content-type'] || '';
        log.push('T:' + (ct.includes('json') ? req.postData() : 'audio'));
        const next = transMode.shift() || 'ok';
        if (next === '504') return route.fulfill({ status: 504, contentType: 'application/json', body: '{"error":"still running","id":"job_abc123","retry":true}' });
        if (next === '400') return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"JSON body needs a url field"}' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"transcript":"Walls painted white.","engine":"assemblyai","words":[]}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });
    await startJob(page, '11 Round St');
    const base = `({ roomId: currentRoomId(), roomName: 'Kitchen', address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: '', type: 'audio/webm', createdAt: Date.now(), attempts: 0 })`;

    // 1. The database reconnects after iOS closes it.
    const db1 = await page.evaluate(async () => {
      await dbAll(); audioDB.close();
      const id = await dbAdd({ roomId: 'x', status: 'done', blob: null, createdAt: Date.now() });
      const ok = (await dbAll()).some(r => r.id === id);
      await dbDelete(id);
      return ok;
    });
    check('R11: phone database reopens by itself after it was closed', db1 === true);

    // 2. A room isn't "in Dropbox" while its audio upload (already running) fails.
    audioMode = 'slowfail';
    const a2 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), status: 'done', transcript: 'Walls painted white.' });
      rec.id = await dbAdd(rec);
      const c1 = Object.assign({}, rec), c2 = Object.assign({}, rec);
      const p1 = archiveAudio(c1).then(() => 'up', () => 'failed');
      await new Promise(r => setTimeout(r, 50));
      const p2 = archiveToDropbox(c2).then(() => 'archived', () => 'threw');
      const out = { first: await p1, second: await p2 };
      await dbDelete(rec.id);
      return out;
    }, base);
    check('R11: room not marked in Dropbox when the audio upload it waited on failed', a2.second === 'threw' && a2.first === 'failed', a2);
    check('R11: no text file written before the audio is up', !log.some(p => /Kitchen.*\.txt$/.test(p)), log.slice(-5));

    // 3. Back-off: a failed upload waits instead of going again at once.
    audioMode = 'fail'; log.length = 0;
    const a3 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), status: 'done', transcript: 'Walls painted white.' });
      rec.id = await dbAdd(rec);
      await archivePass(); await archivePass(); await archivePass();
      const r = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { fails: r.archFails, waits: r.archNextAt - Date.now(), archived: r.archived };
    }, base);
    const audioPosts = log.filter(p => /\.webm$/.test(p)).length;
    check('R11: failed Dropbox upload backs off (one try, not three)', audioPosts === 1 && a3.fails === 1 && a3.waits > 20000 && a3.archived !== true, { audioPosts, ...a3 });

    // 4. A Fix a word made while the room is uploading isn't lost.
    audioMode = 'slowok';
    const a4 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), status: 'done', transcript: 'Walls painted white.' });
      rec.id = await dbAdd(rec);
      const pass = archivePass();
      await new Promise(r => setTimeout(r, 100));
      await dbUpdate(rec.id, r => { r.rev = (r.rev || 0) + 1; r.archived = false; r.resendFiles = true; });
      await pass;
      const r = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { archived: r.archived, audio: r.audioArchived };
    }, base);
    check('R11: a fix made during an upload still gets sent (room not marked done)', a4.archived !== true && a4.audio === true, a4);

    // 5. AssemblyAI: a job still running is picked up, not uploaded again.
    audioMode = 'ok'; log.length = 0; transMode = ['504', 'ok'];
    const a5 = await page.evaluate(async (b) => {
      ENGINE = 'assemblyai';
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), status: 'pending', audioArchived: true });
      rec.id = await dbAdd(rec);
      queueRunning = false; await processQueue();
      const mid = (await dbAll()).find(x => x.id === rec.id);
      await dbUpdate(rec.id, r => { delete r.nextTryAt; });
      queueRunning = false; await processQueue();
      const end = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { midStatus: mid.status, midAttempts: mid.attempts || 0, job: mid.aaiJob && mid.aaiJob.id, endStatus: end.status, endJob: end.aaiJob || null };
    }, base);
    const tCalls = log.filter(x => x.startsWith('T:'));
    check('R11: AssemblyAI still running is not counted as a failed try', a5.midStatus === 'pending' && a5.midAttempts === 0 && a5.job === 'job_abc123', a5);
    check('R11: next try asks for the same job instead of re-uploading', tCalls.length === 2 && tCalls[0] === 'T:audio' && /job_abc123/.test(tCalls[1]) && a5.endStatus === 'done' && !a5.endJob, { tCalls, ...a5 });
    // Older val that doesn't know the job id: falls back to the audio, no loop.
    log.length = 0; transMode = ['504', '400', 'ok'];
    const a5b = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), status: 'pending', audioArchived: true });
      rec.id = await dbAdd(rec);
      for (let i = 0; i < 3; i++) { await dbUpdate(rec.id, r => { delete r.nextTryAt; }); queueRunning = false; await processQueue(); }
      const end = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { status: end.status, noResume: !!end.noResume };
    }, base);
    const t2 = log.filter(x => x.startsWith('T:'));
    check('R11: older transcription val still works (falls back to sending the audio)', a5b.status === 'done' && a5b.noResume && t2.length === 3 && t2[2] === 'T:audio', { t2, ...a5b });

    // 6. Audio the phone refuses to save is kept and can be saved from the banner.
    const a6 = await page.evaluate(async () => {
      const real = dbPut;
      dbPut = () => Promise.reject(new DOMException('full', 'QuotaExceededError'));
      currentRecSession = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [new Blob([new Uint8Array(40)], { type: 'audio/webm' })],
        roomId: currentRoomId(), roomName: 'Kitchen', address: state.address, jobId: state.jobId, subsections: [], part: 1, createdAt: Date.now() };
      await stopAudioRecording(currentRoomId(), 'walls painted white', false);
      await new Promise(r => setTimeout(r, 50));
      const held = unsavedRecs.length;
      const btn = !!document.querySelector('#warnBanner.show .warn-btn');
      dbPut = real;
      await retryUnsaved();
      await new Promise(r => setTimeout(r, 50));
      const saved = (await dbAll()).filter(r => r.roomName === 'Kitchen' && r.jobId === state.jobId && r.roughText === 'walls painted white').length;
      return { held, btn, after: unsavedRecs.length, saved, btnAfter: !!document.querySelector('#warnBanner.show .warn-btn') };
    });
    check('R11: recording the phone couldn\'t save is kept in memory with a Save audio button', a6.held === 1 && a6.btn, a6);
    check('R11: and saved to the phone by itself once it can', a6.after === 0 && a6.saved >= 1 && !a6.btnAfter, a6);

    // 7. The 14-day clear never deletes audio that isn't confirmed in Dropbox.
    const a7 = await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      const id = await dbAdd({ roomId: 'k', roomName: 'K', address: 'Old job', jobId: 'Jold', blob, type: 'audio/webm', status: 'done', archived: true, archivedAt: Date.now() - 20 * 864e5, createdAt: Date.now() - 20 * 864e5 });
      await sweepOldJobs();
      const kept = (await dbAll()).some(r => r.id === id);
      await dbDelete(id);
      return kept;
    });
    check('R11: 14-day clear keeps audio not confirmed in Dropbox', a7 === true);

    // 8. Stopping one room leaves the next room's mic guard running.
    const a8 = await page.evaluate(async () => {
      const A = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [], roomId: 'a', roomName: 'A', createdAt: Date.now() };
      const B = {};
      micGuardOwner = B; micGuardTimer = setInterval(() => {}, 100000);
      currentRecSession = A;
      await stopAudioRecording('a', '', false);
      const still = micGuardTimer != null && micGuardOwner === B;
      stopMicGuard();
      return still;
    });
    check('R11: stopping one room doesn\'t switch off the next room\'s mic guard', a8 === true);

    // 9. Serial typed in the room reaches files written after Finish.
    const a9 = await page.evaluate(() => {
      const j = buildRoomJson({ roomId: 'k', roomName: 'Kitchen', address: 'Another job', jobId: 'Jother', subsections: [], transcript: 'Walls painted white.', serialTyped: 'SN-77', inventoryTyped: '2 keys' }, 'Walls painted white.');
      return j.serial + '|' + j.inventory + '|' + j.app;
    });
    check('R11: serial and inventory kept in room files written after Finish', a9 === 'SN-77|2 keys|PA Inspect round 21', a9);

    // 10. Finish stops, and clears nothing, when the details file can't be saved.
    const a10 = await page.evaluate(async () => {
      const real = photoAdd; let alerted = '';
      photoAdd = () => Promise.reject(new DOMException('full', 'QuotaExceededError'));
      window.alert = (m) => { alerted = m; }; window.prompt = () => 'FINISH'; window.confirm = () => true;
      const addr = state.address;
      await finishAndClear();
      const out = { stillThere: state.address === addr && !!loadSaved(), alerted: /Not finished/.test(alerted) };
      photoAdd = real;
      return out;
    });
    check('R11: Finish clears nothing if the inspection details can\'t be saved', a10.stillThere && a10.alerted, a10);

    // 11. Version label, light launch screen.
    check('R16 (updated R21): Admin settings shows app version 21', /app version 21/.test(await page.textContent('#adminSettings summary')));
    check('R11: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
    const fs = require('fs');
    const man = JSON.parse(fs.readFileSync(__dirname + '/../manifest.webmanifest', 'utf8'));
    check('R11: launch screen is light', man.background_color === '#ECECEA' && man.theme_color === '#ECECEA', man);
  }

  // ── Round 12 ──────────────────────────────────────────────────────────────
  {
    const ARCH = '9ecaffe4859311f181ad1607ee4eb77e', CLEAN = 'a1d7b510';
    const puts = [];
    let cleanOut = null;
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      if (u.includes(ARCH)) {
        const path = decodeURIComponent((u.match(/path=([^&]*)/) || [])[1] || '');
        puts.push({ path, type: req.headers()['content-type'], body: req.postDataBuffer() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + path.split('/').pop() }) });
      }
      if (u.includes(CLEAN) && cleanOut) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cleanOut) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });

    // 1. Setup: Check all / Uncheck all.
    const s1 = await page.evaluate(() => {
      const all = () => [...document.querySelectorAll('#roomsSelect .room-toggle')];
      document.getElementById('btnRoomsNone').click();
      const none = all().every(d => !d.classList.contains('selected'));
      document.getElementById('btnRoomsAll').click();
      const every = all().every(d => d.classList.contains('selected'));
      document.getElementById('btnRoomsNone').click();
      all().slice(0, 3).forEach(d => d.click());
      return { none, every, n: all().length };
    });
    check('R12: Uncheck all clears every room, Check all ticks every room', s1.none && s1.every && s1.n > 20, s1);

    // 2. Custom rooms take the template rows their name matches.
    const s2 = await page.evaluate(() => {
      const bl = templateRowsForName('Bathroom Laundry');
      const eld = templateRowsForName('Entry Lounge Dining');
      const kd = templateRowsForName('Kitchen/Dining');
      const odd = templateRowsForName('Wine cellar');
      const bath = ALL_ROOMS.find(r => r.id === 'bathroom2').subsections;
      const entry = ALL_ROOMS.find(r => r.id === 'entry').subsections;
      return {
        bl: bl.join('|') === ALL_ROOMS.find(r => r.id === 'bathroom_laundry').subsections.join('|') && bl.includes('Laundry Tapware') && bl.indexOf('Washing Machine Taps') > bl.indexOf('Bath Tapware') && bl[bl.length - 1] === 'Additional',
        eld: eld.join('|') === entry.join('|'),
        kd: kd.join('|') === ALL_ROOMS.find(r => r.id === 'kitchen').subsections.join('|'),
        odd: odd.join('|') === GENERIC_SUBSECTIONS.join('|'),
        ensuite: templateRowsForName('Bed 1 ensuite').includes('Shower Tiles'),
        lounge: templateRowsForName('Lounge/Dining').includes('TV/Power Points/Light Switches')
      };
    });
    check('R12 (updated R20): "Bathroom Laundry" gets the palm card Bathroom/Laundry rows', s2.bl, s2);
    check('R12: "Entry Lounge Dining" gets the Entry rows', s2.eld, s2);
    check('R12: Kitchen/Dining, ensuite and lounge names pick their rows; an unknown name keeps the general rows', s2.kd && s2.odd && s2.ensuite && s2.lounge, s2);
    const s2b = await page.evaluate(() => {
      addCustomSetupRoomNamed('Bathroom Laundry');
      return (ROOM_LIBRARY[ROOM_LIBRARY.length - 1].subsections || []).includes('Shower Tiles');
    });
    check('R12: a custom room added on the setup screen uses those rows', s2b === true);

    await startJob(page, '12 Sample Pde');

    // 3. Recording signals.
    const s3 = await page.evaluate(async () => {
      const bar = () => getComputedStyle(document.getElementById('recTopbar')).display;
      const pill = document.getElementById('recStatus');
      setFabRecording(true);
      const r1 = { bar: bar(), text: pill.textContent, meter: !!document.getElementById('micMeter'), dot: !!pill.querySelector('.rec-dot') };
      recClockMs = 65000; recClockFrom = Date.now(); paintRecPill();
      const r2 = pill.textContent;
      setMicLevel(0.7);
      const lit = document.querySelectorAll('#micMeter i.on').length;
      setFabPaused(true);
      const r3 = { bar: bar(), text: pill.textContent };
      setFabRecording(false);
      const r4 = { bar: bar(), text: pill.textContent };
      return { r1, r2, lit, r3, r4 };
    });
    check('R12: while recording: red bar at the top, pulsing dot, timer and mic meter', s3.r1.bar === 'block' && /^0:0\d$/.test(s3.r1.text) && s3.r1.meter && s3.r1.dot, s3.r1);
    check('R12: the timer counts (1:05)', /^1:0[5-6]$/.test(s3.r2), s3.r2);
    check('R12: the mic meter lights up with sound', s3.lit >= 3 && s3.lit <= 4, s3.lit);
    check('R12: paused shows the time held, no red bar', s3.r3.bar === 'none' && /^Paused 1:0[5-6]/.test(s3.r3.text), s3.r3);
    check('R12: stopped: bar gone, back to Tap to start', s3.r4.bar === 'none' && s3.r4.text === 'Tap to start recording', s3.r4);

    // 4. The transcript box says what's happening.
    const s4 = await page.evaluate(() => {
      const id = currentRoomId();
      const ta = document.getElementById('roomta-' + id);
      listeningRoom = id; recPaused = false; renderRoomStatus();
      const rec = ta.placeholder;
      listeningRoom = null; roomRecMap[id] = { uploading: true, since: Date.now() }; renderRoomStatus();
      const tx = ta.placeholder;
      ta.value = 'Earlier text.'; renderRoomStatus();
      const line = document.getElementById('txWait');
      const lineShown = line.classList.contains('show') && /Transcribing/.test(line.textContent);
      roomRecMap[id] = { failed: true, autoRetryAt: Date.now() + 60000 }; ta.value = ''; renderRoomStatus();
      const fail = ta.placeholder;
      roomRecMap[id] = { done: true }; renderRoomStatus();
      const done = ta.placeholder;
      delete roomRecMap[id]; renderRoomStatus();
      return { rec, tx, lineShown, fail, done };
    });
    check('R12: while recording the box says the words come after Done', /^Recording… your words appear after you tap Done\./.test(s4.rec), s4.rec);
    check('R12: after Done it says transcribing, 10–30 seconds, you can move on', /Transcribing… about 10–30 seconds\. You can move on\./.test(s4.tx), s4.tx);
    check('R12: with text already there, the same message shows as a line above the box', s4.lineShown);
    check('R12: no signal / failed try: audio saved, transcript follows', /Audio saved\. Text comes through when there's signal\./.test(s4.fail), s4.fail);
    check('R12: transcript in: normal placeholder again', /Transcript shows here after recording/.test(s4.done), s4.done);

    // 5. Cleanup output: stray brace, filler rows, the doubtful words.
    cleanOut = { ok: true, model: 'claude-sonnet-5-5',
      sections: [
        { name: 'Ceiling', text: 'Ceiling {+in clean condition+}.' },
        { name: 'Walls/Picture Hooks', text: 'Walls/Picture Hooks {+in clean condition+}.' },
        { name: 'Heating/Exhaust Fan/Vent', text: 'Exhaust fan is a white plastic Brightco, {+secured and functional+}}.' },
        { name: 'Windows/Screens', text: 'Two frosted glass panes. Sliding door has a parliament lockable handle.' }
      ],
      check: [{ quote: 'Sliding door has a parliament lockable handle.', words: 'parliament', heard: 'parliament lockable handle', why: 'does not make sense' }] };
    const s5 = await page.evaluate(async () => {
      const rec = { id: 9001, roomId: 'x', roomName: 'Bathroom Laundry', address: state.address, jobId: state.jobId, subsections: templateRowsForName('Bathroom Laundry'),
        transcript: 'ceiling walls exhaust fan is a white plastic brightco secured and functional two frosted glass panes sliding door has a parliament lockable handle', words: [], createdAt: Date.now(), type: 'audio/webm' };
      cleanupReady = true;
      await runCleanup(rec);
      return { names: (rec.sections || []).map(s => s.name), fan: ((rec.sections || []).find(s => /Exhaust/.test(s.name)) || {}).text, words: rec.check && rec.check[0] && rec.check[0].words };
    });
    check('R12: rows that only repeat their name or an added phrase are dropped', s5.names.join('|') === 'Heating/Exhaust Fan/Vent|Windows/Screens', s5.names);
    check('R12: stray brace removed', s5.fan === 'Exhaust fan is a white plastic Brightco, [added: secured and functional].', s5.fan);
    check('R12: the doubtful words come through from the cleanup', s5.words === 'parliament', s5.words);
    // R17 review: the cleanup val's cut_short is kept on the recording, and cleared on a clean answer.
    const s5b = await page.evaluate(async () => {
      const rec = { id: 9002, roomId: 'x', roomName: 'Bathroom Laundry', address: state.address, jobId: state.jobId, subsections: templateRowsForName('Bathroom Laundry'),
        transcript: 'ceiling walls exhaust fan is a white plastic brightco secured and functional two frosted glass panes sliding door has a parliament lockable handle', words: [], createdAt: Date.now(), type: 'audio/webm' };
      cleanupReady = true;
      await runCleanup(rec);
      return rec.checkCutShort;
    });
    cleanOut = Object.assign({}, cleanOut, { cut_short: true });
    const s5c = await page.evaluate(async () => {
      const rec = { id: 9003, roomId: 'x', roomName: 'Bathroom Laundry', address: state.address, jobId: state.jobId, subsections: templateRowsForName('Bathroom Laundry'),
        transcript: 'ceiling walls exhaust fan is a white plastic brightco secured and functional two frosted glass panes sliding door has a parliament lockable handle', words: [], createdAt: Date.now(), type: 'audio/webm' };
      cleanupReady = true;
      await runCleanup(rec);
      const first = rec.checkCutShort;
      return first;
    });
    check('R17 review: cut_short from the cleanup val is kept on the recording (and absent on a normal answer)', s5c === true && s5b === undefined, { s5b, s5c });

    // 6. Timecodes: the bathroom tapware case.
    const s6 = await page.evaluate(() => {
      const said = [[45, 'hand basin is mostly a cream ceramic with a similar plug and similar overflow'], [48, 'plug is stained'],
        [49, 'tapware is a similar mixer with red blue markings and staining'], [52, 'benchtop is a white laminate'],
        [124, 'interior is a silver metal'], [126, 'no model no serial no additional']];
      const words = [];
      said.forEach(([t, s]) => s.split(' ').forEach((w, i) => words.push({ w, s: t + i * 0.2 })));
      const text = 'Hand basin is mostly a cream ceramic with a silver metal plug and silver metal overflow. Plug is stained. Tapware is a silver metal mixer with red blue markings and staining. Benchtop is a white laminate.';
      return timedSentences(text, words, { idx: 0 }).map(x => formatClock(x.at));
    });
    check('R12: "Tapware is a silver metal mixer" is stamped 0:49, not 2:04', s6.join(',') === '0:45,0:48,0:49,0:52', s6);

    // 7. Dropbox layout and the job's Word file.
    puts.length = 0;
    const s7 = await page.evaluate(async () => {
      state.mandatory.gasMeter = '01234 m3'; state.mandatory.rcdBox = '4521 kwh'; state.mandatory.waterMeter = '123'; state.mandatory.waterMeterLocation = 'front verge'; state.mandatory.nbnBox = 'NF123';
      const room = state.rooms[0];
      const words = [];
      'ceiling painted white walls painted grey sliding door has a parliament lockable handle the door has a owl symbol present'.split(' ').forEach((w, i) => words.push({ w, s: i * 0.5 }));
      const mk = (extra) => Object.assign({ roomId: room.id, roomName: room.name, address: state.address, jobId: state.jobId, meta: inspectionMeta(),
        subsections: room.subsections.slice(), type: 'audio/webm', blob: new Blob([new Uint8Array(20)]), engine: 'assemblyai', status: 'done', words,
        transcript: 'ceiling painted white walls painted grey sliding door has a parliament lockable handle the door has a owl symbol present', createdAt: Date.now(), roomNo: 1, part: 1, cleanedBy: 'claude-sonnet-5-5' }, extra);
      const sub = room.subsections;
      const rec = mk({ sections: [
          { name: sub[0], text: 'The door has a owl symbol present.' },
          { name: sub[1], text: 'Ceiling painted white [added: in clean condition].' },
          { name: sub[3], text: 'Walls painted grey. Sliding door has a parliament lockable handle.' }],
        check: [
          { quote: 'Sliding door has a parliament lockable handle.', words: 'parliament', why: 'odd', resolved: 'kept' },
          { quote: 'The door has a owl symbol present.', words: 'owl symbol', why: 'odd' },
          { quote: 'Walls painted grey.', words: 'grey', why: 'x', resolved: 'fixed', fixedTo: 'Walls painted grey.' }] });
      rec.id = await dbAdd(rec);
      await archiveToDropbox(rec);
      await dbUpdate(rec.id, r => { r.archived = true; r.audioArchived = true; });
      markJobDoc(archiveFolderName(rec), jobSnapshot());
      await jobDocPass();
      const model = buildJobModel((await dbAll()).filter(r => archiveFolderName(r) === archiveFolderName(rec)), jobSnapshot());
      return { folder: archiveFolderName(rec), base: archiveBaseName(rec), rows: model.rooms[0].rows.map(r => r.name), total: model.rooms[0].total, said: model.rooms[0].said,
        toCheck: model.rooms[0].toCheck, sub: room.subsections, docName: jobDocName(state.address) };
    });
    check('R12: file names start with the room\'s walk-order number', /^01 /.test(s7.base), s7.base);
    check('R12: audio in Audio/, .txt and .json in App data/', puts.some(p => p.path === s7.folder + '/Audio/' + s7.base + '.webm') && puts.some(p => p.path === s7.folder + '/App data/' + s7.base + '.txt') && puts.some(p => p.path === s7.folder + '/App data/' + s7.base + '.json'), puts.map(p => p.path));
    const doc = puts.filter(p => p.path === s7.folder + '/' + s7.docName).pop();
    check('R12: the job Word file goes to the top of the job folder as "<address> - Inspection.docx"', !!doc && /wordprocessingml/.test(doc.type), puts.map(p => p.path));
    check('R12: every template row is listed, in template order', s7.rows.join('|') === s7.sub.join('|') && s7.total === s7.sub.length && s7.said === 3, s7);
    check('R12: a word the inspector kept as correct is still highlighted; a fixed one is not', s7.toCheck === 2, s7.toCheck);
    let xml = '';
    if (doc) {
      xml = await page.evaluate(async (b64) => {
        const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const z = await (await loadJSZip()).loadAsync(bin);
        return (await z.file('word/document.xml').async('string')) + '||' + Object.keys(z.files).join(',');
      }, doc.body.toString('base64'));
      require('fs').writeFileSync(__dirname + '/private/job-test.docx', doc.body);
    }
    const txt = xml.replace(/<[^>]+>/g, '');
    check('R12: page 1 has the accuracy note, Security/Safety, words to check per room and the key', /may not be 100% accurate/.test(txt) && /Security\/Safety/.test(txt) && /4521 kwh/.test(txt) && /Not recorded in the app/.test(txt) && /Words to check per room \(2\)/.test(txt) && /What it means/.test(txt), txt.slice(0, 600));
    check('R12 (updated R20): water meter, gas meter, NBN and the mandatory photo count listed under Security/Safety', /Water meter 123 — front verge/.test(txt) && /Gas meter 01234 m3/.test(txt) && /NBN box NF123/.test(txt) && /Photos Water Meter none, RCD Box none, Gas Meter none, NBN Box none \(Photos folder, (?:"|&quot;)00 Mandatory(?:"|&quot;)\)/.test(txt), txt.slice(txt.indexOf('Also recorded'), txt.indexOf('Also recorded') + 300));
    check('R12: unmentioned rows say Not mentioned', /Not mentioned/.test(txt));
    check('R12: highlighted words are yellow, added phrases grey italic', /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">parliament<\/w:t>/.test(xml) && /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">owl symbol<\/w:t>/.test(xml) && /<w:i\/><w:color w:val="8A8A8A"\/>.*?in clean condition/.test(xml), xml.length);
    check('R12: the raw transcript is at the back', /Raw transcript \(as heard\)/.test(txt) && txt.indexOf('Raw transcript') > txt.indexOf('Template row'));
    check('R12: Word file has header, footer with page numbers, and styles', /word\/footer1\.xml/.test(xml) && /word\/header1\.xml/.test(xml) && /word\/styles\.xml/.test(xml));
    check('R12: no Word file per room', !puts.some(p => new RegExp(s7.base + '\\.docx$').test(p.path)));

    // 8. Review page: optional, Next word to check, moves on after a fix.
    const s8 = await page.evaluate(async () => {
      const a = state.rooms[0].id, b = state.rooms[2].id;
      state.roomNotes[a] = 'Sliding door has a parliament lockable handle.';
      state.roomNotes[b] = 'Door has a owl symbol present. Two power points.';
      state.roomChecks[a] = [{ quote: 'Sliding door has a parliament lockable handle.', why: 'odd' }];
      state.roomChecks[b] = [{ quote: 'Door has a owl symbol present.', why: 'odd' }, { quote: 'Two power points.', why: 'number' }];
      showReview();
      await new Promise(r => setTimeout(r, 200));
      const btn = document.getElementById('btnNextCheck');
      const out = { hint: (document.querySelector('.check-optional') || {}).textContent || '', shown: getComputedStyle(btn).display !== 'none', label: btn.textContent,
        anyOpen: [...document.querySelectorAll('details.review-room')].some(d => d.open), title: (document.querySelector('.review-check-title') || {}).textContent };
      gotoNextCheck(true);
      out.opened = [...document.querySelectorAll('details.review-room')].filter(d => d.open).map(d => d.dataset.room);
      out.flash = !!document.querySelector('.review-check-row.flash');
      // Settle the first one; the page moves on to the next by itself.
      fixTarget = { roomId: a, idx: 0 };
      await saveFix(true);
      await new Promise(r => setTimeout(r, 300));
      out.after = [...document.querySelectorAll('details.review-room')].filter(d => d.open).map(d => d.dataset.room);
      out.label2 = document.getElementById('btnNextCheck').textContent;
      out.a = a; out.b = b;
      return out;
    });
    check('R12: review says fixing words is optional', /optional\. The VA checks every highlighted word/.test(s8.hint) && /to check \(optional\)/.test(s8.title), s8);
    check('R12: rooms start folded, with a Next word to check button and the count', !s8.anyOpen && /Fix all words3/.test(s8.label), s8);
    check('R12: Next opens the room with the next word and lights the line', s8.opened.length === 1 && s8.opened[0] === s8.a && s8.flash, s8);
    check('R12: after a fix the page moves to the next one by itself', s8.after.includes(s8.b) && /Fix all words2/.test(s8.label2), s8);

    // 9. Finish: the Word file is built once more with everything typed, and the details file goes in App data.
    puts.length = 0;
    const s9 = await page.evaluate(async () => {
      window.confirm = () => true; window.prompt = () => 'FINISH'; window.alert = () => {};
      const folder = archiveFolderName({ address: state.address, meta: inspectionMeta(), createdAt: state.startedAt });
      await finishAndClear();
      await new Promise(r => setTimeout(r, 300));
      await processPhotoQueue();
      archiveRunning = false; await processArchiveQueue();
      const e = loadJobDocs()[folder];
      return { folder, finished: !!(e && e.snap && e.snap.finishedAt), sent: e && e.sent >= e.rev };
    });
    check('R12: Finish rebuilds the job Word file with what was typed', s9.finished && s9.sent && puts.some(p => / - Inspection\.docx$/.test(p.path)), { s9, puts: puts.map(p => p.path) });
    check('R12: the inspection details file goes in App data', puts.some(p => p.path === s9.folder + '/App data/00 - Inspection details.txt'), puts.map(p => p.path));
    check('R12: details file calls "some" a house-style word, not a word to fix', await page.evaluate(() => /HOUSE-STYLE WORDS TO AVOID/.test(buildReportText.toString()) && !/WORDS TO FIX BEFORE SUBMITTING/.test(buildReportText.toString())));
    check('R12: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 13 ──────────────────────────────────────────────────────────────
  {
    const puts = [];
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
      if (u.includes('9ecaffe4')) {
        const path = decodeURIComponent((u.match(/path=([^&]*)/) || [])[1] || '');
        puts.push({ path, body: req.postDataBuffer() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + path.split('/').pop() }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });
    check('R13: setup heading says Start Inspection', /Start\s*Inspection/.test(await page.textContent('.setup-hero h1')), await page.textContent('.setup-hero h1'));
    const g = await page.evaluate(() => {
      const l = document.querySelector('.rooms-head label').getBoundingClientRect();
      const a = document.getElementById('btnRoomsAll').getBoundingClientRect();
      const s = document.getElementById('roomsSelect').getBoundingClientRect();
      return { labelBottom: l.bottom, btnTop: a.top, btnBottom: a.bottom, selTop: s.top, adj: getComputedStyle(document.documentElement).webkitTextSizeAdjust || getComputedStyle(document.documentElement).textSizeAdjust };
    });
    check('R13: Check all / Uncheck all sit below the label, rooms below them (no overlap)', g.btnTop >= g.labelBottom && g.selTop >= g.btnBottom, g);
    check('R13: Android text boosting is off', /100%/.test(String(g.adj)), g.adj);
    await startJob(page, '13 Test Pde');
    const h = await page.evaluate(() => {
      addRoomNamed('Entry Lounge Dining');
      const t = document.querySelector('.room-title').getBoundingClientRect();
      const e = document.querySelector('.room-edit-btn').getBoundingClientRect();
      const bar = document.getElementById('nextSub');
      const out = { sameRow: e.top < t.bottom && e.left >= t.right - 2, editText: document.querySelector('.room-edit-btn').textContent.trim(),
        hasTick: !!bar.querySelector('.next-sub-btn'), hasMore: !!bar.querySelector('.next-sub-more'), next: bar.querySelector('strong').textContent,
        oldToggle: !!document.querySelector('.checklist-toggle'), oldNote: !!document.querySelector('.field-note.one-line'), open0: document.getElementById('checklistBox').classList.contains('open') };
      bar.querySelector('.next-sub-more').click();
      out.open1 = document.getElementById('checklistBox').classList.contains('open');
      out.tip = /Scratch that/.test(document.getElementById('checklistBox').textContent);
      document.getElementById('checklistToggle').click();
      out.open2 = document.getElementById('checklistBox').classList.contains('open');
      bar.querySelector('.next-sub-btn').click();
      out.next2 = document.querySelector('#nextSub strong').textContent;
      return out;
    });
    check('R13: room title and a small pencil on one row (no Edit word)', h.sameRow && h.editText === '', h);
    check('R13: one guide bar: Next row, tick, and arrow; no separate checklist button or tip line', h.hasTick && h.hasMore && h.next === 'Front Door/Frames/Handles' && !h.oldToggle && !h.oldNote, h);
    check('R13: the arrow opens and closes all rows, with the tip inside', !h.open0 && h.open1 && h.tip && !h.open2, h);
    check('R13: the tick moves to the next row', h.next2 === 'Screen Door/Security Door/Handles', h.next2);
    const pill = await page.evaluate(() => { setFabRecording(true); const t = document.getElementById('recStatus').textContent; setFabRecording(false); return t; });
    check('R13: while recording the dock shows just the time', /^0:0\d$/.test(pill), pill);
    // Fix all walks every word.
    const f = await page.evaluate(async () => {
      const a = state.rooms[0].id, b = state.rooms[2].id;
      state.roomNotes[a] = 'Door has a parliament handle.';
      state.roomNotes[b] = 'Owl symbol present. Two power points.';
      state.roomChecks[a] = [{ quote: 'Door has a parliament handle.', why: 'x' }];
      state.roomChecks[b] = [{ quote: 'Owl symbol present.', why: 'x' }, { quote: 'Two power points.', why: 'x' }];
      showReview();
      await new Promise(r => setTimeout(r, 150));
      const label = document.getElementById('btnNextCheck').textContent;
      const inline = (document.querySelector('.check-optional .fix-all-inline') || {}).textContent || '';
      document.querySelector('.check-optional .fix-all-inline').click();
      const subs = [];
      for (let i = 0; i < 3; i++) {
        subs.push(document.getElementById('fixSub').textContent + '|' + document.getElementById('fixSheet').classList.contains('open'));
        if (i === 1) { document.getElementById('fixText').value = 'Calcium build-up present.'; await saveFix(false); }
        else await saveFix(true);
        await new Promise(r => setTimeout(r, 150));
      }
      return { label, inline, subs, open: document.getElementById('fixSheet').classList.contains('open'), left: openChecksLeft(), fixed: state.roomNotes[b], mode: fixAllMode };
    });
    check('R13: review button says Fix all words with the count', /^Fix all words3$/.test(f.label), f.label);
    check('R13: Fix all is also on the page under the optional note (always reachable)', /^Fix all words 3$/.test(f.inline), f.inline);
    check('R13: Fix all opens word 1 of 3, then 2 of 3, then 3 of 3', /^Word 1 of 3/.test(f.subs[0]) && /^Word 2 of 3/.test(f.subs[1]) && /^Word 3 of 3/.test(f.subs[2]) && f.subs.every(x => /\|true$/.test(x)), f.subs);
    check('R13: Fix all closes by itself when every word is done, fixes applied', !f.open && f.left === 0 && /Calcium build-up present\./.test(f.fixed) && !f.mode, f);
    const stop = await page.evaluate(async () => {
      const a = state.rooms[0].id;
      state.roomChecks[a] = [{ quote: 'Door has a parliament handle.', why: 'x' }, { quote: 'Other.', why: 'x' }];
      showReview(); startFixAll(); closeFixSheet();
      return { mode: fixAllMode, left: openChecksLeft() };
    });
    check('R13: closing the sheet stops Fix all, nothing changed', !stop.mode && stop.left === 2, stop);
    // Inspector's notes.
    const n = await page.evaluate(async () => {
      const ta = document.getElementById('propertyNotes');
      ta.value = 'Keys left in the meter box.\nTenant items in garage.'; ta.dispatchEvent(new Event('input'));
      flushSaveState();
      const saved = loadSaved().propertyNotes;
      const report = buildReportText();
      const snap = jobSnapshot();
      return { saved, report: /NOTES ABOUT THE PROPERTY\n-+\nKeys left in the meter box\./.test(report), snap: snap.notes };
    });
    check('R13: review has a notes box; notes are saved with the job', n.saved === 'Keys left in the meter box.\nTenant items in garage.', n);
    check('R13: notes go in the inspection details file', n.report, n);
    const doc = await page.evaluate(async () => {
      const blob = await buildJobDocx(buildJobModel([], jobSnapshot()));
      const z = await (await loadJSZip()).loadAsync(blob);
      return (await z.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '');
    });
    check('R13: notes go on page 1 of the job Word file', /Inspector’s notes about the property/.test(doc) && /Keys left in the meter box\./.test(doc) && doc.indexOf('Keys left') < doc.indexOf('Security/Safety'), doc.slice(0, 400));
    check('R13: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 14: sync hardening ─────────────────────────────────────────────
  {
    const ARCH = '9ecaffe4859311f181ad1607ee4eb77e', TRANS = '7e43f138ad2311f186b71607ee4eb77e';
    const log = [], diags = [];
    let archSize = null;   // when set, the archive val answers with this size
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
      if (u.includes('action=log')) { try { diags.push(JSON.parse(req.postData())); } catch (e) { diags.push({ bad: true }); } return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      const size = (u.match(/[?&]size=(\d+)/) || [])[1];
      const len = (req.postDataBuffer() || Buffer.alloc(0)).length;
      if (u.includes(ARCH)) {
        const path = decodeURIComponent((u.match(/path=([^&]*)/) || [])[1] || '');
        log.push({ kind: 'A', path, size: size != null ? Number(size) : null, len });
        const out = { ok: true, path: '/x/' + path.split('/').pop() };
        if (archSize != null && /\.(webm|m4a)$/.test(path)) out.size = archSize; else if (size != null) out.size = Number(size);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
      }
      if (u.includes(TRANS)) {
        const ct = req.headers()['content-type'] || '';
        log.push({ kind: 'T', json: ct.includes('json'), size: size != null ? Number(size) : null, len });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"transcript":"Walls painted white.","engine":"assemblyai","words":[]}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });
    await startJob(page, '14 Example St');
    const base = `({ roomId: currentRoomId(), roomName: 'Entry', address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: 'front door painted white', type: 'audio/webm', createdAt: Date.now(), attempts: 0 })`;
    await page.evaluate(() => { TIMING.grace = 200; });

    // 1. Audio goes as a plain copy with its size, to Dropbox and to transcription.
    log.length = 0;
    const s1 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), status: 'pending' });
      rec.id = await dbAdd(rec);
      queueRunning = false; await processQueue();
      for (let i = 0; i < 20 && archiveRunning; i++) await new Promise(r => setTimeout(r, 100));
      const end = (await dbAll()).find(x => x.id === rec.id);
      return { status: end.status, audio: !!end.audioArchived };
    }, base);
    const aud = log.find(x => x.kind === 'A' && /\.webm$/.test(x.path)), tr = log.find(x => x.kind === 'T');
    check('R14: audio sent with its size, Dropbox and transcription both get all 50 bytes', s1.status === 'done' && s1.audio && aud && aud.size === 50 && aud.len === 50 && tr && tr.size === 50 && tr.len === 50, { s1, aud, tr });

    // 2. A send that never answers (and ignores its abort) can't hold the queue.
    const s2 = await page.evaluate(async (b) => {
      const realFetch = window.fetch;
      window.fetch = (u, o) => (/web\.val\.run/.test(String(u)) && !/action=log/.test(String(u))) ? new Promise(() => {}) : realFetch(u, o);
      const keep = { arch: TIMING.archiveBaseMs, eng: ENGINES.assemblyai.timeoutMs };
      TIMING.archiveBaseMs = 300; ENGINES.assemblyai.timeoutMs = 300;
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(60)], { type: 'audio/webm' }), status: 'pending' });
      rec.id = await dbAdd(rec);
      const t0 = Date.now();
      queueRunning = false; await processQueue();
      const took = Date.now() - t0;
      window.fetch = realFetch; TIMING.archiveBaseMs = keep.arch; ENGINES.assemblyai.timeoutMs = keep.eng;
      const end = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { took, status: end.status, last: end.lastError, stages: (end.errLog || []).map(x => x.stage), running: queueRunning, inflight: audioInFlight.has(rec.id) };
    }, base);
    check('R14: a send that never answers gives up on time; the room goes back in the queue, not stuck on sending', s2.took < 4000 && s2.status === 'pending' && s2.last === 'timed out' && !s2.running && !s2.inflight, s2);
    check('R14: both failures are kept on the recording (Dropbox and transcription)', s2.stages.includes('dropbox') && s2.stages.includes('transcribe'), s2);

    // 3. A Dropbox pass that has been stuck for 12+ minutes is abandoned.
    const s3 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(20)], { type: 'audio/webm' }), status: 'done', transcript: 'Walls painted white.' });
      rec.id = await dbAdd(rec);
      archiveRunning = true; archiveStartedAt = Date.now();
      await processArchiveQueue();
      const blocked = (await dbAll()).find(x => x.id === rec.id).archived !== true;
      archiveStartedAt = Date.now() - 13 * 60000;
      await processArchiveQueue();
      const end = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { blocked, archived: end.archived === true, running: archiveRunning };
    }, base);
    check('R14: a stuck Dropbox pass no longer blocks Dropbox for the rest of the day', s3.blocked && s3.archived && !s3.running, s3);

    // 4. A dead upload left "in flight" is dropped instead of waited on for ever.
    const s4 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(20)], { type: 'audio/webm' }), status: 'done' });
      rec.id = await dbAdd(rec);
      const dead = new Promise(() => {}); dead.at = Date.now() - 60 * 60000;
      audioInFlight.set(rec.id, dead);
      const ok = await withDeadline(archiveAudio(rec), 3000, 'test').then(() => true, () => false);
      await dbDelete(rec.id);
      return { ok, up: !!rec.audioArchived };
    }, base);
    check('R14: an upload that died earlier no longer blocks that room\'s audio', s4.ok && s4.up, s4);

    // 5. Dropbox storing fewer bytes than were sent is not "in Dropbox".
    archSize = 3;
    const s5 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { blob: new Blob([new Uint8Array(40)], { type: 'audio/webm' }), status: 'done', transcript: 'Walls painted white.' });
      rec.id = await dbAdd(rec);
      archiveRunning = false; await processArchiveQueue();
      const end = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { audio: !!end.audioArchived, archived: end.archived === true, err: end.archError, stages: (end.errLog || []).map(x => x.msg) };
    }, base);
    archSize = null;
    check('R14: a short file in Dropbox is caught and sent again later', !s5.audio && !s5.archived && s5.err === 'incomplete upload', s5);

    // 6. A recording that can't be read: three goes, then damaged; nothing pretends to send.
    log.length = 0; diags.length = 0;
    const s6 = await page.evaluate(async (b) => {
      const realAB = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function () { return this.size === 70 ? Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) : realAB.call(this); };
      const rec = Object.assign(eval(b), { roomId: state.rooms[4].id, roomName: state.rooms[4].name, blob: new Blob([new Uint8Array(70)], { type: 'audio/webm' }), status: 'pending' });
      rec.id = await dbAdd(rec);
      for (let i = 0; i < 3; i++) { await dbUpdate(rec.id, r => { delete r.nextTryAt; }); queueRunning = false; await processQueue(); }
      const quick = (await dbAll()).find(x => x.id === rec.id);
      // Spread over 10+ minutes: the next failure calls it.
      await dbUpdate(rec.id, r => { r.readFirstFailAt = Date.now() - 11 * 60000; delete r.nextTryAt; });
      queueRunning = false; await processQueue();
      const end = (await dbAll()).find(x => x.id === rec.id);
      const rows = await computeAreaStatus();
      const row = rows.find(r => r.id === rec.roomId);
      await new Promise(r => setTimeout(r, 300));
      // The typist gets a note in Dropbox instead.
      archiveRunning = false; await processArchiveQueue();
      const after = (await dbAll()).find(x => x.id === rec.id);
      Blob.prototype.arrayBuffer = realAB;
      const out = { quickStatus: quick.status, quickUnreadable: !!quick.unreadable, status: end.status, unreadable: !!end.unreadable, readFails: end.readFails, flag: roomAudioFlags[rec.roomId],
        toast: window.__toasts.some(t => /can't be opened on this phone/.test(t)), why: row && row.why, ready: row && row.ready, archived: after.archived === true };
      await dbDelete(rec.id);
      return out;
    }, base);
    const sentAudio = log.filter(x => (x.kind === 'A' && /\.webm$/.test(x.path)) || (x.kind === 'T' && !x.json));
    const note = log.find(x => x.kind === 'A' && /AUDIO UNREADABLE\.txt$/.test(x.path));
    check('R14: three failed reads within minutes are not enough to call a recording damaged', s6.quickStatus === 'pending' && !s6.quickUnreadable, s6);
    check('R14: unreadable over 10+ minutes: marked damaged, and no empty or broken upload is ever sent', s6.status === 'failed' && s6.unreadable && s6.readFails === 4 && sentAudio.length === 0, { s6, sentAudio });
    check('R14: the room asks to be recorded again (toast, warning, area status)', s6.toast && s6.flag === 'noaudio' && /can't be opened/.test(s6.why || '') && s6.ready === false, s6);
    check('R15: Dropbox gets an "AUDIO UNREADABLE" note for the typist', !!note && s6.archived, { note, s6 });
    const dmg = diags.find(d => d.stage === 'unreadable');
    check('R14: the damaged recording is reported to the val log with the phone and the error', !!dmg && dmg.app === 21 && /NotReadableError/.test(dmg.error + JSON.stringify(dmg.errors)) && !!dmg.device && !!dmg.ua && !!dmg.room, dmg);

    // 7. Read-back after Done: a stored copy that comes back short is saved again as bytes.
    diags.length = 0;
    const s7 = await page.evaluate(async () => {
      try { localStorage.removeItem('pa_store_bytes'); } catch (e) {}
      const flagBefore = storeAsBytes();
      const realGet = dbGet;
      dbGet = async (id) => { const r = await realGet(id); if (r && !r.bytes && r.blob) r.blob = new Blob([new Uint8Array(1)], { type: 'audio/webm' }); return r; };
      currentRecSession = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [new Blob([new Uint8Array(40)], { type: 'audio/webm' })],
        roomId: currentRoomId(), roomName: 'Bedroom 1', address: state.address, jobId: state.jobId, subsections: [], part: 1, createdAt: Date.now() };
      queueRunning = true;   // keep the queue off it until the checks below
      await stopAudioRecording(currentRoomId(), 'walls cream', false);
      queueRunning = false;
      dbGet = realGet;
      const all = await dbAll();
      const rec = all.find(r => r.roomName === 'Bedroom 1' && r.roughText === 'walls cream');
      const raw = await dbTx(AUDIO_STORE, 'readonly', (s, set) => { const g = s.get(rec.id); g.onsuccess = () => set(g.result); });
      const kept = await bytesGet(rec.id);
      const asFile = await recBlob(rec);
      const out = { flagBefore, flagAfter: storeAsBytes(), rawBlob: raw.blob, bytesStored: !!raw.bytesStored, bytesSize: raw.bytesSize, kept: kept ? kept.byteLength : 0, asFile: asFile ? asFile.size : 0,
        saveErr: (rec.errLog || []).some(x => x.stage === 'save'), unsaved: unsavedRecs.length, id: rec.id, status: raw.status };
      return out;
    });
    check('R14: read-back check after Done: a short stored copy is saved again as plain bytes, in their own store', s7.rawBlob === null && s7.bytesStored && s7.bytesSize === 40 && s7.kept === 40 && s7.asFile === 40 && s7.saveErr && s7.unsaved === 0, s7);
    check('R14: and the phone saves as bytes from then on; the val log hears about it', !s7.flagBefore && s7.flagAfter && diags.some(d => d.stage === 'save-readback'), { s7, diags: diags.map(d => d.stage) });

    // 8. A recording kept as bytes sends like any other.
    log.length = 0;
    const s8 = await page.evaluate(async (id) => {
      await dbUpdate(id, r => { r.status = 'pending'; delete r.nextTryAt; r.audioArchived = false; r.archived = false; });
      for (let i = 0; i < 30 && queueRunning; i++) await new Promise(r => setTimeout(r, 100));
      queueRunning = false; await processQueue();
      const end = (await dbAll()).find(x => x.id === id);
      // A later recording on this phone goes straight to bytes.
      currentRecSession = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [new Blob([new Uint8Array(33)], { type: 'audio/webm' })],
        roomId: currentRoomId(), roomName: 'Bedroom 2', address: state.address, jobId: state.jobId, subsections: [], part: 1, createdAt: Date.now() };
      queueRunning = true;   // keep the queue off it for this check
      await stopAudioRecording(currentRoomId(), 'walls white', false);
      queueRunning = false;
      const next = (await dbAll()).find(r => r.roomName === 'Bedroom 2' && r.roughText === 'walls white');
      const nextBytes = await bytesGet(next.id);
      // Deleting a recording deletes its bytes too.
      await dbDelete(id);
      const gone = await bytesGet(id);
      await dbDelete(next.id);
      try { localStorage.removeItem('pa_store_bytes'); } catch (e) {}
      return { status: end.status, audio: !!end.audioArchived, nextStored: !!next.bytesStored && !next.blob && next.status === 'pending', nextBytes: nextBytes ? nextBytes.byteLength : 0, gone: gone == null };
    }, s7.id);
    check('R14: the next recording on that phone is saved straight as bytes; deleting a recording deletes its bytes', s8.nextStored && s8.nextBytes === 33 && s8.gone, s8);
    const t8 = log.find(x => x.kind === 'T' && !x.json), a8 = log.find(x => x.kind === 'A' && /\.webm$/.test(x.path));
    check('R14: a recording kept as bytes is sent whole to Dropbox and transcription', s8.status === 'done' && s8.audio && t8 && t8.len === 40 && a8 && a8.len === 40, { s8, t8, a8, log: log.map(x => x.kind + ':' + (x.path || '') + ':' + x.len) });

    // 9. A phone-storage step that never finishes gives up instead of hanging.
    const s9 = await page.evaluate(async () => {
      const keep = TIMING.dbMs, realOpen = openAudioDB;
      TIMING.dbMs = 300;
      openAudioDB = () => new Promise(() => {});
      const t0 = Date.now();
      const r = await dbAll().then(() => 'ok', e => e.name);
      const took = Date.now() - t0;
      openAudioDB = realOpen; TIMING.dbMs = keep;
      const back = await dbAll().then(() => true, () => false);
      return { r, took, back };
    });
    check('R14: a phone-storage step that hangs gives up in seconds, and storage works again after', s9.r === 'TimeoutError' && s9.took < 2000 && s9.back, s9);

    // 10. The files carry the phone and the errors.
    const s10 = await page.evaluate(() => {
      const j = buildRoomJson({ roomId: 'k', roomName: 'Kitchen', address: state.address, jobId: state.jobId, subsections: [], transcript: 'Walls painted white.',
        errLog: [{ t: Date.now(), stage: 'dropbox', msg: 'TypeError: Load failed' }] }, 'Walls painted white.');
      const txt = buildInspectionSummary([{ name: 'Kitchen', text: 'transcript queued, Dropbox sending', ready: false, lastErr: { t: Date.now(), stage: 'dropbox', msg: 'TypeError: Load failed' } },
        { name: 'Lounge', text: 'transcript done, Dropbox saved', ready: true }]);
      return { phone: j.phone, errs: j.syncErrors, txt };
    });
    check('R14: room .json says which phone and lists the sending errors', !!s10.phone && s10.errs.length === 1 && s10.errs[0].stage === 'dropbox' && s10.errs[0].error === 'TypeError: Load failed', s10);
    check('R14: inspection details file names the phone and the sending problems', /Phone: .+\(app version 21\)/.test(s10.txt) && /SENDING PROBLEMS SEEN ON THE PHONE\n-+\nKitchen: dropbox, TypeError: Load failed/.test(s10.txt) && !/Lounge: dropbox/.test(s10.txt), s10.txt.slice(0, 600));

    // 11. Finishing with rooms not in Dropbox reaches the val log at once.
    diags.length = 0;
    await page.evaluate(async () => { await queueInspectionSummary([{ name: 'Kitchen', text: 'x', ready: false, why: 'uploading to Dropbox now', lastErr: { t: Date.now(), stage: 'dropbox', msg: 'timed out' } }, { name: 'Lounge', text: 'y', ready: true }]); });
    await wait(300);
    const fin = diags.find(d => d.stage === 'finish-unsent');
    check('R14: Finish with rooms not in Dropbox is reported to the val log, room by room', !!fin && fin.rooms.length === 1 && fin.rooms[0].room === 'Kitchen' && /timed out/.test(fin.rooms[0].last), fin);

    // 12. Diagnostics are rate-limited.
    diags.length = 0;
    await page.evaluate(() => { for (let i = 0; i < 10; i++) sendDiag('test', { id: 999, roomName: 'X' }, 'same'); });
    await wait(300);
    check('R14: the val log is told once, not ten times, about the same thing', diags.filter(d => d.stage === 'test').length === 1, diags.length);

    // 13. Read-back fails AND bytes can't be stored: audio kept in memory, but
    // the stored record is never written over once the queue has moved it on.
    const s13 = await page.evaluate(async () => {
      try { localStorage.removeItem('pa_store_bytes'); } catch (e) {}
      const realGet = dbGet, realBytesPut = bytesPut;
      dbGet = async (id) => { const r = await realGet(id); if (r && !r.bytesStored && r.blob) r.blob = new Blob([new Uint8Array(1)], { type: 'audio/webm' }); return r; };
      bytesPut = () => Promise.reject(new DOMException('full', 'QuotaExceededError'));
      currentRecSession = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [new Blob([new Uint8Array(44)], { type: 'audio/webm' })],
        roomId: currentRoomId(), roomName: 'Study', address: state.address, jobId: state.jobId, subsections: [], part: 1, createdAt: Date.now() };
      queueRunning = true;
      await stopAudioRecording(currentRoomId(), 'study walls', false);
      dbGet = realGet;
      const held = unsavedRecs.filter(r => r.roomName === 'Study').length;
      const rec = (await dbAll()).find(r => r.roomName === 'Study' && r.roughText === 'study walls');
      // The queue finishes the room meanwhile.
      await dbUpdate(rec.id, r => { r.status = 'done'; r.transcript = 'Walls painted white.'; r.archived = true; });
      bytesPut = realBytesPut;
      await retryUnsaved();
      queueRunning = false;
      const end = (await dbAll()).find(r => r.id === rec.id);
      const out = { held, after: unsavedRecs.filter(r => r.roomName === 'Study').length, status: end.status, transcript: end.transcript, bytesStored: !!end.bytesStored, fb: !!end.fallbackText };
      await dbDelete(rec.id);
      try { localStorage.removeItem('pa_store_bytes'); } catch (e) {}
      return out;
    });
    check('R14: if the audio can\'t be stored at all it stays in memory with Save audio', s13.held === 1, s13);
    check('R14: and when it can, only the audio is stored: the room the queue finished meanwhile stays finished', s13.after === 0 && s13.status === 'done' && s13.transcript === 'Walls painted white.' && s13.bytesStored && s13.fb, s13);

    // 14. A write that times out is not tried again (it may still go through); a read is.
    const s14 = await page.evaluate(async () => {
      const keep = TIMING.dbMs, realOpen = openAudioDB;
      let opens = 0;
      TIMING.dbMs = 200;
      openAudioDB = () => { opens++; return new Promise(() => {}); };
      const w = await dbPut({ roomId: 'z', status: 'done', createdAt: Date.now() }).then(() => 'ok', e => e.name);
      const writeOpens = opens; opens = 0;
      const r = await dbAll().then(() => 'ok', e => e.name);
      const readOpens = opens;
      openAudioDB = realOpen; TIMING.dbMs = keep;
      return { w, writeOpens, r, readOpens };
    });
    check('R14: a timed-out write is not repeated (no double saves); a timed-out read is tried once more', s14.w === 'TimeoutError' && s14.writeOpens === 1 && s14.r === 'TimeoutError' && s14.readOpens === 2, s14);

    // 15. A recording called damaged gets one more read when the app opens.
    const s15 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { roomId: state.rooms[5].id, roomName: state.rooms[5].name, blob: new Blob([new Uint8Array(25)], { type: 'audio/webm' }),
        status: 'failed', unreadable: true, readFails: 3, finalError: 'recording damaged on this phone', autoRetries: AUTO_RETRY_MAX, archived: true });
      rec.id = await dbAdd(rec);
      roomAudioFlags[rec.roomId] = 'noaudio';
      queueRunning = true;   // look before the queue picks it up
      await retryDamagedOnce();
      const mid = (await dbAll()).find(x => x.id === rec.id);
      queueRunning = false; await processQueue();
      const end = (await dbAll()).find(x => x.id === rec.id);
      await dbDelete(rec.id);
      return { midStatus: mid.status, midUnreadable: !!mid.unreadable, flag: roomAudioFlags[rec.roomId] || '', end: end.status };
    }, base);
    check('R14: a damaged recording that reads fine on reopening goes back in the queue and is sent', s15.midStatus === 'pending' && !s15.midUnreadable && s15.flag === '' && s15.end === 'done', s15);

    // 16. Recordings screen plays a recording kept as bytes.
    const s16 = await page.evaluate(async (b) => {
      const rec = Object.assign(eval(b), { roomName: 'Laundry', blob: null, bytesStored: true, bytesSize: 12, status: 'done', archived: true, audioArchived: true });
      rec.id = await dbAdd(rec);
      await bytesPut(rec.id, new Uint8Array(12).buffer);
      await showRecordings();
      await renderRecordings();
      await new Promise(r => setTimeout(r, 300));
      const cards = [...document.querySelectorAll('#recordingsBody .recording-card')].filter(c => /Laundry/.test(c.textContent));
      const audio = cards[0] && cards[0].querySelector('audio');
      const btns = cards[0] ? [...cards[0].querySelectorAll('.rec-mini-btn')].map(x => x.textContent) : [];
      await dbDelete(rec.id);
      closeRecordings();
      return { cards: cards.length, src: !!(audio && audio.src), btns };
    }, base);
    check('R14: Recordings plays and offers Send / Save for a recording kept as bytes', s16.cards === 1 && s16.src && s16.btns.some(t => /Send/.test(t)) && s16.btns.some(t => /Save/.test(t)), s16);

    // 17. A recording's id is chosen before its first save (no second copy from a late save).
    const s17 = await page.evaluate(async () => {
      currentRecSession = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [new Blob([new Uint8Array(15)], { type: 'audio/webm' })],
        roomId: currentRoomId(), roomName: 'Pantry', address: state.address, jobId: state.jobId, subsections: [], part: 1, createdAt: Date.now() };
      queueRunning = true;
      await stopAudioRecording(currentRoomId(), 'pantry shelves', false);
      queueRunning = false;
      const mine = (await dbAll()).filter(r => r.roomName === 'Pantry');
      const out = { n: mine.length, id: mine[0] && mine[0].id };
      for (const r of mine) await dbDelete(r.id);
      return out;
    });
    check('R14: a recording gets its id before it is first saved, and is saved once', s17.n === 1 && s17.id > 1e15, s17);

    // 18. Bytes mode: a partial save still running at Done can't overwrite the final save.
    const s18 = await page.evaluate(async () => {
      localStorage.setItem('pa_store_bytes', String(Date.now()));
      const session = { mr: { state: 'inactive', mimeType: 'audio/webm' }, stream: null, chunks: [new Blob([new Uint8Array(20)], { type: 'audio/webm' })],
        roomId: currentRoomId(), roomName: 'Garage', address: state.address, jobId: state.jobId, subsections: [], part: 1, createdAt: Date.now() };
      queueRunning = true;
      const partial = persistPartialRecording(session);   // not awaited: Done comes while it runs
      session.chunks.push(new Blob([new Uint8Array(30)], { type: 'audio/webm' }));
      currentRecSession = session;
      await stopAudioRecording(currentRoomId(), 'garage floor', false);
      await partial;
      await new Promise(r => setTimeout(r, 200));
      queueRunning = false;
      const mine = (await dbAll()).filter(r => r.roomName === 'Garage');
      const bytes = mine[0] ? await bytesGet(mine[0].id) : null;
      const out = { n: mine.length, status: mine[0] && mine[0].status, size: mine[0] && mine[0].bytesSize, bytes: bytes ? bytes.byteLength : 0 };
      for (const r of mine) await dbDelete(r.id);
      localStorage.removeItem('pa_store_bytes');
      return out;
    });
    check('R14: bytes mode: a partial save running at Done never overwrites the whole recording', s18.n === 1 && s18.status === 'pending' && s18.size === 50 && s18.bytes === 50, s18);

    check('R14: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── ROUND 15 ──────────────────────────────────────────────────────────────
  {
    const page = await newPage(browser);
    const today = new Date().toLocaleDateString('en-AU', { weekday: 'long' });
    const s1 = await page.evaluate(() => ({
      chip: document.getElementById('dateChip').textContent,
      tabs: getComputedStyle(document.getElementById('tabBar')).display,
      todayCur: document.getElementById('tabToday').getAttribute('aria-current'),
      recLink: getComputedStyle(document.querySelector('.recordings-link')).display,
      gear: getComputedStyle(document.getElementById('gearBtn')).display,
      wide: document.documentElement.scrollWidth <= innerWidth
    }));
    check('R15: Start screen shows today\'s date', s1.chip.includes(today), s1.chip);
    check('R15: tab bar on the Start screen, Today selected; header shows the gear, not Recordings', s1.tabs === 'grid' && s1.todayCur === 'page' && s1.recLink === 'none' && s1.gear !== 'none', s1);
    check('R15: no horizontal scroll with the tab bar', s1.wide);

    // Settings sheet
    await page.click('#gearBtn'); await wait(650);
    const s2 = { open: await page.evaluate(() => document.getElementById('r15Sheet').classList.contains('open')),
      theme: await page.isVisible('#themeSelect'), admin: await page.isVisible('#adminSettings summary'), url: await page.isVisible('#transcribeUrl') };
    check('R15: the gear opens Settings: Appearance and Admin settings, service links still folded away', s2.open && s2.theme && s2.admin && !s2.url, s2);
    await page.keyboard.press('Escape'); await wait(300);
    check('R15: Escape closes the sheet', await page.evaluate(() => !document.getElementById('r15Sheet').classList.contains('open')));

    // Settings sheet drags closed
    await page.evaluate(() => openSettings()); await wait(650);
    const top = await page.$('#r15Top .sheet-title');
    const tb = await top.boundingBox();
    await page.mouse.move(tb.x + 10, tb.y + 5); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(tb.x + 10, tb.y + 5 + i * 40); await wait(16); }
    await page.mouse.up(); await wait(500);
    check('R15: dragging the sheet down by its top closes it', await page.evaluate(() => !document.getElementById('r15Sheet').classList.contains('open') && !document.body.classList.contains('sheet-open')));

    // Add custom room (Start screen)
    await page.click('.add-room-btn'); await wait(500);
    await page.fill('#newRoomName', 'Granny Flat'); await page.press('#newRoomName', 'Enter'); await wait(300);
    const s3 = await page.evaluate(() => { const t = [...document.querySelectorAll('#roomsSelect .room-toggle')].filter(d => d.textContent === 'Granny Flat'); return { n: t.length, sel: t[0] && t[0].classList.contains('selected'), lib: ROOM_LIBRARY.some(r => r.name === 'Granny Flat') }; });
    check('R15: Add custom room is a sheet; the new room is added and ticked', s3.n === 1 && s3.sel && s3.lib, s3);
    await page.click('.add-room-btn'); await wait(500);
    await page.fill('#newRoomName', 'study'); await page.click('#r15Foot .btn-primary'); await wait(300);
    const s4 = await page.evaluate(() => { const t = [...document.querySelectorAll('#roomsSelect .room-toggle')].filter(d => d.textContent.toLowerCase() === 'study'); return { n: t.length, sel: t[0] && t[0].classList.contains('selected') }; });
    check('R15: a name already on the list ticks that room instead of adding a copy', s4.n === 1 && s4.sel, s4);
    await page.click('.add-room-btn'); await wait(500);
    await page.click('#r15Foot .btn-primary'); await wait(200);
    check('R15: an empty name says what to do', await page.evaluate(() => !document.getElementById('newRoomErr').hidden && /Type a room name/.test(document.getElementById('newRoomErr').textContent)));
    await page.evaluate(() => closeR15Sheet()); await wait(400);

    // Room order on the Start screen
    await page.evaluate(() => setAllRooms(false));
    await page.evaluate(() => { ['front_gardens', 'garage', 'entry', 'lounge'].forEach(id => document.querySelector(`#roomsSelect [data-id="${id}"]`).classList.add('selected')); });
    await page.click('#btnRoomsOrder'); await wait(650);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#ordList .ord-name')].map(x => x.textContent));
    check('R15: Change order lists the ticked rooms in order', JSON.stringify(rows) === JSON.stringify(['Front Gardens', 'Garage/Carport', 'Entry', 'Lounge']), rows);
    const g0 = await (await page.$$('#ordList .ord-grip'))[0].boundingBox();
    await page.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2 + i * 10); await wait(20); }
    const mid = await page.evaluate(() => [...document.querySelectorAll('#ordList .ord-row')].map(r => r.querySelector('.ord-n').textContent + r.querySelector('.ord-name').textContent));
    await page.mouse.up(); await wait(500);
    const s5 = await page.evaluate(() => [...document.querySelectorAll('#roomsSelect .room-toggle.selected')].map(d => d.textContent));
    check('R15: numbers update while dragging', mid[0] === '3Front Gardens', mid);
    check('R15: dropping a room moves it on the Start list', JSON.stringify(s5) === JSON.stringify(['Garage/Carport', 'Entry', 'Front Gardens', 'Lounge']), s5);
    await page.evaluate(() => closeR15Sheet()); await wait(400);

    // Today on this phone + tab badge + Recordings tab
    await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
      await dbAdd({ roomId: 'kitchen', roomName: 'Kitchen', address: '9 Demo Street, Testville', jobId: 'job-test-today', blob, type: 'audio/webm', status: 'pending', createdAt: Date.now(), attempts: 0 });
      await updatePendingUI();
    });
    await wait(200);
    const s6 = await page.evaluate(() => ({ shown: !document.getElementById('todayJobs').hidden, text: document.getElementById('todayList').textContent,
      badge: document.getElementById('tabRecBadge').hidden ? 0 : +document.getElementById('tabRecBadge').textContent,
      card: getComputedStyle(document.getElementById('syncCard')).display !== 'none' ? parseInt(document.getElementById('syncCardTitle').textContent) : 0 }));
    check('R15: Today on this phone lists today\'s job with what is still sending', s6.shown && /9 Demo Street/.test(s6.text) && /1 room/.test(s6.text) && /sending/.test(s6.text), s6);
    check('R15: Recordings tab badge matches the sending card', s6.badge >= 1 && s6.badge === s6.card, s6);
    await page.click('#tabRecs'); await wait(400);
    const s7 = await page.evaluate(() => ({ rec: document.getElementById('screenRecordings').classList.contains('active'), tabs: document.body.classList.contains('r15-tabs'),
      back: getComputedStyle(document.querySelector('#screenRecordings .rec-back')).display, cur: document.getElementById('tabRecs').getAttribute('aria-current') }));
    check('R15: Recordings tab opens Recordings with the tab bar, no Back button', s7.rec && s7.tabs && s7.back === 'none' && s7.cur === 'page', s7);
    await page.click('#tabToday'); await wait(400);
    check('R15: Today tab goes back to the Start screen', await page.evaluate(() => document.getElementById('screenSetup').classList.contains('active')));
    await page.click('#todayList .today-job'); await wait(400);
    check('R15: tapping a job opens Recordings', await page.evaluate(() => document.getElementById('screenRecordings').classList.contains('active')));
    await page.evaluate(async () => { closeRecordings(); for (const r of await dbAll()) if (r.jobId === 'job-test-today') await dbDelete(r.id); await updatePendingUI(); });
    const sNo = await page.evaluate(async () => {
      const id = await dbAdd({ roomId: 'toilet', roomName: 'Toilet', address: '2 No Audio Rd', jobId: 'job-noaudio', status: 'failed', noAudio: true, createdAt: Date.now() });
      await updatePendingUI();
      const txt = document.getElementById('todayList').textContent;
      await dbDelete(id); await updatePendingUI();
      return txt;
    });
    check('R15: a job with a room that has no audio never shows "All in Dropbox"', /2 No Audio Rd/.test(sNo) && /with no audio/.test(sNo) && !/2 No Audio Rd[^]*?All in Dropbox/.test(sNo.split('2 No Audio Rd')[1] ? '2 No Audio Rd' + sNo.split('2 No Audio Rd')[1].split(/\d+ room/)[0] : ''), sNo);

    // Unreadable wording
    const s8 = await page.evaluate(async () => {
      const id = await dbAdd({ roomId: 'laundry', roomName: 'Laundry', address: 'X', jobId: 'job-u', blob: new Blob([new Uint8Array(4)]), status: 'failed', unreadable: true, createdAt: Date.now() });
      await showRecordings(); await renderRecordings();
      const txt = document.getElementById('recordingsBody').textContent;
      await dbDelete(id); closeRecordings();
      return txt;
    });
    check('R15/16: Recordings says "Unreadable" (chip) and asks to record again, not "Damaged"', /Unreadable/.test(s8) && /Please record the room again/.test(s8) && !/Damaged/.test(s8), s8.slice(0, 200));

    check('R15: no script errors on the Start screen', page.__errors.length === 0, page.__errors);
    await page.close();
  }
  {
    // Inspection: order, hold a tab, add room, checklist, swipe
    const page = await newPage(browser);
    await page.evaluate(() => { setAllRooms(false); ['front_gardens', 'garage', 'entry', 'lounge'].forEach(id => document.querySelector(`#roomsSelect [data-id="${id}"]`).classList.add('selected')); });
    await startJob(page, '15 Round Street');
    const s9 = await page.evaluate(() => ({ order: state.rooms.map(r => r.name), tools: document.getElementById('roomTools').textContent, tabs: document.body.classList.contains('r15-tabs'),
      recLink: getComputedStyle(document.querySelector('.recordings-link')).display }));
    check('R15: the Start screen order is the inspection order', JSON.stringify(s9.order) === JSON.stringify(['Front Gardens', 'Garage/Carport', 'Entry', 'Lounge']), s9.order);
    check('R15: room tools offer Room order instead of Move left / Move right', /Room order/.test(s9.tools) && !/Move left|Move right/.test(s9.tools), s9.tools);
    check('R15: no tab bar on the room screen; Recordings stays in the header', !s9.tabs && s9.recLink !== 'none', s9);

    await page.evaluate(() => { state.currentRoomIdx = 1; renderInspection(); });
    await page.evaluate(() => openRoomOrder('room')); await wait(650);
    const cur0 = await page.evaluate(() => document.querySelector('#ordList .ord-here') && document.querySelector('#ordList .ord-here').closest('.ord-row').dataset.id);
    await page.focus('#ordList .ord-row:first-child .ord-grip'); await page.keyboard.press('ArrowDown'); await wait(400);
    const s10 = await page.evaluate(() => ({ order: state.rooms.map(r => r.name), cur: state.rooms[state.currentRoomIdx].name, tab: document.querySelector('.room-tab.active').textContent }));
    check('R15: Room order marks the current room', cur0 === 'garage', cur0);
    check('R15: moving a room keeps you on the same room', JSON.stringify(s10.order) === JSON.stringify(['Garage/Carport', 'Front Gardens', 'Entry', 'Lounge']) && s10.cur === 'Garage/Carport' && /Garage/.test(s10.tab), s10);
    await page.evaluate(() => closeR15Sheet()); await wait(400);

    await page.evaluate(() => openSettings()); await wait(500);
    const sAdm = await page.evaluate(() => ({ adm: document.getElementById('adminSettings').hidden, theme: !!document.querySelector('#r15Settings #themeSelect') }));
    await page.evaluate(() => closeR15Sheet()); await wait(400);
    check('R15: during a job Settings shows Appearance only; service links are hidden', sAdm.adm && sAdm.theme, sAdm);
    await page.evaluate(() => { window.__toasts = []; listeningRoom = currentRoomId(); addRoom(); });
    const sAdd = await page.evaluate(() => ({ open: document.getElementById('r15Sheet').classList.contains('open'), toast: window.__toasts.join('|') }));
    await page.evaluate(() => { listeningRoom = null; });
    check('R15: no adding a room while recording; it says Tap Done first', !sAdd.open && /Tap Done first/.test(sAdd.toast), sAdd);
    await page.evaluate(() => openRoomOrder('room')); await wait(650);
    const before = await page.evaluate(() => state.rooms.map(r => r.id).join());
    const gg = await (await page.$$('#ordList .ord-grip'))[0].boundingBox();
    await page.mouse.move(gg.x + 20, gg.y + 20); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(gg.x + 20, gg.y + 20 + i * 12); await wait(16); }
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })));
    await page.mouse.up(); await wait(500);
    const sCan = await page.evaluate(() => ({ order: state.rooms.map(r => r.id).join(), nums: [...document.querySelectorAll('#ordList .ord-row')].map(r => r.querySelector('.ord-n').textContent).join() }));
    await page.evaluate(() => closeR15Sheet()); await wait(400);
    check('R15: an interrupted drag puts the rooms back', sCan.order === before && sCan.nums === '1,2,3,4', { sCan, before });
    await page.evaluate(() => { window.__toasts = []; listeningRoom = currentRoomId(); openRoomOrder('room'); });
    const s11 = await page.evaluate(() => ({ open: document.getElementById('r15Sheet').classList.contains('open'), toast: window.__toasts.join('|') }));
    await page.evaluate(() => { listeningRoom = null; });
    check('R15: no reordering while recording; it says Tap Done first', !s11.open && /Tap Done first/.test(s11.toast), s11);

    const tab = await (await page.$$('.room-tab'))[2].boundingBox();
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2); await page.mouse.down(); await wait(700); await page.mouse.up(); await wait(400);
    const s12 = await page.evaluate(() => ({ open: document.getElementById('r15Sheet').classList.contains('open'), mode: !document.getElementById('r15Order').hidden, cur: state.rooms[state.currentRoomIdx].name }));
    check('R15: press and hold a room tab opens Room order, and does not switch rooms', s12.open && s12.mode && s12.cur === 'Garage/Carport', s12);
    await page.evaluate(() => closeR15Sheet()); await wait(400);

    await page.evaluate(() => addRoom()); await wait(600);
    const picks = await page.evaluate(() => [...document.querySelectorAll('#newRoomPicks .r15-pick')].map(b => b.textContent));
    check('R15: Add room on a room offers the app\'s other rooms', picks.includes('Study') && !picks.includes('Entry'), picks.slice(0, 6));
    await page.fill('#newRoomName', 'entry'); await page.click('#r15Foot .btn-primary'); await wait(200);
    check('R15: a room already in the job is refused with a short message', await page.evaluate(() => !document.getElementById('newRoomErr').hidden && document.getElementById('r15Sheet').classList.contains('open')));
    await page.click('#newRoomPicks [data-pick="Study"]'); await page.click('#r15Foot .btn-primary'); await wait(400);
    const s13 = await page.evaluate(() => ({ order: state.rooms.map(r => r.name), cur: state.rooms[state.currentRoomIdx].name, rows: state.rooms.find(r => r.name === 'Study').subsections.length }));
    check('R15: a picked room goes in after the current room with its own rows', JSON.stringify(s13.order) === JSON.stringify(['Garage/Carport', 'Study', 'Front Gardens', 'Entry', 'Lounge']) && s13.cur === 'Study' && s13.rows > 5, s13);

    // Checklist
    await page.evaluate(() => { if (!checklistOpen) toggleChecklist(); });
    await page.click('#checklistBox .cl-actions button:first-child'); await wait(100);
    const s14 = await page.evaluate(() => ({ all: [...document.querySelectorAll('#checklistBox .checklist-item')].every(x => x.classList.contains('done')), bar: document.getElementById('nextSub').textContent }));
    await page.click('#checklistBox .cl-actions button:last-child'); await wait(100);
    const s15 = await page.evaluate(() => ({ none: [...document.querySelectorAll('#checklistBox .checklist-item')].every(x => !x.classList.contains('done')), label: document.querySelector('#nextSub .ns-label').textContent, saved: Object.keys(state.checked[currentRoomId()] || {}).length }));
    check('R15: Check all ticks every row', s14.all && /All rows/.test(s14.bar), s14);
    check('R15: Uncheck all clears them, and the bar counts (0 of N)', s15.none && /^Next · 0 of \d+$/.test(s15.label) && s15.saved === 0, s15);
    await page.evaluate(() => { if (checklistOpen) toggleChecklist(); });

    // Swipe between rooms
    const swipe = async (from, to) => {
      const h = await (await page.$('.room-title')).boundingBox();
      const y = h.y + h.height / 2;
      await page.mouse.move(from, y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(from + (to - from) * i / 8, y); await wait(12); }
      await page.mouse.up(); await wait(700);
      return page.evaluate(() => state.currentRoomIdx);
    };
    await page.evaluate(() => { state.currentRoomIdx = 0; renderInspection(); });
    {
      const h = await (await page.$('.room-title')).boundingBox(); const y = h.y + h.height / 2;
      await page.mouse.move(330, y); await page.mouse.down();
      for (let i = 1; i <= 4; i++) { await page.mouse.move(330 - i * 30, y); await wait(16); }
      const m = await page.evaluate(() => getComputedStyle(document.getElementById('roomContent')).transform);
      await page.mouse.move(330, y); await page.mouse.up(); await wait(600);
      check('R15: the room really follows the finger during a swipe (not held by the rise-in animation)', m !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(m), m);
    }
    check('R15: swiping right on the first room stays there', await swipe(80, 330) === 0);
    check('R15: swiping left goes to the next room', await swipe(330, 40) === 1);
    check('R15: swiping right goes back', await swipe(60, 340) === 0);
    {
      const h = await (await page.$('.room-title')).boundingBox(); const y = h.y + h.height / 2;
      await page.mouse.move(330, y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(330 - i * 36, y); await wait(12); }
      await page.mouse.up(); await wait(320);   // after the 200 ms slide, inside the old 400 ms swallow window
      await page.click('#btnPrevRoom'); await wait(300);
      check('R15: a tap straight after a swipe still works', await page.evaluate(() => state.currentRoomIdx) === 0);
    }
    await page.evaluate(() => { listeningRoom = currentRoomId(); });
    const lockIdx = await swipe(330, 40);
    await page.evaluate(() => { listeningRoom = null; });
    check('R15: no swiping to another room while recording', lockIdx === 0, lockIdx);
    check('R15: the room content is back in place after swipes', await page.evaluate(() => { const t = document.getElementById('roomContent').style.transform; return !t || t === 'none'; }));

    // Fix a word sheet drags closed
    await page.evaluate(() => { document.getElementById('fixSheet').classList.add('open'); document.getElementById('fixBackdrop').classList.add('open'); document.body.classList.add('sheet-open'); });
    await wait(650);
    const fh = await (await page.$('#fixSheet .sheet-title')).boundingBox();
    await page.mouse.move(fh.x + 10, fh.y + 5); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(fh.x + 10, fh.y + 5 + i * 45); await wait(16); }
    await page.mouse.up(); await wait(500);
    check('R15: the Fix a word sheet drags down to close', await page.evaluate(() => !document.getElementById('fixSheet').classList.contains('open')));

    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => { showScreen('screenSetup'); });
    check('R15: Start screen fits at 320 px with the tab bar', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check('R15: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 16: Recordings by date, mandatory items on Start, inventory rows ──
  {
    const ARCH = '9ecaffe4859311f181ad1607ee4eb77e';
    const puts = [];
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
      if (u.includes(ARCH) && !u.includes('action=log')) {
        const path = decodeURIComponent((u.match(/path=([^&]*)/) || [])[1] || '');
        puts.push(path);
        const size = (u.match(/[?&]size=(\d+)/) || [])[1];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({ ok: true, path: '/x/' + path.split('/').pop() }, size ? { size: Number(size) } : {})) });
      }
      if (u.includes('7e43f138ad2311f186b71607ee4eb77e')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"transcript":"Walls painted white.","engine":"assemblyai","words":[]}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });

    // 1. Recordings: one fold per day, newest open; jobs inside; rooms in recorded order.
    const r1 = await page.evaluate(async () => {
      const day = 864e5, now = Date.now();
      // Today's two rooms stay on today even just after midnight.
      const t40 = Math.max(now - 40 * 60000, new Date(now).setHours(0, 0, 0, 0) + 1000), t20 = Math.max(now - 20 * 60000, t40 + 1);
      const mk = (o) => dbAdd(Object.assign({ blob: new Blob([new Uint8Array(30)], { type: 'audio/webm' }), type: 'audio/webm', status: 'done', archived: true, audioArchived: true, subsections: [], part: 1 }, o));
      const ids = [];
      ids.push(await mk({ roomId: 'kitchen', roomName: 'Kitchen', address: '9 Demo Street', jobId: 'R16A', createdAt: t20, status: 'pending', archived: false, audioArchived: false, nextTryAt: now + 3600e3, archNextAt: now + 3600e3 }));
      ids.push(await mk({ roomId: 'entry', roomName: 'Entry', address: '9 Demo Street', jobId: 'R16A', createdAt: t40, transcript: 'Front door painted white.' }));
      ids.push(await mk({ roomId: 'lounge', roomName: 'Lounge', address: '3 Mock Street', jobId: 'R16B', createdAt: now - day }));
      ids.push(await mk({ roomId: 'entry', roomName: 'Entry', address: '101b Example Street', jobId: 'R16C', createdAt: now - 3 * day, status: 'failed', unreadable: true, archived: true, audioArchived: false }));
      showRecordings();
      await new Promise(r => setTimeout(r, 300));
      const days = [...document.querySelectorAll('#recordingsBody .rec-day')];
      const out = {
        n: days.length,
        labels: days.map(d => d.querySelector('.rd-name').textContent),
        open: days.map(d => d.open),
        todayRooms: [...days[0].querySelectorAll('.rec-card-room')].map(x => x.textContent),
        todayJob: days[0].querySelector('.rd-addr') && days[0].querySelector('.rd-addr').textContent,
        chips0: days[0].querySelector('.rd-chips').textContent,
        chips2: days[2].querySelector('.rd-chips').textContent,
        ids
      };
      return out;
    });
    check('R16: Recordings grouped by day, newest first, only the newest day open', r1.n === 3 && r1.labels[0] === 'Today' && r1.labels[1] === 'Yesterday' && r1.open.join() === 'true,false,false', r1);
    check('R16: inside a day, the property heading, then its rooms in the order recorded', r1.todayJob === '9 Demo Street' && r1.todayRooms.join() === 'Entry,Kitchen', r1);
    check('R16: each day says what is still sending or unreadable', /1 sending/.test(r1.chips0) && /1 unreadable/.test(r1.chips2), r1);

    // 2. A day opened stays open when the list redraws (it does as recordings send).
    const r2 = await page.evaluate(async () => {
      const d = document.querySelectorAll('#recordingsBody .rec-day')[1];
      d.open = true; d.dispatchEvent(new Event('toggle'));
      await renderRecordings();
      return [...document.querySelectorAll('#recordingsBody .rec-day')].map(x => x.open).join();
    });
    check('R16: a day you opened stays open when the list redraws', r2 === 'true,true,false', r2);

    // 3. No redraw while a recording is playing; it catches up when playback stops.
    const r3 = await page.evaluate(async () => {
      const a = document.querySelector('#recordingsBody audio');
      Object.defineProperty(a, 'paused', { configurable: true, get: () => false });
      const before = document.querySelector('#recordingsBody .rec-day');
      await renderRecordings();
      const kept = document.querySelector('#recordingsBody .rec-day') === before && recRenderPending === true;
      Object.defineProperty(a, 'paused', { configurable: true, get: () => true });
      a.dispatchEvent(new Event('pause'));
      await new Promise(r => setTimeout(r, 600));
      const redrawn = document.querySelector('#recordingsBody .rec-day') !== before && recRenderPending === false;
      return { kept, redrawn };
    });
    check('R16: the list doesn\'t redraw (and stop the audio) while a recording plays; it catches up after', r3.kept && r3.redrawn, r3);
    const r3b = await page.evaluate(async () => {
      const d = document.querySelector('#recordingsBody .rec-transcript');
      d.open = true; d.dispatchEvent(new Event('toggle'));
      await renderRecordings();
      const again = document.querySelector('#recordingsBody .rec-transcript');
      return { open: again.open, same: again === d };
    });
    check('R16: an open "Show text" stays open when the list redraws', r3b.open && !r3b.same, r3b);
    await page.evaluate(async (ids) => { for (const id of ids) await dbDelete(id); closeRecordings(); }, r1.ids);

    // 4. Mandatory items on the Start screen, kept through a reload, into the job at Start.
    await page.fill('#mand-setup-waterMeter', '1234.5 kL');
    await page.fill('#mand-setup-rcdBox', 'All on');
    await page.reload();
    await page.waitForSelector('#setupMandatory');
    const r4a = await page.evaluate(() => ({ wm: document.getElementById('mand-setup-waterMeter').value, rcd: document.getElementById('mand-setup-rcdBox').value, n: document.querySelectorAll('#setupMandatory input[data-mand]').length }));
    check('R16: Start screen has the five mandatory fields, kept if the app reloads before Start', r4a.n === 5 && r4a.wm === '1234.5 kL' && r4a.rcd === 'All on', r4a);
    await page.evaluate(() => { const o = window.showToast; window.__toasts = []; window.showToast = (m) => { window.__toasts.push(m); o(m); }; });
    const r4fail = await page.evaluate(() => {
      document.getElementById('propAddress').value = '16 Round St'; document.getElementById('propClient').value = 'C'; document.getElementById('propInspector').value = 'B';
      setAllRooms(false); startInspection();
      const kept = document.getElementById('mand-setup-waterMeter').value;
      setAllRooms(true);
      return { kept, toast: window.__toasts.some(t => /at least one room/.test(t)) };
    });
    check('R16: if Start is refused (no rooms ticked), the mandatory items typed are kept', r4fail.toast && r4fail.kept === '1234.5 kL', r4fail);
    await startJob(page, '16 Round St');
    const r4b = await page.evaluate(() => ({
      m: state.mandatory, startEmpty: [...document.querySelectorAll('#setupMandatory input[data-mand]')].every(i => !i.value),
      kept: localStorage.getItem('pa_setup_mandatory'), onRoom: !!document.querySelector('#roomContent .mandatory-section, #roomContent [data-mand]')
    }));
    check('R16: Start puts them into the job; the Start fields are cleared for the next job', r4b.m.waterMeter === '1234.5 kL' && r4b.m.rcdBox === 'All on' && r4b.m.gasMeter === '' && r4b.startEmpty && r4b.kept === null, r4b);
    check('R16: mandatory items are no longer on the first room', r4b.onRoom === false, r4b);

    // 5. Review: editable, and the "Before you finish" line updates as they're filled.
    const r5 = await page.evaluate(async () => {
      // R20: photos are required too; these checks are about the typed fields, so the photos are in.
      state.mandPhotos = { waterMeter: [{ id: -1, n: 1, uploaded: true }], rcdBox: [{ id: -2, n: 1, uploaded: true }], gasMeter: [{ id: -3, n: 1, uploaded: true }], nbnBox: [{ id: -4, n: 1, uploaded: true }] };
      showReview();
      await new Promise(r => setTimeout(r, 200));
      const fold = document.getElementById('reviewMandatory');
      const open = fold.open;
      const row = document.getElementById('attnMandatory');
      const before = row && row.textContent;
      const set = (k, v) => { const i = document.getElementById('mand-review-' + k); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
      set('gasMeter', '01234 m3');
      const mid = document.getElementById('reviewMandSub').textContent;
      set('nbnBox', 'Laundry');
      return { open, before, mid, after: document.getElementById('reviewMandSub').textContent, rowHidden: row ? row.hidden : null,
        saved: (flushSaveState(), loadSaved().mandatory.nbnBox), report: /NBN Box: Laundry/.test(buildReportText()) };
    });
    check('R16: Review opens the mandatory items when some are missing, and they can be typed there', r5.open && /Gas Meter Reading, NBN Box/.test(r5.before || '') && r5.mid === '1 still needed' && r5.after === 'All done', r5);
    check('R16: filling them clears the "Before you finish" line; saved with the job and in the details file', r5.rowHidden === true && r5.saved === 'Laundry' && r5.report, r5);
    const r5b = await page.evaluate(async () => {
      showReview(); await new Promise(r => setTimeout(r, 150));
      const had = !!document.getElementById('attnMandatory');
      const i = document.getElementById('mand-review-nbnBox'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true }));
      const row = document.getElementById('attnMandatory');
      const shown = !!row && !row.hidden && getComputedStyle(row).display !== 'none' && /NBN Box/.test(row.textContent);
      i.value = 'Laundry'; i.dispatchEvent(new Event('input', { bubbles: true }));
      return { had, shown, hiddenAgain: getComputedStyle(document.getElementById('attnMandatory')).display === 'none' };
    });
    check('R16: on Review, clearing a mandatory item brings the "Before you finish" line back', !r5b.had && r5b.shown && r5b.hiddenAgain, r5b);
    await page.evaluate(() => showScreen('screenInspection'));

    // 6. Inventory rows: item, serial, camera, Add item; the files keep the same two texts.
    const r6 = await page.evaluate(async () => {
      state.currentRoomIdx = state.rooms.findIndex(r => r.id === 'kitchen'); renderInspection();
      const rid = 'kitchen';
      const rowsEl = () => [...document.querySelectorAll('#invRows-' + rid + ' .inv-row')];
      const startRows = rowsEl().length;
      const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      type(rowsEl()[0].querySelector('[data-inv$="|item"]'), 'Dishwasher');
      type(rowsEl()[0].querySelector('[data-inv$="|serial"]'), 'Bosch SMS46');
      document.querySelector('.inv-add').click();
      type(rowsEl()[1].querySelector('[data-inv$="|item"]'), '2 x remotes');
      document.querySelector('.inv-add').click();
      type(rowsEl()[2].querySelector('[data-inv$="|item"]'), 'Oven');
      // A photo of the oven's plate.
      const ovenId = rowsEl()[2].dataset.row;
      invPhotoTarget = { roomId: rid, rowId: ovenId };
      const fake = { files: [new File([new Uint8Array(64)], 'plate.jpg', { type: 'image/jpeg' })], value: 'x' };
      await onInvPhotoChosen(fake);
      await new Promise(r => setTimeout(r, 200));
      const ph = (await photoAll()).filter(p => p.invRowId === ovenId);
      const count = document.getElementById('invCount-' + rid).textContent;
      return {
        startRows, rows: rowsEl().length, inv: state.inventory[rid], ser: state.serialModels[rid], count,
        photo: ph.length, photoItem: ph[0] && ph[0].item, rowPhotos: (state.invItems[rid].find(r => r.id === ovenId) || {}).photos.length,
        thumb: !!rowsEl()[2].querySelector('.inv-cam.has img'), saved: (flushSaveState(), (loadSaved().invItems[rid] || []).length),
        review: (showReview(), document.getElementById('reviewBody').textContent)
      };
    });
    check('R16: inventory shows item rows (item, serial, camera) with Add item', r6.startRows === 1 && r6.rows === 3 && r6.thumb && r6.saved === 3, r6);
    check('R16: rows write the same Inventory and Serial/model texts the files use', r6.inv === '2 x remotes' && r6.ser === 'Dishwasher: Bosch SMS46; Oven: see photo' && /2 x remotes/.test(r6.review) && /Dishwasher: Bosch SMS46/.test(r6.review), r6);
    check('R16: the camera tile saves a photo for that item', r6.photo === 1 && r6.photoItem === 'Oven' && r6.rowPhotos === 1 && /3 items · 1 photo/.test(r6.count), r6);
    await wait(1500);
    const plate = puts.find(x => /Serial plate - Oven \d+\.jpg$/.test(x));
    check('R16: the photo goes to Dropbox named after its item', !!plate, puts.filter(x => /Photos/.test(x)));

    // 6b. A name typed after the photo still names it (photo not sent yet).
    const r6b = await page.evaluate(async () => {
      showScreen('screenInspection');
      state.currentRoomIdx = state.rooms.findIndex(r => r.id === 'kitchen'); renderInspection();
      const rid = 'kitchen';
      const keepQ = processPhotoQueue; processPhotoQueue = async () => {};
      document.querySelector('.inv-add').click();
      const row = state.invItems[rid][state.invItems[rid].length - 1];
      invPhotoTarget = { roomId: rid, rowId: row.id };
      await onInvPhotoChosen({ files: [new File([new Uint8Array(12)], 'p.jpg', { type: 'image/jpeg' })], value: '' });
      const inp = document.querySelector(`[data-row="${row.id}"] [data-inv$="|item"]`);
      inp.value = 'Rangehood'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1200));
      const p = await photoGet(row.photos[0]);
      processPhotoQueue = keepQ;
      const name = invItemNameForPhoto(p);
      window.confirm = () => true; await removeInvItem(rid, row.id);
      return { item: p.item, name };
    });
    check('R16: an item named after its photo was taken still names the photo', r6b.item === 'Rangehood' && r6b.name === 'Rangehood', r6b);

    // 7. Removing a row takes its unsent photo with it; a room from before round 16 gets rows from its text.
    const r7 = await page.evaluate(async () => {
      showScreen('screenInspection');
      state.currentRoomIdx = state.rooms.findIndex(r => r.id === 'kitchen'); renderInspection();
      const rid = 'kitchen';
      const row = state.invItems[rid][1];   // 2 x remotes
      window.confirm = () => true;
      await removeInvItem(rid, row.id);
      const afterRemove = { rows: state.invItems[rid].length, inv: state.inventory[rid] };
      // Unsent photo: add one to a fresh row, then remove the row.
      document.querySelector('.inv-add').click();
      const newRow = state.invItems[rid][state.invItems[rid].length - 1];
      invPhotoTarget = { roomId: rid, rowId: newRow.id };
      processPhotoQueue = async () => {};   // keep it unsent
      await onInvPhotoChosen({ files: [new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' })], value: '' });
      const pid = newRow.photos[0];
      await removeInvItem(rid, newRow.id);
      const gone = !(await photoAll()).some(p => p.id === pid);
      // Legacy room: typed text, no rows.
      const lr = state.rooms.find(r => r.id === 'laundry') ? 'laundry' : state.rooms[2].id;
      delete state.invItems[lr];
      state.inventory[lr] = '1 x window key, 4 x chairs'; state.serialModels[lr] = 'HWS Rheem 260L SN 12345678';
      state.currentRoomIdx = state.rooms.findIndex(r => r.id === lr); renderInspection();
      const legacyRows = [...document.querySelectorAll('#invRows-' + lr + ' .inv-row')].length;
      syncInvText(lr);
      return { afterRemove, gone, legacyRows, inv: state.inventory[lr], ser: state.serialModels[lr] };
    });
    check('R16: removing an item updates the texts; its unsent photo is deleted', r7.afterRemove.inv === '' && r7.gone, r7);
    check('R16: a room typed before round 16 opens as rows, and its texts stay exactly the same', r7.legacyRows === 2 && r7.inv === '1 x window key, 4 x chairs' && r7.ser === 'HWS Rheem 260L SN 12345678', r7);

    // 7b. Back from another app: a cut-off send starts again at once, without using up a try.
    const r7b = await page.evaluate(async () => {
      const vis = v => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); };
      const rec = { roomId: state.rooms[3].id, roomName: state.rooms[3].name, address: state.address, jobId: state.jobId, subsections: [], part: 1, roughText: '', type: 'audio/webm',
        createdAt: Date.now(), blob: new Blob([new Uint8Array(40)], { type: 'audio/webm' }), status: 'uploading', attempts: 2, nextTryAt: Date.now() + 5 * 60000 };
      rec.id = await dbAdd(rec);
      // A pass that was mid-send when the phone paused the app.
      queueRunning = true; const stuckRun = queueRunId;
      // A quick look away (under 15 s) leaves it alone.
      vis('hidden'); vis('visible');
      await new Promise(r => setTimeout(r, 300));
      const shortLeft = queueRunning === true && queueRunId === stuckRun;
      // Away for 20 s.
      vis('hidden'); appHiddenAt = Date.now() - 20000; vis('visible');
      let end = null;
      for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 200)); end = (await dbAll()).find(x => x.id === rec.id); if (end && end.status === 'done') break; }
      const out = { shortLeft, status: end.status, attempts: end.attempts, newRun: queueRunId !== stuckRun, cutOff: (appReturnedAt = Date.now() - 1000, sendCutOffByApp()) };
      await dbDelete(rec.id);
      return out;
    });
    check('R16: back from another app after 15 s+, a cut-off send starts again at once (a quick glance away changes nothing)', r7b.shortLeft && r7b.newRun && r7b.status === 'done', r7b);
    check('R16: a send cut off by the app being in the background doesn\'t use up a try', r7b.attempts === 2 && r7b.cutOff === true, r7b);

    // 8. Finish clears the rows and the mandatory items.
    const r8 = await page.evaluate(async () => {
      window.prompt = () => 'FINISH'; window.confirm = () => true; window.alert = () => {};
      await finishAndClear();
      return { inv: JSON.stringify(state.invItems), m: state.mandatory.waterMeter, startEmpty: [...document.querySelectorAll('#setupMandatory input[data-mand]')].every(i => !i.value) };
    });
    check('R16: Finish clears inventory rows and mandatory items', r8.inv === '{}' && r8.m === '' && r8.startEmpty, r8);
    check('R16: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 17: Stirling Street fixes ───────────────────────────────────────
  {
    const page = await newPage(browser);
    await startJob(page, '12/34 Sample Street, Testing Vale');
    check('R17 (updated R21): Admin settings shows app version 21', /app version 21/.test(await page.textContent('#adminSettings summary')));
    const sw = require('fs').readFileSync(__dirname + '/../sw.js', 'utf8');
    check('R17 (updated R21): service worker cache is v25', /pa-inspect-v25/.test(sw));

    // Shared helper in the page: words from [seconds, sentence] pairs.
    await page.evaluate(() => {
      window.__words = (said) => { const w = []; said.forEach(([t, s]) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean).forEach((x, i) => w.push({ w: x, s: t + i * 0.2 }))); return w; };
      window.__rec = (o) => Object.assign({ roomId: 'r17_' + o.roomName, address: state.address, jobId: state.jobId, meta: inspectionMeta(), type: 'audio/webm',
        blob: new Blob([new Uint8Array(20)]), engine: 'assemblyai', status: 'done', createdAt: Date.now() + (o.part || 1), roomNo: 1, part: 1, cleanedBy: 'claude-sonnet-5-5', check: [] }, o);
    });

    // 1. Row times: Stirling kitchen underbench is 1:07, not 0:38.
    const t1 = await page.evaluate(() => {
      const said = [[33, 'we have overhead cupboards 11 white laminate overhead cupboard doors no handles are present'], [38, 'we have interior is a white laminate'],
        [40, '5 cupboards have 2 white laminate shelves 4 cupboards have only 1 white laminate shelf'], [52, 'drawers we have 3 white laminate drawers no handles are present'],
        [64, 'interior surrounds is a white middle base is a white laminate top drawer has one white plastic cutlery tray'],
        [67, 'underbench cupboards 4 white laminate underbench cupboard doors no handles are present'], [72, 'here\'s a white laminate with one white laminate shelf'],
        [74, 'the cupboard underneath the sink has one white and grey plastic bin']];
      const subs = templateRowsForName('Kitchen');
      const rec = __rec({ roomName: 'Kitchen', subsections: subs, words: __words(said), transcript: said.map(x => x[1]).join(' '),
        sections: [
          { name: 'Overhead Cupboards', text: 'Eleven white laminate overhead cupboard doors, no handles are present. Interior is a white laminate. Five cupboards have two white laminate shelves.' },
          { name: 'Drawers', text: 'Three white laminate drawers, no handles are present. Interior surrounds are white metal and base is white laminate.' },
          { name: 'Underbench Cupboards', text: 'Four white laminate underbench cupboard doors, no handles are present. Interior is a white laminate with one white laminate shelf. The cupboard underneath the sink has one white and grey plastic bin.' }] });
      const m = buildJobModel([rec], {});
      const row = n => m.rooms[0].rows.find(r => r.name === n) || {};
      return { under: row('Underbench Cupboards').label, over: row('Overhead Cupboards').label, drawers: row('Drawers').label };
    });
    check('R17: a row starts where its first sentence was said (Stirling underbench 1:07, not 0:38)', t1.under === '1:07' && t1.over === '0:33' && t1.drawers === '0:52', t1);

    // 2. Known mishears are highlighted even when the AI flagged nothing (Stirling Bedroom 1).
    const t2 = await page.evaluate(() => {
      const subs = templateRowsForName('Bedroom 1');
      const rec = __rec({ roomName: 'Bedroom 1', subsections: subs, words: [], transcript: 'bedroom',
        sections: [
          { name: subs[0], text: 'Door frame is a white painted metal. Door is a wooden painted white. One twin handle.' },
          { name: subs[1], text: 'Ceiling is painted white. There is sticky residue marks secured to the ceiling around the panel and the speaker, and spiderwebs present as well.' },
          { name: subs[3], text: 'Walls are white painted. We have no hooks, one silver metal doorstop secured to the flooring.' },
          { name: subs[4], text: 'Windows, we have three glass panes, second black undermount framing, two black on fly screen, no windowsill, window ledge.' },
          { name: subs[6], text: 'One single light switch, three double power points, one single foxhole and data point combination.' },
          { name: subs[10], text: 'Shelf, walnut laminate shelves secured with a white laminate panel secured neither, in good condition.' },
          { name: 'Additional', text: 'Two up and down secured at front door.' }] });
      const m = buildJobModel([rec], {});
      const r = m.rooms[0];
      const spansOf = n => (r.rows.find(x => x.name === n) || { sents: [] }).sents.map(x => x.spans.map(([a, b]) => x.text.slice(a, b))).flat();
      return { toCheck: r.toCheck, door: spansOf(subs[0]), ceiling: spansOf(subs[1]), walls: spansOf(subs[3]), win: spansOf(subs[4]), pp: spansOf(subs[6]), ward: spansOf(subs[10]), add: spansOf('Additional') };
    });
    check('R17: Bedroom 1 no longer says "nothing to check" when the AI flagged nothing', t2.toCheck >= 5, t2);
    check('R17: "spiderwebs", "twin handle", "foxhole", "up and down", "secured neither" highlighted', t2.ceiling.join() === 'spiderwebs' && t2.door.join() === 'twin handle' && t2.pp.join() === 'foxhole' && t2.add.join() === 'Two up and down' && t2.ward.includes('secured neither'), t2);
    check('R17: plain sentences ("no hooks … doorstop secured", "one single light switch") are not highlighted', t2.walls.length === 0 && !t2.pp.some(x => /single light/.test(x)), t2);
    const t2b = await page.evaluate(() => ({
      flip: suspectSpans('Once of no detachable showerhead in good condition.').length,
      lounge: suspectSpans('One black metal corner skirting both sides, one black metal fly screen door with a black metal handle skirting both sides.').length,
      sill: suspectSpans('Two black metal fly screens in good condition, two set of wooden seat and wind ledge.').length,
      clean: suspectSpans('No additional present. No handles are present. Interior is a grey laminate, no shelves are present. Tracks in good condition.').length,
      added: suspectSpans('No hooks present [added: in good condition].').length,
      // From the round 17 review: ordinary wording that must stay plain.
      ordinary: ['Two mirrored sliding doors, no handles, in good condition.', 'No marks or damage, in good condition.', 'No hooks present, walls in good condition.',
        'Smoke alarm present, no test button, secured and functional.', 'Roller blind operates up and down.', 'One wooden seat and lid.'].map(x => suspectSpans(x).length).join(),
      typeAlone: plateFrom('Hot water system type: gas.'),
      slow: (() => { const t0 = Date.now(); plateFrom('Model Numbers: ' + ' '.repeat(5000) + '!'); return Date.now() - t0; })()
    }));
    check('R17: "no … in good condition", "corner/handle skirting both sides", "wooden seat … wind ledge" highlighted', t2b.flip >= 1 && t2b.lounge >= 2 && t2b.sill === 2, t2b);
    check('R17: normal "no …" sentences and AI-added phrases are not highlighted', t2b.clean === 0 && t2b.added === 0, t2b);
    check('R17: ordinary wording ("no handles, in good condition", "up and down", "wooden seat and lid") stays plain', t2b.ordinary === '0,0,0,0,0,0', t2b.ordinary);
    check('R17: "type:" on its own is not a plate; a long run of spaces doesn\'t slow the plate reader', t2b.typeAlone === null && t2b.slow < 200, t2b);

    // 3. Two parts describing the same rows (Stirling Balcony: part 1 was a second store room).
    const t3 = await page.evaluate(() => {
      const subs = templateRowsForName('Balcony');
      const p1 = __rec({ roomName: 'Balcony', subsections: subs, part: 1, words: [], transcript: 'store room', audioPath: '01 Balcony - 1450.webm', sections: [
        { name: 'Ceiling', text: 'Ceiling is a grey painted.' }, { name: 'Exterior Walls', text: 'Walls are grey painted with small chips and scuff marks throughout.' },
        { name: 'Light Fittings', text: 'One grey plastic fluorescent light fitting.' }, { name: 'Power Points/Light Switches', text: 'One double power point, one single light switch.' },
        { name: 'Flooring', text: 'Flooring is a grey tile, grey grout, discolouration to the grout.' }] });
      const p2 = __rec({ roomName: 'Balcony', subsections: subs, part: 2, words: [], transcript: 'balcony', audioPath: '01 Balcony - 1452 - part 2.webm', sections: [
        { name: 'Ceiling', text: 'Ceiling is a white painted render.' }, { name: 'Exterior Walls', text: 'Exterior walls are a black painted render.' },
        { name: 'Power Points/Light Switches', text: 'No power points.' }, { name: 'Flooring', text: 'Flooring is a grey tile, grey grout, discolouration to the grout.' },
        { name: 'Water Tap', text: 'No water tap.' }] });
      const m = buildJobModel([p1, p2], {});
      const r = m.rooms[0];
      const xml = buildJobDocXml(m);
      // A normal two-part room: part 2 carries on, one row repeated.
      const subsK = templateRowsForName('Kitchen');
      const k1 = __rec({ roomName: 'Kitchen', roomId: 'k', subsections: subsK, part: 1, words: [], transcript: 'k1', sections: [{ name: 'Ceiling', text: 'Ceiling painted white.' }, { name: 'Additional', text: 'One Aiphone.' }] });
      const k2 = __rec({ roomName: 'Kitchen', roomId: 'k', subsections: subsK, part: 2, words: [], transcript: 'k2', sections: [{ name: 'Oven/Griller', text: 'One AEG oven.' }, { name: 'Additional', text: 'One microwave recess.' }] });
      const mk = buildJobModel([k1, k2], {});
      const rk = mk.rooms[0];
      return { notes: r.notes, toCheck: r.toCheck, rep: r.rows.filter(x => x.repeat).map(x => x.name), xmlHas: /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">pt 1 \+ pt 2<\/w:t>/.test(xml),
        keyHas: /Said in two recordings of the room/.test(xml), kNotes: rk.notes, kToCheck: rk.toCheck, kRep: rk.rows.filter(x => x.repeat).map(x => x.name + ':' + x.repeatCounts) };
    });
    check('R17: part 2 describing 4 rows part 1 already described gets a note for the VA', t3.notes.some(n => /^Parts 1 and 2 both describe Ceiling, Exterior Walls, Power Points\/Light Switches, Flooring\. One part may be a different room/.test(n)), t3.notes);
    check('R17: those rows are marked "pt 1 + pt 2" (highlighted) and counted to check', t3.rep.length === 4 && t3.toCheck === 4 && t3.xmlHas && t3.keyHas, t3);
    check('R17: a normal two-part room (one row said in both parts) gets no note and no count', t3.kNotes.length === 0 && t3.kToCheck === 0 && t3.kRep.join() === 'Additional:false', t3);

    // 4. Type numbers.
    const t4 = await page.evaluate(() => {
      const subs = templateRowsForName('Kitchen');
      const rec = __rec({ roomName: 'Kitchen', subsections: subs, words: [], transcript: 'oven', sections: [
        { name: 'Oven/Griller', text: 'One silver metal AEG oven. Model Numbers: Not present\nSerial Numbers: 82897294\nType: 71ADC01AD' },
        { name: 'Dishwasher', text: 'AEG XXL dishwasher. Model Numbers: FSE73700P / Serial Numbers: 83840019' }] });
      const m = buildJobModel([rec], {});
      const xml = buildJobDocXml(m);
      const old = plateFrom('One grey metal Mitsubishi aircon motor. Model Numbers: MXZ4E80VAD / Serial Numbers: Unable to find serial number.');
      const slash = plateFrom('Model Numbers: Not present / Serial Numbers: 82897294 / Type: 71ADC01AD');
      // A room with no type keeps the three-column table.
      const rec2 = __rec({ roomName: 'Lounge', roomId: 'l', subsections: templateRowsForName('Lounge'), words: [], transcript: 'l', sections: [{ name: 'Ceiling Fan/Air Conditioner', text: 'Model Numbers: MSZ-GE60VAD / Serial Numbers: 8001128' }] });
      const xml2 = buildJobDocXml(buildJobModel([rec2], {}));
      return { plates: m.rooms[0].plates, typeCol: />Type<\/w:t>/.test(xml), old, slash, noType: !/>Type<\/w:t>/.test(xml2) && />Serial<\/w:t>/.test(xml2) };
    });
    const oven = t4.plates.find(p => p.row === 'Oven/Griller') || {};
    const dish = t4.plates.find(p => p.row === 'Dishwasher') || {};
    check('R17: oven Type goes in its own column, not Model', oven.model === 'Not present' && oven.serial === '82897294' && oven.type === '71ADC01AD' && t4.typeCol, t4);
    check('R17: " / " separated plates read the same way', t4.slash.model === 'Not present' && t4.slash.serial === '82897294' && t4.slash.type === '71ADC01AD', t4.slash);
    check('R17: plates without a type are read as before (three-column table)', dish.model === 'FSE73700P' && dish.serial === '83840019' && t4.old.model === 'MXZ4E80VAD' && t4.old.serial === 'Unable to find serial number.' && t4.noType, t4);

    // 5. Nothing for the first rows (Stirling kitchen part 1 not recorded).
    const t5 = await page.evaluate(() => {
      const subs = templateRowsForName('Kitchen');
      const later = subs.slice(6, 12).map(n => ({ name: n, text: n + ' described.' }));
      const rec = __rec({ roomName: 'Kitchen', subsections: subs, words: [], transcript: 'k', sections: later });
      const m = buildJobModel([rec], {});
      // A room that only skips the door row is fine.
      const lounge = templateRowsForName('Lounge');
      const rec2 = __rec({ roomName: 'Lounge', roomId: 'l2', subsections: lounge, words: [], transcript: 'l', sections: lounge.slice(1, 8).map(n => ({ name: n, text: n + ' described.' })) });
      const m2 = buildJobModel([rec2], {});
      const rec3 = __rec({ roomName: 'Kitchen', roomId: 'k3', subsections: subs, part: 2, words: [], transcript: 'k', sections: later });
      const rec4 = __rec({ roomName: 'Kitchen', roomId: 'k3', subsections: subs, part: 1, words: [], transcript: '', status: 'failed' });
      const m3 = buildJobModel([rec4, rec3], {});
      return { notes: m.rooms[0].notes, notes2: m2.rooms[0].notes, notes3: m3.rooms[0].notes };
    });
    check('R17: Word file notes when the first 6 rows are empty and later rows are full', t5.notes.some(n => n === 'Nothing for the first 6 rows (Door/Doorway Frames/Handles to Blinds/Curtains). The start of this room may not have been recorded. Check the photos.'), t5.notes);
    check('R17: one empty first row is not noted', t5.notes2.length === 0, t5.notes2);
    check('R17: no "first rows" note when part 1 has no transcript (its own note says so)', !t5.notes3.some(n => /^Nothing for the first/.test(n)) && t5.notes3.some(n => /^No transcript for part 1/.test(n)), t5.notes3);
    const t5b = await page.evaluate(() => {
      const room = state.rooms.find(r => (r.subsections || []).length >= 10) || state.rooms[0];
      state.roomSections = state.roomSections || {};
      state.roomSections[room.id] = room.subsections.slice(6).map(n => ({ name: n, text: n + ' described.' }));
      showReview();
      const card = document.querySelector('#reviewBody .attn-card');
      const txt = card ? card.textContent : '';
      // Not while a recording of the room has failed or is still sending.
      roomRecMap[room.id] = { failed: 1 };
      showReview();
      const card2 = document.querySelector('#reviewBody .attn-card');
      const txt2 = card2 ? card2.textContent : '';
      delete roomRecMap[room.id];
      delete state.roomSections[room.id];
      return { txt, txt2, want: room.name + ': nothing for ' + room.subsections[0] + ' to ' + room.subsections[5] + '. Record it if you missed it.' };
    });
    check('R17: Review "Before you finish" asks about a room with nothing for its first rows', t5b.txt.includes(t5b.want), t5b);
    check('R17: …but not while a recording of that room has failed or is still sending', !t5b.txt2.includes(t5b.want), t5b);

    // 6. Review fix: a cut-short check list gets a note at the top of the room in the Word file.
    const t6 = await page.evaluate(() => {
      const subs = templateRowsForName('Lounge');
      const secs = [{ name: subs[1], text: 'Ceiling painted white.' }, { name: subs[3], text: 'Walls painted white.' }];
      const one = buildJobModel([__rec({ roomName: 'Lounge', roomId: 'c1', subsections: subs, words: [], transcript: 'lounge', sections: secs, checkCutShort: true })], {}).rooms[0].notes;
      const none = buildJobModel([__rec({ roomName: 'Lounge', roomId: 'c2', subsections: subs, words: [], transcript: 'lounge', sections: secs })], {}).rooms[0].notes;
      const two = buildJobModel([__rec({ roomName: 'Lounge', roomId: 'c3', subsections: subs, part: 1, words: [], transcript: 'a', sections: secs }),
        __rec({ roomName: 'Lounge', roomId: 'c3', subsections: subs, part: 2, words: [], transcript: 'b', sections: [{ name: subs[5], text: 'One roller blind.' }], checkCutShort: true })], {}).rooms[0].notes;
      const m = buildJobModel([__rec({ roomName: 'Lounge', roomId: 'c4', subsections: subs, words: [], transcript: 'lounge', sections: secs, checkCutShort: true })], {});
      return { one, none, two, inDoc: /Check list cut short/.test(buildJobDocXml(m)) };
    });
    check('R17 review: Word file notes "Check list cut short" at the top of the room', t6.one.includes('Check list cut short. The AI stopped before listing everything to check. Check the whole room against the audio.') && t6.inDoc, t6);
    check('R17 review: no note on a normal room; a two-part room names the part', !t6.none.some(n => /cut short/.test(n)) && t6.two.some(n => n === 'Check list cut short for part 2. The AI stopped before listing everything to check. Check the whole part against the audio.'), t6);

    // ── Round 18: said but not in the sorted text ──
    const t8 = await page.evaluate(() => {
      const subs = templateRowsForName('Bedroom 1');
      const said = [[10, 'Ceiling is painted white.'], [52, '2 up and down secured at front door.'], [60, 'Walls are white painted, small scuff marks.'],
        [70, 'Uh, coming into the wardrobe, 3 double power points, 1 single foxhole and data point combination.'], [80, 'Toilet has once of no address burns.']];
      const transcript = said.map(x => x[1]).join(' ');
      const secs = [{ name: subs[1], text: 'Ceiling is painted white {+in clean condition+}.' }, { name: subs[3], text: 'Walls are white painted, small scuff marks.' },
        { name: subs[6], text: 'Three double power points, one single Foxtel and data point combination.' }, { name: 'Additional', text: 'Toilet has one silver metal, no dual flush button.' }];
      const rec = __rec({ roomName: 'Bedroom 1', subsections: subs, words: __words(said), transcript, sections: secs });
      const m = buildJobModel([rec], {});
      const r = m.rooms[0];
      const note = r.notes.find(n => /^Said but not in the sorted text/.test(n)) || '';
      // The same room with nothing left out, a keyword-split room, a two-part room and a long list.
      const okRec = __rec({ roomName: 'Bedroom 1', roomId: 'b2', subsections: subs, words: [], transcript, sections: secs.concat([{ name: subs[2], text: 'Two downlights secured at front door.' }, { name: 'Additional', text: 'Toilet has once of no address burns.' }]) });
      const kwRec = __rec({ roomName: 'Bedroom 1', roomId: 'b3', subsections: subs, words: [], transcript, sections: null });
      const p1 = __rec({ roomName: 'Bedroom 1', roomId: 'b4', subsections: subs, part: 1, words: [], transcript: 'Ceiling is painted white.', sections: [secs[0]] });
      const p2 = __rec({ roomName: 'Bedroom 1', roomId: 'b4', subsections: subs, part: 2, words: [], transcript: '2 up and down secured at front door.', sections: [secs[1]] });
      const many = Array.from({ length: 11 }, (_, i) => 'Item ' + (i + 1) + ' zebra quartz marble lantern.').join(' ');
      const manyRec = __rec({ roomName: 'Bedroom 1', roomId: 'b5', subsections: subs, words: [], transcript: many + ' Ceiling is painted white.', sections: [secs[0]] });
      const okNotes = buildJobModel([okRec], {}).rooms[0].notes, kwNotes = buildJobModel([kwRec], {}).rooms[0].notes;
      return { note, toCheck: r.toCheck, inDoc: /Said but not in the sorted text/.test(buildJobDocXml(m)),
        ok: okNotes.filter(n => /^Said but not/.test(n)), kw: kwNotes.filter(n => /^Said but not/.test(n)),
        two: buildJobModel([p1, p2], {}).rooms[0].notes.filter(n => /^Said but not/.test(n)),
        many: buildJobModel([manyRec], {}).rooms[0].notes.filter(n => /^Said but not/.test(n)) };
    });
    check('R18: a sentence the AI left out is listed with its time ("2 up and down secured at front door", 0:52)', /“2 up and down secured at front door” \(0:52\)/.test(t8.note) && /Check against the audio and the raw transcript\.$/.test(t8.note) && t8.inDoc, t8.note);
    check('R18: a phrase the AI changed is listed ("once of no address burns" → "no dual flush button")', /“Toilet has once of no address burns”/.test(t8.note), t8.note);
    check('R18: fixed mishears, digits as words and walk-through phrases are not listed', !/foxhole|power points|coming into|Ceiling|Walls/.test(t8.note), t8.note);
    check('R18: each listed phrase is counted to check', t8.toCheck >= 2, t8.toCheck);
    check('R18: nothing listed when nothing was left out, or when the AI did not sort the room', t8.ok.length === 0 && t8.kw.length === 0, t8);
    check('R18: a two-part room names the part', t8.two.length === 1 && /^Said but not in the sorted text for part 2,/.test(t8.two[0]), t8.two);
    check('R18: a long list shows 8 and says how many more', t8.many.length === 1 && (t8.many[0].match(/“/g) || []).length === 8 && /and 3 more\./.test(t8.many[0]), t8.many);
    const t8b = await page.evaluate(() => ({
      same: missingPhrases('ceiling painted white walls painted grey sliding door has a parliament lockable handle the door has a owl symbol present', [{ text: 'Ceiling painted white. Walls painted grey. Sliding door has a parliament lockable handle. The door has a owl symbol present.' }]),
      gone: missingPhrases('ceiling painted white walls painted grey two up and down secured at the front door near the entry the door has a owl symbol present', [{ text: 'Ceiling painted white. Walls painted grey. The door has a owl symbol present.' }])
    }));
    check('R18: an unpunctuated transcript is checked in short pieces (nothing listed when all is there; the left-out piece listed)', t8b.same.length === 0 && t8b.gone.length === 1 && /up and down secured/.test(t8b.gone[0]), t8b);
    // From the round 18 review.
    const t8c = await page.evaluate(() => {
      const one = (said, out) => missingPhrases(said, [{ text: out }]);
      const subs = templateRowsForName('Kitchen');
      const scratch = __rec({ roomName: 'Kitchen', roomId: 'k18', subsections: subs, words: [], transcript: 'Carpet is stained near the door. Scratch that. Carpet is clean near the door.',
        sections: [{ name: subs[8], text: 'Carpet is clean near the door.' }] });
      const big = Array.from({ length: 30 }, (_, i) => 'zebra' + i + ' quartz marble lantern').join(', ');
      const bigRec = __rec({ roomName: 'Kitchen', roomId: 'k19', subsections: subs, words: [], transcript: big + '. Ceiling painted white.', sections: [{ name: subs[1], text: 'Ceiling painted white.' }] });
      return {
        goingTo: one('Going to note the oven door is cracked.', 'Oven clean.'),
        walk: one('Coming into the master bedroom, ceiling painted white.', 'Ceiling painted white.'),
        everyday: one('Let me see, I can see some batteries missing from the smoke alarm.', 'Smoke alarm battery missing.'),
        joined: one('Two down lights secured.', 'Two downlights secured.'),
        big: one('25 white cupboard doors.', 'Twenty-five white cupboard doors.'),
        scratch: buildJobModel([scratch], {}).rooms[0].notes.filter(n => /^Said but not/.test(n)),
        count: buildJobModel([bigRec], {}).rooms[0].toCheck
      };
    });
    check('R18 review: "going to note the oven door is cracked" is checked (not taken for walk-through talk)', t8c.goingTo.length === 1 && t8c.walk.length === 0, t8c);
    check('R18 review: words cancelled with "scratch that" are not listed', t8c.scratch.length === 0, t8c.scratch);
    check('R18 review: everyday words, "batteries"/"battery", "down lights"/"downlights" and "25"/"twenty-five" are not listed', t8c.everyday.length === 0 && t8c.joined.length === 0 && t8c.big.length === 0, t8c);
    check('R18 review: a long list adds at most 8 to the room\'s count', t8c.count === 8, t8c.count);

    check('R17: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 19: review fixes (sorting and polishing, Word file notes, audio safety) ──
  {
    let cleanOut = null, cleanSent = null;
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      if (u.includes('a1d7b510c12511f1bf831607ee4eb77e')) { cleanSent = JSON.parse(req.postData() || '{}'); return route.fulfill({ status: cleanOut ? 200 : 502, contentType: 'application/json', body: JSON.stringify(cleanOut || { ok: false, error: 'anthropic took too long' }) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });
    await startJob(page, '19 Review Street');
    await page.evaluate(() => {
      window.__rec = (o) => Object.assign({ roomId: 'r19_' + o.roomName, address: state.address, jobId: state.jobId, meta: inspectionMeta(), type: 'audio/webm',
        blob: new Blob([new Uint8Array(20)]), engine: 'assemblyai', status: 'done', createdAt: Date.now() + (o.part || 1), roomNo: 1, part: 1, cleanedBy: 'claude-sonnet-5-5', check: [] }, o);
    });

    // 1. "scratch that" describing a scratch is kept; the command still works.
    const s1 = await page.evaluate(() => ({
      deep: applyScratch('There is one deep scratch that runs along the front edge.'),
      long: applyScratch('Door is painted white with a scratch that is about 10 centimetres long.'),
      cmd: applyScratch('Oven has induction. Scratch that. Present.'),
      run: applyScratch('Walls are white painted scratch that walls are grey painted.'),
      twice: applyScratch('There is a scratch that, scratch that, two scratches to the door.')
    }));
    check('R19: "a deep scratch that runs along…" is damage and is kept word for word', s1.deep === 'There is one deep scratch that runs along the front edge.' && s1.long === 'Door is painted white with a scratch that is about 10 centimetres long.', s1);
    check('R19: "scratch that" as a command still cancels the words before it', s1.cmd === 'Present.' && s1.run === 'walls are grey painted.' && s1.twice === 'two scratches to the door.', s1);

    // 2. The AI sees "sorry"; it never reaches the sorted text; the keyword split still drops it.
    cleanOut = { ok: true, model: 'claude-sonnet-5-5', sections: [{ name: 'Flooring', text: 'Flooring is grey tile, sorry, dust build-up present.' }], check: [] };
    const s2 = await page.evaluate(async () => {
      const rec = { id: 9901, roomId: 'x19', roomName: 'Kitchen', address: state.address, jobId: state.jobId, subsections: templateRowsForName('Kitchen'),
        transcript: 'Flooring is grey tile with sand, sorry, dust build up present.', words: [], createdAt: Date.now(), type: 'audio/webm' };
      cleanupReady = true;
      await runCleanup(rec);
      return { floor: (rec.sections || [])[0] && rec.sections[0].text, keyword: applyCorrections('sand, sorry, dust') };
    });
    check('R19: the AI is sent "sorry" so it can see the self-correction', /sand, sorry, dust build-up/.test(cleanSent.transcript), cleanSent.transcript);
    check('R19: "sorry" is taken out of the sorted text', s2.floor === 'Flooring is grey tile, dust build-up present.', s2.floor);
    check('R19: the keyword split still drops "sorry"', !/sorry/i.test(s2.keyword), s2.keyword);

    // 3. Added phrases: wrong braces and no braces still read as added; added next to damage is flagged; "Ceiling fan." is kept.
    cleanOut = { ok: true, model: 'claude-sonnet-5-5', check: [], sections: [
      { name: 'Walls/Picture Hooks', text: 'Walls painted white {+in clean condition}.' },
      { name: 'Flooring', text: 'Grey carpet, stains near the window, in clean condition.' },
      { name: 'Power Points/Light Switches', text: 'Two double power points secured and functional. One light switch, secure and functional.' },
      { name: 'Ceiling Fan/Air Conditioner', text: 'Ceiling fan {+secured and functional+}.' } ] };
    const s3 = await page.evaluate(async () => {
      const rec = { id: 9902, roomId: 'x19b', roomName: 'Bedroom 1', address: state.address, jobId: state.jobId, subsections: templateRowsForName('Bedroom 1'),
        transcript: 'Walls painted white. Grey carpet, stains near the window. Two double power points. One light switch, secure and functional. Ceiling fan.', words: [], createdAt: Date.now(), type: 'audio/webm' };
      cleanupReady = true;
      await runCleanup(rec);
      const t = n => ((rec.sections || []).find(s => s.name === n) || {}).text;
      return { walls: t('Walls/Picture Hooks'), floor: t('Flooring'), pp: t('Power Points/Light Switches'), fan: t('Ceiling Fan/Air Conditioner'), check: rec.check };
    });
    check('R19: an added phrase with a wrong brace is still marked added', s3.walls === 'Walls painted white [added: in clean condition].', s3.walls);
    check('R19: an added phrase the inspector never said, written without braces, is marked added', s3.floor === 'Grey carpet, stains near the window, [added: in clean condition].' && /points \[added: secured and functional\]\./.test(s3.pp), s3);
    check('R19: "secure and functional" the inspector said stays their own words', /One light switch, secure and functional\./.test(s3.pp), s3.pp);
    check('R19: an added "in clean condition" next to stains goes on the check list', s3.check.some(c => c.why === 'added phrase next to a condition note' && /stains near the window/.test(c.quote)), s3.check);
    check('R19: a row that only names its item ("Ceiling fan.") is kept, without the added phrase', s3.fan === 'Ceiling fan.', s3.fan);

    // 4. Said but not in the sorted text: dropped damage, changed counts, a lost "no", a swapped side.
    const s4 = await page.evaluate(() => {
      const one = (said, out) => missingPhrases(said, [{ text: out }]);
      return {
        scuff: one('Door frame is white painted metal, scuff marks to the door frame.', 'Door frame is white painted metal. Walls have scuff marks.'),
        count: one('3 double power points.', 'Two double power points.'),
        no: one('No hooks present.', 'Hooks present.'),
        side: one('Chip to the left side of the door.', 'Chip to the right side of the door.'),
        notWorking: one('Exhaust fan not working.', 'Exhaust fan [added: secured and functional].'),
        walkDamage: one('Coming into the laundry door is cracked.', 'Laundry door.'),
        same: one('3 double power points, chip to the left side of the door.', 'Three double power points. Chip to the left side of the door.'),
        walk: one('Coming into the master bedroom.', 'Ceiling painted white.')
      };
    });
    check('R19: a dropped damage note is listed even when the item is still described', s4.scuff.length === 1 && /scuff marks/.test(s4.scuff[0]), s4.scuff);
    check('R19: a changed count, a lost "no", a swapped side and "not working" are listed', s4.count.length === 1 && s4.no.length === 1 && s4.side.length === 1 && s4.notWorking.length === 1, s4);
    check('R19: a walk-through phrase with damage in it is checked; a plain one still isn\'t', s4.walkDamage.length === 1 && s4.walk.length === 0, s4);
    check('R19: the same words with the count as a word and the sides kept are not listed', s4.same.length === 0, s4.same);

    // 5. Word file: a room the AI didn't sort says so; plates are highlighted; checks the AI couldn't place are listed.
    const s5 = await page.evaluate(() => {
      const subs = templateRowsForName('Lounge');
      const fallback = __rec({ roomName: 'Lounge', subsections: subs, words: [], sections: null, check: null, cleanupError: 'anthropic took too long',
        transcript: 'Air conditioner wall mount plastic, model number is MSZ-GE60VAD, serial number is 8001128.' });
      const m1 = buildJobModel([fallback], {}).rooms[0];
      const sents = m1.rows.reduce((a, r) => a.concat(r.sents || []), []);
      const plate = sents.find(x => /MSZ-GE60VAD/.test(x.text));
      const sorted = __rec({ roomName: 'Kitchen', roomId: 'r19_k', subsections: templateRowsForName('Kitchen'), words: [], transcript: 'Sink is silver metal. Tap is silver metal.',
        sections: [{ name: 'Sink', text: 'Sink is silver metal.' }, { name: 'Tapware', text: 'Tap is silver metal.' }],
        check: [{ quote: 'Tap is once over mixer.', words: 'once over', heard: 'tap is once over mixer', why: 'garbled' }] });
      const m2 = buildJobModel([sorted], {}).rooms[0];
      return { notes1: m1.notes, check1: m1.toCheck, spans: plate ? plate.spans.map(([a, b]) => plate.text.slice(a, b)) : null, notes2: m2.notes, check2: m2.toCheck };
    });
    check('R19: a room the AI didn\'t sort says so at the top, and counts to check', s5.notes1.some(n => /^Not sorted by the AI\. The rows were split by keyword/.test(n)) && s5.check1 >= 1, s5);
    check('R19: model and serial numbers are highlighted in a room the AI didn\'t sort', s5.spans && s5.spans.includes('MSZ-GE60VAD') && s5.spans.includes('8001128'), s5.spans);
    check('R19: a check the AI couldn\'t place in the sorted text is listed at the top of the room and counted', s5.notes2.some(n => /^Also to check, the AI flagged words it could not place: “Tap is once over mixer\.” \(garbled\)/.test(n)) && s5.check2 === 1, s5);

    // 6. Fewer false highlights on real skirting; towels stay towels.
    const s6 = await page.evaluate(() => {
      const hl = t => suspectSpans(t).map(([a, b]) => t.slice(a, b));
      return {
        real1: hl('There is a chip to the corner skirting housing into bedroom 1.'),
        real2: hl('Scuff marks to the skirting on both sides of the door.'),
        real3: hl('Skirting to the wall is white tile.'),
        mishear: hl('One black metal corner skirting both sides.'),
        towels: [applyCorrections('Hand towel present.'), applyCorrections('One paper towel dispenser.'), applyCorrections('One silver metal towel secured to the wall.')]
      };
    });
    check('R19: real skirting is not highlighted ("the corner skirting", "the skirting on both sides", "Skirting to the wall…")', !s6.real1.length && !s6.real2.length && !s6.real3.length, s6);
    check('R19: the "corner skirting both sides" mishear is still highlighted', s6.mishear.length >= 1, s6.mishear);
    check('R19: a hand or paper towel stays a towel; a bare "towel" fitting is still a towel rail', s6.towels[0] === 'Hand towel present.' && s6.towels[1] === 'One paper towel dispenser.' && /towel rail secured/.test(s6.towels[2]), s6.towels);

    // 7. Audio safety: an old copy written back keeps the "kept as bytes" mark; unreadable audio not in Dropbox is kept past 14 days.
    const s7 = await page.evaluate(async () => {
      const id = await dbAdd({ roomId: 'r19_bytes', roomName: 'Laundry', address: state.address, jobId: state.jobId, blob: new Blob([new Uint8Array(40)], { type: 'audio/webm' }), type: 'audio/webm', status: 'pending', createdAt: Date.now() });
      const stale = await dbGet(id);
      await saveAsBytes(Object.assign({}, stale, { id }), new Blob([new Uint8Array(40)], { type: 'audio/webm' }));
      stale.status = 'uploading';
      await dbPut(stale);   // the send pass writes its older copy back
      const after = await dbGet(id);
      const bytes = await readAudioBytes(Object.assign({}, stale, { bytesStored: false, blob: null }));
      const old = Date.now() - 30 * 864e5;
      const unread = await dbAdd({ roomId: 'r19_unread', roomName: 'Garage', address: '1 Old Street', jobId: 'OLD19', blob: new Blob([new Uint8Array(30)], { type: 'audio/webm' }), type: 'audio/webm',
        status: 'failed', unreadable: true, archived: true, archivedAt: old, audioArchived: false, autoRetries: 99, createdAt: old });
      await sweepOldJobs();
      return { kept: after.bytesStored === true && after.status === 'uploading', bytes: bytes && bytes.byteLength, unreadKept: !!(await dbGet(unread)) };
    });
    check('R19: an older copy written back keeps the "kept as bytes" mark, so the good audio is found', s7.kept && s7.bytes === 40, s7);
    check('R19: an unreadable recording whose audio never reached Dropbox is not deleted after 14 days', s7.unreadKept, s7);

    // 8. Done with nothing recorded says so; the mic request has a time limit.
    const s8 = await page.evaluate(async () => {
      const room = state.rooms[0].id;
      listeningRoom = room; currentRecSession = null;
      const ta = document.getElementById(`roomta-${room}`); if (ta) ta.value = '';
      roughDrafts[room] = '';
      __toasts.length = 0;
      finishSegment();
      const hang = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
      micNeedsRefresh = true;
      const t0 = Date.now(); let err = '';
      const realMs = MIC_OPEN_MS;
      try { await withDeadline(getSessionMic(), realMs + 2000, 'test'); } catch (e) { err = e.message; }
      navigator.mediaDevices.getUserMedia = hang;
      return { toast: __toasts.slice(-1)[0], err, took: Date.now() - t0, limit: realMs };
    });
    check('R19: Done with nothing recorded says "Nothing was recorded", not "Saved"', /^Nothing was recorded/.test(s8.toast), s8.toast);
    check('R19: a microphone that never opens gives up within its time limit', s8.err === 'opening the microphone timed out' && s8.took < s8.limit + 1500, s8);

    // 9. Finish with audio held only in memory asks to save it first.
    const s9 = await page.evaluate(async () => {
      const r = { roomId: state.rooms[0].id, roomName: state.rooms[0].name, address: state.address, jobId: state.jobId, blob: new Blob([new Uint8Array(10)], { type: 'audio/webm' }), type: 'audio/webm', status: 'pending', createdAt: Date.now() };
      unsavedRecs.push(r);
      const realRetry = window.retryUnsaved; window.retryUnsaved = async () => {};
      const asked = []; const realConfirm = window.confirm; window.confirm = (m) => { asked.push(m); return false; };
      __toasts.length = 0;
      await finishAndClear();
      window.confirm = realConfirm; window.retryUnsaved = realRetry;
      unsavedRecs = unsavedRecs.filter(x => x !== r);
      return { asked, toast: __toasts.slice(-1)[0], still: document.getElementById('screenInspection').classList.contains('active') };
    });
    check('R19: Finish with audio only in memory offers to save it to Files first, and Cancel keeps the inspection', s9.asked.length === 1 && /not saved on this phone yet/.test(s9.asked[0]) && s9.still && /^Not finished/.test(s9.toast), s9);

    // 10. Dropbox must confirm the size of an upload.
    const s10 = await page.evaluate(async () => {
      const realFetch = window.fetch; let err = '';
      window.fetch = async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      try { await archivePut('Audio/x.webm', new Uint8Array(12), 'audio/webm'); } catch (e) { err = e.message; }
      window.fetch = realFetch;
      return err;
    });
    check('R19: an upload answer that doesn\'t say the size is not taken as safe', s10 === 'Dropbox did not confirm the file', s10);

    // 11. The room .json carries the notes for the typist editor.
    const s11 = await page.evaluate(() => {
      const subs = templateRowsForName('Bedroom 1');
      const sorted = __rec({ id: 9911, roomName: 'Bedroom 1', subsections: subs, words: [], transcript: 'Walls painted white. 2 up and down secured at front door.', checkCutShort: true,
        sections: [{ name: subs[3], text: 'Walls painted white.' }] });
      const fallback = __rec({ id: 9912, roomName: 'Bedroom 1', subsections: subs, words: [], transcript: 'Walls painted white.', sections: null, check: null, cleanupError: 'anthropic took too long' });
      const a = buildRoomJson(sorted, ''), b = buildRoomJson(fallback, 'Walls painted white.');
      return { missing: a.missing, cut: a.cutShort, err: a.sortError, missing2: b.missing, cut2: b.cutShort, err2: b.sortError };
    });
    check('R19: room .json lists what was said but left out, and a cut-short check list, for the typist editor', s11.missing.length === 1 && /2 up and down secured at front door/.test(s11.missing[0].phrase) && s11.cut === true && s11.err === null, s11);
    check('R19: room .json says when the AI sort did not run', s11.err2 === 'anthropic took too long' && s11.missing2.length === 0 && s11.cut2 === false, s11);
    // 12. Independent review fixes.
    const s12 = await page.evaluate(() => {
      const one = (said, out) => missingPhrases(said, [{ text: out }]);
      const hl = t => suspectSpans(t).map(([a, b]) => t.slice(a, b));
      return {
        sc: [applyScratch('Marks near the window, scratch that, near the door.'), applyScratch('Tap is loose, scratch that, is secured and functional.'),
          applyScratch('Benchtop is white laminate. Scratch that\'s about 10 centimetres long.'), applyScratch('Door is white painted timber. Scratch that runs along the bottom edge.')],
        added: [markUnbracedAdded('Two silver hanging rods secured underneath, in good condition.', '2 silver hanging rods secured neither, in good condition'),
          markUnbracedAdded('Two downlights secured and functional.', '2 down lights secured and functional'),
          markUnbracedAdded('Exhaust fan secured and functional.', 'exhaust fan screw and functional')],
        noMarks: addedNextToDamage([{ text: 'Walls are white painted, no marks [added: in clean condition]. Glass has no cracks or chips [added: in good condition]. Fan not working [added: secured and functional].' }]),
        lock: hl('One single lock on the skirting on both sides.'),
        type: [hl('Floor type is 2 tone grey tile.'), hl('Power point type is 3 pin.'), hl('Oven type is 71ADC01AD.')],
        blows: hl('Two blows present.'),
        miss: [one('One 7-way skirting bottom with 2 silver metal pull cords.', 'One silver metal weight secured to the bottom with two silver metal pull cords.'),
          one('1 single box top point data point combination.', 'One single Foxtel point and data point combination.'),
          one('Red mark to the skirting in front of the left— sorry, in front of the right side of the wardrobe.', 'Red mark to the skirting in front of the right side of the wardrobe.'),
          one('two picture hooks on the right wall ceiling is white painted with cobwebs', 'Two picture hooks on the right wall. Ceiling is white painted with cobwebs.')]
      };
    });
    check('R19 review: "scratch that" after a comma is the command; "scratch that\'s" and "Scratch that runs along…" are damage', s12.sc[0] === 'near the door.' && s12.sc[1] === 'is secured and functional.' && /Scratch that's about 10/.test(s12.sc[2]) && /timber\. Scratch that runs along/.test(s12.sc[3]), s12.sc);
    check('R19 review: the inspector\'s own "in good condition" / "secured and functional" are not marked added (mishears and digits too)', s12.added.every(t => !/\[added:/.test(t)), s12.added);
    check('R19 review: "no marks", "no cracks or chips" next to an added phrase are not flagged; "not working" still is', s12.noMarks.length === 1 && /Fan not working/.test(s12.noMarks[0].quote), s12.noMarks);
    check('R19 review: "lock on the skirting on both sides" (Stirling mishear) is still highlighted', s12.lock.length >= 1, s12.lock);
    check('R19 review: "type is 2 tone" / "3 pin" are not highlighted as plates; a type code is', !s12.type[0].length && !s12.type[1].length && s12.type[2].includes('71ADC01AD'), s12.type);
    check('R19 review: "two blows" (globes) is highlighted with the count as a word', s12.blows.length === 1, s12.blows);
    check('R19 review: correct AI fixes of "7-way", "box top", a self-corrected side and a run-on split are not listed as missing', s12.miss.every(m => m.length === 0), s12.miss);
    const s13 = await page.evaluate(async () => {
      // A partial save kept 10 bytes; Done brings the whole 50-byte recording.
      const id = await dbAdd({ roomId: 'r19_part', roomName: 'Study', address: state.address, jobId: state.jobId, blob: new Blob([new Uint8Array(10)], { type: 'audio/webm' }), type: 'audio/webm', status: 'recording', createdAt: Date.now() });
      await saveAsBytes({ id }, new Blob([new Uint8Array(10)], { type: 'audio/webm' }));
      const full = { id, roomId: 'r19_part', roomName: 'Study', address: state.address, jobId: state.jobId, blob: new Blob([new Uint8Array(50)], { type: 'audio/webm' }), type: 'audio/webm', status: 'pending', createdAt: Date.now() };
      await dbPut(full);
      const stored = await dbGet(id);
      const read = await readAudioBytes(full);
      return { mark: !!full.bytesStored, storedBlob: stored.blob ? stored.blob.size : 0, read: read.byteLength };
    });
    check('R19 review: Done after a partial save keeps the whole recording, not the partial bytes', !s13.mark && s13.storedBlob === 50 && s13.read === 50, s13);
    check('R19: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 20 ──────────────────────────────────────────────────────────────
  // Rooms follow the PCR palm cards; Gas Meter replaces Smoke Alarms; a required
  // photo for each mandatory item, named "00 Mandatory - <item> <n> - <hhmm>" in Dropbox.
  {
    const ARCH = '9ecaffe4859311f181ad1607ee4eb77e';
    const puts = [];
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      if (u.includes(ARCH) && !u.includes('action=')) {
        const path = decodeURIComponent((u.match(/path=([^&]*)/) || [])[1] || '');
        puts.push({ path, type: req.headers()['content-type'], size: (req.postDataBuffer() || []).length });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, path: '/x/' + path.split('/').pop() }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });
    const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0xff, 0xd9]);
    const snap = async (sel, name) => {
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
      await fc.setFiles({ name, mimeType: 'image/jpeg', buffer: JPG });
      await wait(400);
    };

    // 1. Rooms from the palm cards.
    const r1 = await page.evaluate(() => {
      const rows = id => (ALL_ROOMS.find(r => r.id === id) || {}).subsections || [];
      const has = (id, ...names) => names.every(n => rows(id).includes(n));
      return {
        front: has('front_gardens', 'Aircon Motor', 'Verandah/Portico', 'Gas Meter Box'),
        garage: has('garage', 'Walls/Shelves/Hooks', 'Garbage Bins'),
        beds: ['bedroom1', 'bedroom2', 'bedroom3', 'bedroom4', 'study'].every(id => rows(id)[1] === 'Screen Door/Handles'),
        kitchen: has('kitchen', 'Skirting/Kickboards', 'Pantry', 'Fridge Recess Cabinetry'),
        drains: ['ensuite', 'ensuite_toilet', 'bathroom2', 'toilet', 'powder_room', 'laundry', 'balcony', 'bathroom_laundry'].every(id => rows(id).includes('Flooring/Drains')),
        rear: has('rear_exterior', 'Aircon Motor', 'Garbage Bins', 'Exterior Flooring/Drains', 'Hot Water System', 'Patio/Pergola') && !rows('rear_exterior').includes('Pool'),
        pool: rows('pool').join('|'),
        bl: has('bathroom_laundry', 'Shower Tiles', 'Washing Machine Taps', 'Laundry Tapware', 'Laundry Benchtops', 'Laundry Splash Back', 'Laundry Underbench Cupboards', 'Overhead Cupboards', 'Linen Cupboards'),
        tidy: ALL_ROOMS.every(r => r.subsections[r.subsections.length - 1] === 'Additional' && new Set(r.subsections).size === r.subsections.length),
        longest: Math.max(...ALL_ROOMS.map(r => r.subsections.length)),
        count: ALL_ROOMS.length,
        byName: [templateRowsForName('Pool').join('|') === rows('pool').join('|'), templateRowsForName('Spa area').join('|') === rows('pool').join('|'),
          templateRowsForName('Bathroom/Laundry').join('|') === rows('bathroom_laundry').join('|'), templateRowsForName('Kitchen/Laundry').includes('Washing Machine Taps')],
        toggles: [...document.querySelectorAll('#roomsSelect .room-toggle')].filter(t => /^(pool|bathroom_laundry)$/.test(t.dataset.id)).map(t => t.dataset.id + ':' + t.classList.contains('selected')),
        spoken: (() => { state.rooms = [{ id: 'bathroom_laundry', name: 'Bathroom/Laundry', subsections: rows('bathroom_laundry') }]; const a = checkSpokenRoom({ roomId: 'bathroom_laundry' }, 'Coming into the bathroom now.'); state.rooms = []; return a; })()
      };
    });
    check('R20: Front Gardens has Aircon Motor (palm card); verandah stays one row', r1.front, r1);
    check('R20: Garage has Hooks and Garbage Bins', r1.garage, r1);
    check('R20: every bedroom (and the study) has Screen Door/Handles after the door', r1.beds, r1);
    check('R20: Kitchen skirting is Skirting/Kickboards; pantry stays one row', r1.kitchen, r1);
    check('R20: wet rooms and the balcony say Flooring/Drains', r1.drains, r1);
    check('R20: Rear Exterior has Aircon Motor, Garbage Bins and Exterior Flooring/Drains; no Pool row', r1.rear, r1);
    check('R20: new Pool/Spa room with the palm card rows (water condition in its row name)', r1.pool === 'Fences/Gate|Garden Beds|Reticulation|Pool/Spa/Water Condition|Pool/Spa Pumps|Taps & Hoses|Additional', r1.pool);
    check('R20: new Bathroom/Laundry room keeps the laundry rows apart from the bathroom ones', r1.bl, r1);
    check('R20: tidy: every room ends with Additional, no row twice, none longer than 35 rows; 26 rooms', r1.tidy && r1.longest <= 35 && r1.count === 26, r1);
    check('R20: rooms named Pool, Spa area, Bathroom/Laundry get the new rows; Kitchen/Laundry still gets laundry rows', r1.byName.every(Boolean), r1.byName);
    check('R20: Pool/Spa and Bathroom/Laundry are on the Start screen, not ticked by default', r1.toggles.sort().join(',') === 'bathroom_laundry:false,pool:false', r1.toggles);
    check('R20: saying "bathroom" in the Bathroom/Laundry is not a wrong-room warning', r1.spoken === null, r1.spoken);
    // The typist editor uses the same rows.
    {
      const ed = require('fs').readFileSync(__dirname + '/../editor.html', 'utf8');
      const block = ed.slice(ed.indexOf('const ROWS_BED'), ed.indexOf('const rowsOf'));
      const T = new Function(block.replace(/const T_ROWS/, 'return (T_ROWS') .replace(/\};\s*\/\/ Same rules[\s\S]*$/, '}, T_ROWS);'))();
      const app = await page.evaluate(() => ALL_ROOMS.map(r => [r.id, r.subsections.join('|')]));
      const diff = app.filter(([id, rows]) => T[id] !== rows).map(([id]) => id);
      check('R20: the typist editor\'s rows match the app for every room', diff.length === 0, diff);
      const so = ed.slice(ed.indexOf('const rowKey'), ed.indexOf('const liveSents'));
      const sheet = new Function('templateRows', so + '; return sheetRows;')(() => ['Ceiling', 'Flooring/Drains', 'Skirting/Kickboards', 'Additional']);
      const rowsOld = sheet({}, { secs: [{ name: 'Flooring' }, { name: 'Skirting' }, { name: 'Ceiling' }] });
      const rowsNew = sheet({}, { secs: [{ name: 'Flooring/Drains' }, { name: 'Flooring' }] });
      check('R20 review: in the typist editor, a job from before round 20 fills renamed rows ("Flooring" → Flooring/Drains), no "not a template row" copy', rowsOld.map(r => r.name + ':' + r.i).join(',') === 'Ceiling:2,Flooring/Drains:0,Skirting/Kickboards:1,Additional:null' && rowsNew.filter(r => r.extra).map(r => r.name).join(',') === 'Flooring', { rowsOld, rowsNew });
    }

    // 2. Start screen: Gas Meter instead of Smoke Alarms, a photo tile under each item.
    const r2 = await page.evaluate(() => ({
      keys: [...document.querySelectorAll('#setupMandatory input[data-mand]')].map(i => i.dataset.mand).join(','),
      tiles: [...document.querySelectorAll('#setupMandatory .mand-photo')].map(t => t.id).join(','),
      need: [...document.querySelectorAll('#setupMandatory .mand-ph-note.need')].length,
      text: document.getElementById('setupMandatory').innerText
    }));
    check('R20: Start screen has Water Meter Reading and Location, RCD, Gas Meter Reading, NBN; no Smoke Alarms', r2.keys === 'waterMeter,waterMeterLocation,rcdBox,gasMeter,nbnBox' && !/Smoke/i.test(r2.text) && /Gas Meter Reading/.test(r2.text), r2);
    check('R20: a photo tile under the water meter, RCD box, gas meter and NBN box, each "Photo needed"', r2.tiles === 'mandph-setup-waterMeter,mandph-setup-rcdBox,mandph-setup-gasMeter,mandph-setup-nbnBox' && r2.need === 4 && (r2.text.match(/Photo needed/g) || []).length === 4, r2);
    const camAttr = await page.evaluate(() => { mandPhotoInput(); const el = document.getElementById('mandPhotoInput'); return { accept: el.accept, capture: el.hasAttribute('capture') }; });
    check('R20: the photo button offers camera or photo library (no forced camera)', camAttr.accept === 'image/*' && !camAttr.capture, camAttr);

    // 3. A photo before Start stays on the phone, survives a reload, and is not sent yet.
    await page.evaluate(() => { cloudArchiveEnabled = () => true; });
    await snap('#mandph-setup-waterMeter button', 'meter.jpg');
    const r3 = await page.evaluate(async () => {
      const list = JSON.parse(localStorage.getItem('pa_setup_mand_photos') || '{}');
      const id = list.waterMeter && list.waterMeter[0].id;
      const rec = id ? await photoGet(id) : null;
      await processPhotoQueue();
      return { n: (list.waterMeter || []).length, setup: !!(rec && rec.setup), kind: rec && rec.kind, label: rec && rec.label, note: document.querySelector('#mandph-setup-waterMeter .mand-ph-note').textContent,
        has: document.querySelector('#mandph-setup-waterMeter .inv-cam').classList.contains('has'), toast: window.__toasts.slice(-1)[0] };
    });
    check('R20: a Start-screen photo is saved on the phone with its item, waiting for the job', r3.n === 1 && r3.setup && r3.kind === 'mandatory' && r3.label === 'Water Meter', r3);
    check('R20: the tile shows the photo and "sends after Start"', r3.has && /1 photo · sends after Start/.test(r3.note) && /sends after Start/.test(r3.toast), r3);
    check('R20: nothing is sent to Dropbox before Start (no job folder yet)', !puts.some(p => /Mandatory/.test(p.path)), puts.map(p => p.path));
    await page.reload(); await page.waitForSelector('#setupMandatory');
    await page.evaluate(() => { cloudArchiveEnabled = () => true; });
    await wait(300);
    const r3b = await page.evaluate(() => ({ has: document.querySelector('#mandph-setup-waterMeter .inv-cam').classList.contains('has'), src: !!(document.querySelector('#mandph-setup-waterMeter img') || {}).src }));
    check('R20: the Start-screen photo is still there after the app reloads', r3b.has && r3b.src, r3b);

    // 4. Start: the photo joins the job and goes to Photos/ with its name.
    await page.fill('#mand-setup-gasMeter', '01234.5 m3');
    await startJob(page, '20 Palm Card St');
    await wait(300);
    const r4 = await page.evaluate(async () => {
      const m = state.mandPhotos.waterMeter || [];
      const rec = m[0] ? await photoGet(m[0].id) : null;
      await processPhotoQueue();
      const after = m[0] ? await photoGet(m[0].id) : null;
      return { n: m.length, setupLeft: localStorage.getItem('pa_setup_mand_photos'), stamped: !!rec && !rec.setup && rec.jobId === state.jobId && rec.address === '20 Palm Card St',
        uploaded: !!(after && after.uploaded) && m[0].uploaded === true, gas: state.mandatory.gasMeter, smoke: 'smokeAlarms' in state.mandatory,
        folder: archiveFolderName({ address: state.address, meta: inspectionMeta(), createdAt: state.startedAt }), hhmm: new Date(rec.createdAt).toTimeString().slice(0, 5).replace(':', ''), id: m[0].id };
    });
    check('R20: at Start the photo joins the job (job and address on the phone record); the Start screen is cleared', r4.n === 1 && r4.stamped && r4.setupLeft === '{}' , r4);
    check('R20: Gas Meter Reading typed on Start goes into the job; no smoke alarm field', r4.gas === '01234.5 m3' && !r4.smoke, r4);
    const p1 = r4.folder + '/Photos/00 Mandatory - Water Meter 1 - ' + r4.hhmm + ' - ' + r4.id + '.jpg';
    check('R20: in Dropbox as "<date> - <address>/Photos/00 Mandatory - Water Meter 1 - <hhmm> - <photo no>.jpg"', puts.some(p => p.path === p1 && p.type === 'image/jpeg' && p.size === JPG.length), { want: p1, got: puts.map(p => p.path) });
    check('R20: marked sent once Dropbox has it', r4.uploaded, r4);

    // 5. Review: more photos, numbered per item; Finish asks about what is missing.
    await page.evaluate(() => showReview()); await wait(300);
    const r5 = await page.evaluate(() => ({ open: document.getElementById('reviewMandatory').open, tiles: document.querySelectorAll('#reviewMandatory .mand-photo').length,
      note: document.querySelector('#mandph-review-waterMeter .mand-ph-note').textContent, line: (document.getElementById('attnMandatory') || {}).textContent || '' }));
    check('R20: Review shows the photo tiles, the water meter one already "in Dropbox"', r5.open && r5.tiles === 4 && /1 photo · in Dropbox/.test(r5.note), r5);
    check('R20: "Before you finish" counts the missing photos', /Mandatory items still needed: 6 \(see Mandatory items\)/.test(r5.line), r5.line);
    await snap('#mandph-review-rcdBox button', 'rcd.jpg');
    await snap('#mandph-review-waterMeter button', 'meter2.jpg');
    const r5b = await page.evaluate(async () => {
      await processPhotoQueue();
      return { missing: checkMandatory(), wm: state.mandPhotos.waterMeter.map(p => p.n).join(','), note: document.querySelector('#mandph-review-waterMeter .mand-ph-note').textContent,
        report: buildReportText(), csv: buildCSVString(), sub: document.getElementById('reviewMandSub').textContent };
    });
    check('R20: a second water meter photo is number 2; the RCD box photo is number 1', puts.some(p => /\/Photos\/00 Mandatory - Water Meter 2 - \d{4} - \d+\.jpg$/.test(p.path)) && puts.some(p => /\/Photos\/00 Mandatory - RCD Box 1 - \d{4} - \d+\.jpg$/.test(p.path)) && r5b.wm === '1,2', puts.map(p => p.path));
    check('R20: every mandatory photo is in the job\'s folder (never "Unknown property")', puts.filter(p => /Mandatory/.test(p.path)).every(p => p.path.startsWith(r4.folder + '/Photos/')), puts.map(p => p.path));
    check('R20: still needed: the readings not typed, and the gas meter and NBN photos', r5b.missing.join('|') === 'Water Meter Reading|RCD Box|NBN Box|Gas Meter photo|NBN Box photo' && r5b.sub === '5 still needed', r5b);
    check('R20: details file lists Gas Meter and the photo count per item', /Gas Meter: 01234\.5 m3/.test(r5b.report) && /Photos \(in Photos, named "00 Mandatory"\): Water Meter 2, RCD Box 1, Gas Meter none, NBN Box none/.test(r5b.report) && !/Smoke Alarms/.test(r5b.report), r5b.report.slice(0, 700));
    check('R20: CSV has a Gas Meter row', /"Mandatory Items","Gas Meter","01234\.5 m3"/.test(r5b.csv));

    // 6. A Start-screen photo of a resumed job, and one the Dropbox pass has to finish joining.
    const r6 = await page.evaluate(async () => {
      const id = await photoAdd({ kind: 'mandatory', field: 'nbnBox', label: 'NBN Box', n: 1, roomId: '_mandatory', roomName: 'Mandatory items', createdAt: Date.now(), blob: new Blob([new Uint8Array(12)], { type: 'image/jpeg' }), type: 'image/jpeg', uploaded: false, setup: true });
      state.mandPhotos.nbnBox = [{ id, n: 1, ts: Date.now(), uploaded: false, pending: true }];
      await processPhotoQueue();
      const rec = await photoGet(id);
      return { up: !!rec.uploaded, job: rec.jobId === state.jobId, mark: state.mandPhotos.nbnBox[0].uploaded === true && !state.mandPhotos.nbnBox[0].pending };
    });
    check('R20: a Start-screen photo not yet joined is joined and sent by the Dropbox pass', r6.up && r6.job && r6.mark && puts.some(p => /\/Photos\/00 Mandatory - NBN Box 1 - \d{4} - \d+\.jpg$/.test(p.path)), r6);
    const r6b = await page.evaluate(async () => {
      flushSaveState();
      // A photo taken on the Start screen while this job is saved, then the job is resumed.
      const id = await photoAdd({ kind: 'mandatory', field: 'gasMeter', label: 'Gas Meter', n: 1, roomId: '_mandatory', roomName: 'Mandatory items', createdAt: Date.now(), blob: new Blob([new Uint8Array(12)], { type: 'image/jpeg' }), type: 'image/jpeg', uploaded: false, setup: true });
      localStorage.setItem('pa_setup_mand_photos', JSON.stringify({ gasMeter: [{ id, n: 1, ts: Date.now() }] }));
      return id;
    });
    const resumeAsked = [];
    page.once('dialog', d => { resumeAsked.push(d.message()); d.accept(); });
    await page.reload(); await wait(500);
    await page.evaluate(() => { cloudArchiveEnabled = () => true; });
    // The app resumes a recent job by itself on reload.
    await page.evaluate(() => { if (!document.getElementById('screenInspection').classList.contains('active')) resumeSaved(); }); await wait(500);
    const r6c = await page.evaluate(async (id) => {
      const rec = await photoGet(id);
      return { listed: (state.mandPhotos.gasMeter || []).some(p => p.id === id), stamped: !!rec && !rec.setup && rec.jobId === state.jobId, rooms: state.rooms.length, others: (state.mandPhotos.waterMeter || []).length };
    }, r6b);
    check('R20 review: resuming asks before a Start-screen photo joins the job', resumeAsked.length === 1 && /1 mandatory item photo was taken on the Start screen\. Add it to 20 Palm Card St\?/.test(resumeAsked[0]), resumeAsked);
    check('R20: resuming a job takes in the Start-screen photo once accepted; the job\'s rooms and other photos are kept', r6c.listed && r6c.stamped && r6c.rooms > 0 && r6c.others === 2, r6c);
    const r6d = await page.evaluate(async () => {
      // Review fixes: old photos ask at Start; Cancel keeps them on the Start screen; a photo left unstamped at Finish still goes;
      // marks of photos sent while the job was closed show as sent; wrong-room warnings for the new rooms.
      const was = { address: state.address, jobId: state.jobId };
      const id = await photoAdd({ kind: 'mandatory', field: 'rcdBox', label: 'RCD Box', n: 1, roomId: '_mandatory', roomName: 'Mandatory items', createdAt: Date.now(), blob: new Blob([new Uint8Array(12)], { type: 'image/jpeg' }), type: 'image/jpeg', uploaded: false, setup: true });
      setupMandPhotos = { rcdBox: [{ id, n: 1, ts: Date.now() - 13 * 3600 * 1000 }] };
      const oc = window.confirm; let q = ''; window.confirm = (m) => { q = m; return false; };
      const before = (state.mandPhotos.rcdBox || []).length;
      await attachSetupMandPhotos(false);
      const kept = (setupMandPhotos.rcdBox || []).length === 1 && (state.mandPhotos.rcdBox || []).length === before;
      window.confirm = oc;
      setupMandPhotos = {}; saveSetupMandPhotos();
      saveMandLeft([{ id, n: 7, job: { address: 'Old Job St', jobId: 'old-job', client: 'C', meta: { startedAt: Date.now() } } }]);
      await processPhotoQueue();
      const sent = await photoGet(id);
      const leftAfter = mandLeftList().length;
      state.mandPhotos.rcdBox.push({ id: 987654, n: 9, ts: Date.now(), uploaded: false });
      await refreshMandPhotoMarks();
      const refreshed = state.mandPhotos.rcdBox.find(p => p.id === 987654).uploaded === true;
      state.mandPhotos.rcdBox = state.mandPhotos.rcdBox.filter(p => p.id !== 987654);
      const keepRooms = state.rooms;
      state.rooms = [{ id: 'bathroom_laundry', name: 'Bathroom/Laundry', subsections: [] }, { id: 'pool', name: 'Pool/Spa', subsections: [] }, { id: 'rear_exterior', name: 'Rear Exterior', subsections: [] }, { id: 'laundry', name: 'Laundry', subsections: [] }];
      const w = [checkSpokenRoom({ roomId: 'laundry' }, 'Coming into the bathroom and laundry.'), checkSpokenRoom({ roomId: 'pool' }, 'Now in the rear pool area.'), checkSpokenRoom({ roomId: 'rear_exterior' }, 'Coming into the pool area.')];
      const real = checkSpokenRoom({ roomId: 'pool' }, 'Coming into the kitchen.');
      state.rooms = keepRooms; roomMismatches = {};
      return { q, kept, sent: sent === null,   // another job's photo is cleared from the phone once Dropbox has it
 leftAfter, refreshed, w, real: real && real.saidRoom, was };
    });
    check('R20 review: Start-screen photos older than 12 hours ask first; Cancel keeps them on the Start screen', /taken on the Start screen on .+ Add it to 20 Palm Card St\?/.test(r6d.q) && r6d.kept, r6d);
    check('R20 review: a Start-screen photo not stamped before Finish is still sent, into its own job\'s folder', r6d.sent && r6d.leftAfter === 0 && puts.some(p => /^\d{4}-\d{2}-\d{2} - Old Job St\/Photos\/00 Mandatory - RCD Box 7 - \d{4} - \d+\.jpg$/.test(p.path)), { r6d, got: puts.map(p => p.path) });
    check('R20 review: after Resume, a photo sent while the job was closed shows as sent', r6d.refreshed, r6d);
    check('R20 review: no wrong-room warning between Bathroom/Laundry and Laundry, or Pool/Spa and Rear Exterior; a real one names the room', r6d.w.every(x => x === null) && r6d.real === 'Kitchen', r6d);

    // 7. Finish asks about missing items, and Start-screen photos left over still go.
    const asked = [];
    page.on('dialog', d => { asked.push(d.message()); d.type() === 'prompt' ? d.dismiss() : d.dismiss(); });
    await page.evaluate(async () => { state.rooms.forEach(r => { state.skippedRooms[r.id] = true; }); saveState(); await finishAndClear(); });
    check('R20: Finish names the mandatory items still needed (the inspector can still choose to finish)', asked.some(m => /^Mandatory items still needed: Water Meter Reading, RCD Box, NBN Box\.\n/.test(m)), asked);
    // An older job (from round 19) with smoke alarm text keeps it in its files.
    const r7 = await page.evaluate(() => { const was = state.mandatory; state.mandatory = Object.assign(emptyMandatory(), { smokeAlarms: 'Hallway, green light' }); const t = buildReportText(); state.mandatory = was; return t; });
    check('R20: a job from before round 20 keeps its smoke alarm text in the details file', /Smoke Alarms: Hallway, green light/.test(r7), r7.slice(0, 500));
    check('R20: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  // ── Round 21: Stirling replay beside the VA's report; inspector app fixes ──
  {
    let cleanOut = null;
    const page = await newPage(browser, { valHandler: async (route) => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"note":"ready"}' });
      if (u.includes('a1d7b510c12511f1bf831607ee4eb77e')) return route.fulfill({ status: cleanOut ? 200 : 502, contentType: 'application/json', body: JSON.stringify(cleanOut || { ok: false, error: 'no' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    } });

    // 1. A bathroom on its own is "Bathroom", not "Bathroom 2".
    const b1 = await page.evaluate(() => {
      const pick = ids => { setAllRooms(false); ids.forEach(id => document.querySelector(`#roomsSelect .room-toggle[data-id="${id}"]`).classList.add('selected')); };
      document.getElementById('propAddress').value = '21 Bath St'; document.getElementById('propClient').value = 'C'; document.getElementById('propInspector').value = 'B';
      ['propAddress', 'propClient', 'propInspector'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true })));
      pick(['kitchen', 'bathroom2']); startInspection();
      const one = state.rooms.map(r => r.name).join(',');
      const baths = state.baths;
      return { one, baths };
    });
    check('R21: a property with one bathroom calls it "Bathroom", not "Bathroom 2"', b1.one.split(',').sort().join(',') === 'Bathroom,Kitchen' && b1.baths === 1, b1);
    // Discard it (nothing recorded), then a job with an ensuite keeps "Bathroom 2".
    page.once('dialog', d => d.accept());
    await page.evaluate(() => discardInspection());
    await page.waitForSelector('#screenSetup.active');
    const b2 = await page.evaluate(() => {
      setAllRooms(false); ['ensuite', 'bathroom2'].forEach(id => document.querySelector(`#roomsSelect .room-toggle[data-id="${id}"]`).classList.add('selected'));
      document.getElementById('propAddress').value = '21 Two Bath St'; document.getElementById('propClient').value = 'C'; document.getElementById('propInspector').value = 'B';
      ['propAddress', 'propClient', 'propInspector'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true })));
      startInspection();
      const names = state.rooms.map(r => r.name).join(',');
      return { names };
    });
    check('R21: with an ensuite as well, the main bathroom stays "Bathroom 2"', b2.names === 'Ensuite,Bathroom 2', b2);
    page.once('dialog', d => d.accept());
    await page.evaluate(() => discardInspection());
    await page.waitForSelector('#screenSetup.active');
    await page.evaluate(() => setAllRooms(true));
    await startJob(page, '21 Stirling Replay St');
    await page.evaluate(() => {
      window.__rec = (o) => Object.assign({ roomId: 'r21_' + o.roomName, address: state.address, jobId: state.jobId, meta: inspectionMeta(), type: 'audio/webm',
        blob: new Blob([new Uint8Array(20)]), engine: 'assemblyai', status: 'done', createdAt: Date.now() + (o.part || 1), roomNo: 1, part: 1, cleanedBy: 'claude-sonnet-5-5', check: [] }, o);
    });

    // 2. Long checklist rows wrap on the phone instead of running off the edge.
    const c1 = await page.evaluate(() => {
      const i = state.rooms.findIndex(r => r.subsections.some(s => /^Wardrobe\//.test(s)));
      state.currentRoomIdx = i; checklistOpen = true; renderInspection();
      const items = [...document.querySelectorAll('#checklistBox .checklist-item')];
      const w = items.find(x => /^Wardrobe/.test(x.textContent));
      const box = document.getElementById('checklistBox').getBoundingClientRect();
      const t = w.querySelector('.cl-text').getBoundingClientRect();
      return { label: w.textContent, html: w.querySelector('.cl-text').innerHTML, fits: t.right <= box.right + 0.5 && t.right <= window.innerWidth, twoLines: t.height > 30,
        saved: room => 0, name: state.rooms[i].subsections.find(s => /^Wardrobe\//.test(s)), next: document.querySelector('#nextSub strong') ? document.querySelector('#nextSub strong').innerHTML : '' };
    });
    check('R21: the long wardrobe row wraps inside the checklist (no running off the phone screen)', c1.fits && c1.twoLines && /\/<wbr>/.test(c1.html), c1);
    check('R21: checklist rows read with capitals ("Ceiling/Wall/Skirting"); the row name itself is unchanged', /Doors\/Ceiling\/Wall\/Skirting\/Flooring\/Shelves/.test(c1.label) && c1.name === 'Wardrobe/Doors/ceiling/wall/skirting/flooring/Shelves', c1);
    const c2 = await page.evaluate(() => { const room = state.rooms[state.currentRoomIdx]; const sub = room.subsections[0]; toggleCheck(room.id, 0); const ok = !!state.checked[room.id][sub]; toggleCheck(room.id, 0); return { ok, sub }; });
    check('R21: ticking a row still saves under its real name', c2.ok, c2);

    // 3. "Send this property's audio to the VA" is gone; Back stays.
    const s1 = await page.evaluate(() => { showRecordings(); return { btn: !!document.querySelector('#screenRecordings [onclick*="shareAll"]'), text: /Send this property/.test(document.getElementById('screenRecordings').textContent), fn: typeof window.shareAllRecordings, back: !!document.querySelector('#screenRecordings .rec-back') }; });
    check('R21: the "Send this property\'s audio to the VA" button is gone; Back is still there', !s1.btn && !s1.text && s1.fn === 'undefined' && s1.back, s1);
    await page.evaluate(() => closeRecordings());

    // 4. A recording with no length (Android .webm) is read through once, then starts at 0:00.
    const a1 = await page.evaluate(() => {
      const fake = new EventTarget(); fake.duration = Infinity; fake.currentTime = 0;
      fixAudioLength(fake);
      fake.dispatchEvent(new Event('loadedmetadata'));
      const jumped = fake.currentTime;
      fake.dispatchEvent(new Event('durationchange'));   // still unknown: stays
      const still = fake.currentTime;
      fake.duration = 14.2; fake.dispatchEvent(new Event('durationchange'));
      const back = fake.currentTime;
      const known = new EventTarget(); known.duration = 14.2; known.currentTime = 0; fixAudioLength(known); known.dispatchEvent(new Event('loadedmetadata'));
      return { jumped, still, back, known: known.currentTime, pre: fake.preload, used: /fixAudioLength\(audio\)/.test(renderRecordings.toString()) && (renderRecordings.toString().match(/fixAudioLength\(audio\)/g) || []).length === 2 };
    });
    check('R21: a recording with no stored length is read through once, then goes back to 0:00 (the bar no longer sits at the end)', a1.jumped === 1e101 && a1.still === 1e101 && a1.back === 0 && a1.known === 0 && a1.pre === 'metadata' && a1.used, a1);

    // 5. Real words that read normally but were wrong in the Stirling replay are always highlighted.
    const h1 = await page.evaluate(() => {
      const bad = ['Drawer is a glass pane, interior is a grey metal.', 'Interior has one grey plastic sensor, one silver filter in good condition.',
        'One single light switch, three dual power points, one single 12-volt and data point combination.', "There's two red sliding doors, black metal framing.",
        'Shelf, walnut laminate shelves secured with a white laminate panel.', 'Shower screen, three glass panes, got a black vinyl framing.', 'No island tops present.',
        'There are small scuff marks along a section of wall.', 'There is small smudge marks along sections of the wall.', "There's got to be a single glass pane.",
        'One black metal flyscreen door with a black metal handle, skidder both sides.', 'Four white window down skidder.', 'There are two zip closures present, both functional.',
        'There are five black ceramic inbuilt blenders.', 'Mixer tap and decanter are both present.', 'Walmart Classic Mitsubishi Electric air conditioner.',
        'Two grabber cooking trays.', 'Towel rail, once a big tub towel rail secured to the wall.', 'One grey plastic person, light-fitting.', 'Light-fitting security function.',
        'Two clothes present with a frosted plastic cover.', 'Grey tall grey grout, discretion to the grout.', 'Serum number is 7YU02369.', 'Motor number is MXZ4E80VAD.'];
      const good = ['Two white metal downlights, secured and functional.', 'One single light switch and one double power point.', 'Door is a glass pane.',
        'One white plastic smoke sensor secured to the ceiling.', 'Small scuff marks to the lower section of the wall.', 'One single Foxtel and data point combination.',
        'Two mirrored sliding doors secured in black metal framing.', 'Grey tile, grey grout with discolouration to the grout.', 'One silver metal double towel rail secured to the wall.',
        'Two globes present with a frosted plastic cover.', 'One grey metal Mitsubishi air conditioner motor secured to the wall.', 'Three white laminate drawers, no handles present.'];
      return { missed: bad.filter(t => !suspectSpans(t).length), wrong: good.filter(t => suspectSpans(t).some(sp => !/\d/.test(t.slice(sp[0], sp[1])))) };
    });
    check('R21: the Stirling replay\'s wrong-but-normal words are always highlighted (drawer/door, sensor, 12-volt, red, walnut, vinyl, island tops, along a section …)', !h1.missed.length, h1.missed);
    check('R21: the right words are not highlighted (downlights, Foxtel, mirrored, smoke sensor, lower section, globes …)', !h1.wrong.length, h1.wrong);

    // 6. A check that quotes two sentences highlights the right one; one note per sentence.
    const q1 = await page.evaluate(() => {
      const c = [{ quote: 'No island tops present. Toilet holders secured to the wall.', words: 'island tops', why: 'mis-heard' }];
      const c2 = [{ quote: 'No island tops present. Toilet holders secured to the wall.', words: 'Toilet holders', why: 'possibly toilet roll holder' }];
      const a = highlightSpans('No island tops present.', c), b = highlightSpans('Toilet holders secured to the wall.', c), d = highlightSpans('Toilet holders secured to the wall.', c2);
      const subs = ['Toilet Roll Holder', 'Additional'];
      const rec = __rec({ roomName: 'Bathroom', roomId: 'b21', subsections: subs, transcript: 'No island tops present. Toilet holders secured to the wall. Something garbled here.', words: [],
        sections: [{ name: 'Toilet Roll Holder', text: 'No island tops present. Toilet holders secured to the wall.' }, { name: 'Additional', text: 'No additional present.' }],
        check: [{ quote: 'No island tops present. Toilet holders secured to the wall.', words: 'island tops', why: 'mis-heard' },
          { quote: 'No island tops present. Toilet holders secured to the wall.', words: 'Toilet holders', why: 'possibly toilet roll holder' },
          { quote: 'Something garbled was said.', words: 'garbled', why: 'mis-heard', clock: '1:24' },
          { quote: 'Something garbled was said.', words: 'garbled', why: 'unclear area', clock: '1:24' },
          { quote: 'Something garbled was said.', words: 'garbled', why: 'unclear area', clock: '1:24' }] });
      const m = buildJobModel([rec], {});
      const notes = m.rooms[0].notes.filter(n => /^Also to check/.test(n));
      const row = m.rooms[0].rows.find(r => r.name === 'Toilet Roll Holder');
      return { a, b, d, notes, spans: row.sents.map(x => x.spans.map(sp => x.text.slice(sp[0], sp[1]))) };
    }).catch(e => ({ err: String(e) }));
    check('R21: a check quoting two sentences highlights its words in the right sentence only', q1.a && q1.a.length === 1 && q1.b.length === 0 && q1.d.length === 1 && JSON.stringify(q1.spans) === '[["island tops"],["Toilet holders"]]', q1);
    check('R21: the same unplaced sentence is named once at the top of the room, with each reason', q1.notes && q1.notes.length === 1 && (q1.notes[0].match(/Something garbled was said/g) || []).length === 1 && /mis-heard; unclear area; 1:24/.test(q1.notes[0]) && !/island tops/.test(q1.notes[0]), q1.notes);

    // 7. "Coming into the entry/kitchen" is a walk-through phrase, not a miss.
    const w1 = await page.evaluate(() => ({
      slash: missingPhrases('Uh, coming into the entry/kitchen, uh, door frame, one section is a white painted metal.', [{ name: 'Door', text: 'Door frame, one section is a white painted metal.' }]),
      kept: missingPhrases('Coming into the kitchen there is a crack to the door.', [{ name: 'Door', text: 'Door is white.' }])
    }));
    check('R21: "Coming into the entry/kitchen" is no longer listed as said but not in the sorted text', w1.slash.length === 0 && w1.kept.length === 1, w1);

    // 8. The speech engine repeating itself (and skipping audio) is pointed out.
    const r1 = await page.evaluate(() => {
      const words = []; let t = 6;
      const add = (s, step) => s.split(' ').forEach(w => { words.push({ w, s: Math.round(t * 10) / 10 }); t += step; });
      for (let k = 0; k < 3; k++) add('Doorframe is a grey painted metal with chipping.', 0.1);
      add('Doorframe is a grey painted.', 0.1);
      t = 16; add('We have light-fitting, one grey plastic fluorescent light fitting.', 0.3);
      const raw = words.map(x => x.w).join(' ');
      const runs = repeatRuns(words, raw);
      const none = repeatRuns([], 'One section is wooden painted white with scuff marks. Other section is a brown wood look. One one double power point. No hooks, no hooks present.');
      const noTimes = repeatRuns([], 'Ceiling is grey painted. Ceiling is grey painted. Walls are grey.');
      const rec = __rec({ roomName: 'Store Room 2', roomId: 's21', subsections: ['Doors/Handles', 'Light Fittings'], transcript: raw, words,
        sections: [{ name: 'Doors/Handles', text: 'Doorframe is a grey painted metal with chipping.' }, { name: 'Light Fittings', text: 'We have light-fitting, one grey plastic fluorescent light fitting.' }] });
      const notes = buildJobModel([rec], {}).rooms[0].notes.filter(n => /same words repeat/.test(n));
      const txt = buildArchiveText(rec, raw);
      const json = buildRoomJson(rec, raw);
      return { runs, none, noTimes, notes, txt: /LISTEN HERE: THE RECORDING MAY HAVE BEEN SKIPPED\n  The same words repeat: “Doorframe is a grey painted metal with chipping” \(0:06–0:16\)/.test(txt), json: json.repeats };
    });
    check('R21: words the engine wrote over and over are found, with where to listen (0:06–0:16)', r1.runs.length === 1 && r1.runs[0].phrase === 'Doorframe is a grey painted metal with chipping' && r1.runs[0].from === 6 && r1.runs[0].to === 16, r1.runs);
    check('R21: ordinary speech and short restarts ("one one double", "no hooks, no hooks") are not called repeats; without timings the words are still named', r1.none.length === 0 && r1.noTimes.length === 1 && r1.noTimes[0].from === null, r1);
    check('R21: the Word file, the room\'s text file and its data file all point the typist to the repeat', r1.notes.length === 1 && /The speech engine may have got stuck and skipped what was said there\. Listen to this part of the audio\./.test(r1.notes[0]) && /\(0:06–0:16\)/.test(r1.notes[0]) && r1.txt && r1.json.length === 1 && r1.json[0].clock === '0:06', r1);

    // 9. The val's reason for a cut-short check list is kept in the room's data file.
    cleanOut = { ok: true, model: 'claude-sonnet-5-5', sections: [{ name: 'Ceiling', text: 'Ceiling is a white painted render.' }], check: [], cut_short: true, cut_reason: 'a check reason ran on (412 characters) (asked twice)' };
    const k1 = await page.evaluate(async () => {
      const rec = { id: 92101, roomId: 'balc', roomName: 'Balcony', address: state.address, jobId: state.jobId, subsections: ['Ceiling', 'Additional'], transcript: 'Balcony, we have ceiling is a white painted render.', words: [], createdAt: Date.now(), type: 'audio/webm' };
      cleanupReady = true;
      await runCleanup(rec);
      const j = buildRoomJson(rec, 'x');
      return { cut: rec.checkCutShort, reason: rec.checkCutReason, j: j.cutReason, jc: j.cutShort };
    });
    check('R21: why the check list was cut short is kept in the room\'s data file', k1.cut === true && k1.j === 'a check reason ran on (412 characters) (asked twice)' && k1.jc === true, k1);
    cleanOut = { ok: true, model: 'claude-sonnet-5-5', sections: [{ name: 'Ceiling', text: 'Ceiling is a white painted render.' }], check: [] };
    const k2 = await page.evaluate(async () => {
      const rec = { id: 92102, roomId: 'balc', roomName: 'Balcony', address: state.address, jobId: state.jobId, subsections: ['Ceiling', 'Additional'], transcript: 'Ceiling is a white painted render.', words: [], createdAt: Date.now(), type: 'audio/webm', checkCutShort: true, checkCutReason: 'old' };
      cleanupReady = true;
      await runCleanup(rec);
      return { cut: !!rec.checkCutShort, reason: rec.checkCutReason || null, j: buildRoomJson(rec, 'x').cutReason };
    });
    check('R21: a later answer that wasn\'t cut short clears the old reason', !k2.cut && k2.reason === null && k2.j === null, k2);

    // 10. The details file puts model and serial numbers on their own lines.
    const d1 = await page.evaluate(() => {
      const id = state.rooms[0].id; const was = state.roomNotes[id];
      state.roomNotes[id] = 'Two grey metal cooking trays.\nModel Numbers: Not present\nType: 71ADC01AD\nSerial Numbers: 82897294 We have pantry, two doors.\nModel Numbers: FSE73700P\nSerial Numbers: 83840019 We have fridge cabinetry.\nModel Numbers: MSZ GE60VAD\nSerial Numbers: Unable to locate.';
      const t = buildReportText(); state.roomNotes[id] = was; return t;
    });
    check('R21: in the details file a serial number ends its line ("Serial Numbers: 82897294" / "We have pantry")', /Serial Numbers: 82897294\nWe have pantry, two doors\./.test(d1) && /Serial Numbers: 83840019\nWe have fridge cabinetry\./.test(d1) && /Type: 71ADC01AD\nSerial/.test(d1) && /Model Numbers: MSZ GE60VAD\n/.test(d1) && /Serial Numbers: Unable to locate\./.test(d1), d1.slice(d1.indexOf('Two grey'), d1.indexOf('Two grey') + 400));

    // 11. Discard: no "every room recorded" check, nothing deleted, marked in Dropbox.
    const n0 = await page.evaluate(async () => {
      const rec = __rec({ roomName: 'Kitchen', roomId: 'kitchen', subsections: ['Ceiling'], transcript: 'Ceiling is white.', words: [], sections: [{ name: 'Ceiling', text: 'Ceiling is white.' }], status: 'pending' });
      delete rec.id; const id = await dbAdd(rec); window.__discId = id;
      return { id, btn: !!document.getElementById('btnDiscard'), under: (() => { const f = document.getElementById('btnFinish'), d = document.getElementById('btnDiscard'); return !!(f && d && (f.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING)); })() };
    }).catch(e => ({ err: String(e) }));
    const asked21 = [];
    const onDlg = d => { asked21.push(d.type() + ':' + d.message()); d.type() === 'confirm' ? d.dismiss() : d.dismiss(); };
    page.on('dialog', onDlg);
    await page.evaluate(() => discardInspection());
    const n1 = await page.evaluate(() => ({ still: !!state.address, screen: document.querySelector('.screen.active').id }));
    page.off('dialog', onDlg);
    check('R21: Discard sits under Finish on the Review page', n0.btn && n0.under, n0);
    check('R21: Discard asks first, naming what is kept; Cancel keeps the inspection', asked21.length === 1 && /^confirm:Discard this inspection and start again\?\n\n1 recording from it stays under Recordings and still goes to Dropbox, marked "discarded"\. Nothing is deleted\./.test(asked21[0]) && n1.still && n1.screen !== 'screenSetup', { asked21, n1 });
    const asked21b = [];
    const onDlg2 = d => { asked21b.push(d.type()); d.accept(); };
    page.on('dialog', onDlg2);
    await page.evaluate(() => discardInspection());
    await page.waitForSelector('#screenSetup.active');
    page.off('dialog', onDlg2);
    const n2 = await page.evaluate(async () => {
      const r = (await dbAll()).find(x => x.id === window.__discId);
      const sum = (await photoAll()).filter(p => p.kind === 'summary' && p.address === '21 Stirling Replay St');
      const text = sum.length ? await sum[sum.length - 1].blob.text() : '';
      return { kept: !!r, discarded: r && r.discarded, closed: r && r.closed, status: r && r.status, blob: !!(r && (r.blob || r.bytesStored)), address: state.address, text, toasts: window.__toasts.slice(-1) };
    });
    check('R21: Discard needs no "every room recorded" answer (only the one question)', asked21b.join(',') === 'confirm', asked21b);
    check('R21: after Discard the recording is still on the phone and still sending, marked discarded', n2.kept && n2.discarded === true && n2.closed === true && n2.status === 'pending' && n2.blob, n2);
    check('R21: the details file says the inspection was discarded; the Start screen is back', /DISCARDED ON THE PHONE/.test(n2.text) && /Discarded on phone: /.test(n2.text) && n2.address === '' && /Discarded\. Ready to start again\./.test(n2.toasts.join(' ')), { text: n2.text.slice(0, 400), toasts: n2.toasts, address: n2.address });
    const n3 = await page.evaluate(() => {
      const folder = '2026-10-13 - 1 A St';
      const old = { address: '1 A St', discarded: true, roomName: 'Kitchen' }, fresh = { address: '1 A St', roomName: 'Kitchen' };
      const a = jobDocRecs([old, fresh], null, folder), b = jobDocRecs([old], null, folder);
      const live = { address: '1 A St', meta: { startedAt: new Date(2026, 9, 13, 9).getTime() } };
      const c = jobDocRecs([old], live, archiveFolderName({ address: '1 A St', meta: live.meta }));
      const model = buildJobModel([__rec({ roomName: 'Kitchen', roomId: 'k', subsections: ['Ceiling'], transcript: 'x', words: [] })], {}); model.discarded = true;
      const xml = buildJobDocXml(model);
      return { a: a.recs.length === 1 && a.recs[0] === fresh && !a.discarded, b: b.recs.length === 1 && b.discarded, c: c.recs.length === 0 && !c.discarded, banner: /Discarded on the phone\./.test(xml) };
    });
    const n4 = await page.evaluate(async () => {
      const id = await dbAdd({ roomId: 'r21_stale', roomName: 'Laundry', address: '1 Stale St', jobId: 'J21', blob: new Blob([new Uint8Array(30)], { type: 'audio/webm' }), type: 'audio/webm', status: 'pending', createdAt: Date.now() });
      const stale = await dbGet(id);
      await dbUpdate(id, r => { r.closed = true; r.discarded = true; r.serialTyped = 'SN-21'; r.inventoryTyped = '2 keys'; });
      stale.status = 'uploading';
      await dbPut(stale);   // a send pass writes its older copy back
      const after = await dbGet(id);
      return { closed: after.closed, discarded: after.discarded, serial: after.serialTyped, inv: after.inventoryTyped, status: after.status };
    });
    check('R21: a send pass writing back an older copy keeps the Finish/Discard marks and the typed serial', n4.closed === true && n4.discarded === true && n4.serial === 'SN-21' && n4.inv === '2 keys' && n4.status === 'uploading', n4);
    check('R21: a restarted job\'s Word file leaves out the discarded rooms; a folder with only discarded rooms says so', n3.a && n3.b && n3.c && n3.banner, n3);
    // 12. Review shows "Mandatory items still needed" once (round 20 left a second copy when a field was typed).
    await startJob(page, '21 Review Once St');
    const m1 = await page.evaluate(async () => {
      await showReview(); paintReviewMandatory(); paintReviewMandatory();
      const n = [...document.querySelectorAll('#reviewBody .attn-row')].filter(r => !r.hidden && /Mandatory items still needed/.test(r.textContent)).length;
      return { n };
    });
    check('R21: Review names the mandatory items still needed once, not twice', m1.n === 1, m1);
    check('R21: no script errors', page.__errors.length === 0, page.__errors);
    await page.close();
  }

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n${pass} of ${pass + fail} checks pass`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error(e); process.exit(2); });
