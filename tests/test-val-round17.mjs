// Mocked checks for the round 17 cleanup val (vals/inspectionapp-cleanup.ts). Run from the repo root: node tests/test-val-round17.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
const { build } = createRequire(import.meta.url)(execSync('npm root -g').toString().trim() + '/esbuild');
const root = execSync('npm root -g').toString().trim();
let pass = 0, fail = 0; const out = [];
const check = (n, ok, d) => { ok ? pass++ : fail++; out.push((ok ? 'PASS  ' : 'FAIL  ') + n + (!ok && d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 300) : '')); };
const env = { ANTHROPIC_API_KEY: 'sk-test', PA_KEY: 'k1' };
globalThis.Deno = { env: { get: (k) => env[k] } };
let lastBody = null, reply = null;
globalThis.fetch = async (url, init) => { const b = JSON.parse(init.body); lastBody = b; return { ok: true, status: 200, json: async () => reply(b) }; };
const r = await build({ entryPoints: [fileURLToPath(new URL('../vals/inspectionapp-cleanup.ts', import.meta.url))], bundle: false, write: false, format: 'esm', platform: 'neutral' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const handler = mod.default;
const tool = (input) => ({ model: 'claude-sonnet-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'file_room', input }] });

// GET
let res = await handler(new Request('https://x.web.val.run/'));
let j = await res.json();
check('GET reports round 17 and Sonnet 5.5 by default', j.round === 17 && j.model === 'claude-sonnet-5-5' && j.ok === true, j);

// Rules text
const sys = () => lastBody.system;
reply = () => tool({ sections: [{ name: 'Ceiling', text: 'Ceiling painted white.' }], check: [] });
res = await handler(new Request('https://x.web.val.run/?k=k1', { method: 'POST', body: JSON.stringify({ transcript: 'ceiling painted white', room: 'Kitchen', subsections: ['Ceiling'] }) }));
j = await res.json();
check('POST still returns ok with sections (contract unchanged)', j.ok === true && j.sections[0].name === 'Ceiling' && Array.isArray(j.check), j);
check('Rules: no "about 5 per room" cap any more', !/no more than 5/i.test(sys()) && /ten or more/.test(sys()));
check('Rules: unusual condition words are flagged (spiderwebs, bug screen)', /unusual condition word/.test(sys()) && /spiderwebs/.test(sys()) && /bug screen/.test(sys()));
check('Rules: a self-contradicting "no … in good condition" is flagged', /no detachable showerhead, in good condition/.test(sys()));
check('Rules: Type is written "Type:", never as Model Numbers', /"Type: \(combination\)"/.test(sys()) && /Model Numbers: Not present/.test(sys()));
check('Rules: downlights go under Light Fittings; walk-through phrases dropped', /Downlights, oyster lights/.test(sys()) && /Coming into the bedroom/.test(sys()));
check('Rules: Stirling mishears listed (up and down, foxhole, 7-way, fossil, colour rack, address burns)', ['up and down', 'foxhole', '7-way', 'fossil plastic', 'colour rack', 'address burns'].every(w => sys().includes(w)));
check('Rules: self-corrections keep only the corrected words', /sand— sorry, dust" → "dust"/.test(sys()));
check('Request shape for Sonnet 5.5 unchanged (strict tool, auto, between_tools)', lastBody.tool_choice.type === 'auto' && lastBody.tools[0].strict === true && lastBody.thinking.type === 'between_tools' && lastBody.temperature === undefined, lastBody);

// Word-drop guard still works through fileRoom
reply = () => tool({ sections: [{ name: 'Ceiling', text: 'Ceiling.' }], check: [] });
res = await handler(new Request('https://x.web.val.run/?k=k1', { method: 'POST', body: JSON.stringify({ transcript: 'ceiling painted white with scuff marks near the door and chips to the cornice', room: 'Kitchen', subsections: ['Ceiling'] }) }));
check('Still refuses output that dropped more than a quarter of the words', res.status === 422);
res = await handler(new Request('https://x.web.val.run/', { method: 'POST', body: JSON.stringify({ transcript: 'x', room: 'K', subsections: ['Ceiling'] }) }));
check('Still needs PA_KEY', res.status === 403);

// Stirling test: a good model answer passes every expectation, a bad one fails them.
const good = {
  'Bedroom 1': { sections: [{ name: 'Light Fittings', text: 'Two downlights, secured and functional.' }, { name: 'Ceiling/cornice', text: 'Ceiling is painted white. Spiderwebs present.' }, { name: 'Windows/Screens', text: 'Three glass panes, black framing.' }, { name: 'Power Points/Light Switches', text: 'One single Foxtel and data point combination.' }],
    check: [{ quote: 'Spiderwebs present.', words: 'Spiderwebs', why: 'unusual condition word' }, { quote: 'Three glass panes, black framing.', words: 'black framing', why: 'garbled' }, { quote: 'x', words: 'handy person', why: 'garbled' }] },
  'Lounge': { sections: [{ name: 'Light Fittings', text: 'Four white metal downlights secured.' }, { name: 'Windows/Screens', text: 'Two set of wooden seat and wind ledge.' }, { name: 'Blinds/Curtains', text: 'Small smart architrave section.' }, { name: 'TV/Power Points/Light Switches', text: 'One single Foxtel point.' }],
    check: [{ quote: 'Two set of wooden seat and wind ledge.', words: 'wooden seat and wind ledge', why: 'garbled' }, { quote: 'Small smart architrave section.', words: 'smart architrave', why: 'garbled' }] },
  'Bathroom 1': { sections: [{ name: 'Shower Tapware', text: 'One silver metal detachable showerhead in good condition.' }, { name: 'Shower/Screen/Curtain', text: 'Three glass panes, black vinyl framing.' }, { name: 'Toilet/Cistern/Seat', text: 'One silver metal dual flush button.' }, { name: 'Toilet Roll Holder', text: 'Toilet roll holder secured to the wall.' }],
    check: [1, 2, 3, 4, 5].map(i => ({ quote: 'Three glass panes, black vinyl framing.', words: 'vinyl', why: 'garbled ' + i })) },
  'Kitchen': { sections: [{ name: 'Oven/Griller', text: 'Model Numbers: Not present\nSerial Numbers: 82897294\nType: 71ADC01AD' }, { name: 'Dishwasher', text: 'One grey plastic cutlery rack. Model Numbers: FSE73700P\nSerial Numbers: 83840019' }], check: [] },
};
// Pad the answers so the word-drop guard doesn't refuse them (this test checks the expectations, not the guard).
const pad = (o, t) => ({ ...o, sections: o.sections.concat([{ name: 'Additional', text: 'note '.repeat(t.split(/\s+/).length) }]) });
reply = (body) => { const room = /Room: (.*)\n/.exec(body.messages[0].content)[1]; const t = /"""\n([\s\S]*)\n"""/.exec(body.messages[0].content)[1]; return tool(pad(good[room], t)); };
res = await handler(new Request('https://x.web.val.run/?test=stirling&k=k1'));
j = await res.json();
if (process.env.DBG) console.log(JSON.stringify(j.rooms).slice(0,1500));
check('Stirling test: a good answer passes every expectation', j.ok === true && j.results.every(x => x.result === 'PASS') && j.results.length === 19, j.results && j.results.filter(x => x.result !== 'PASS'));
reply = (body) => { const t = /"""\n([\s\S]*)\n"""/.exec(body.messages[0].content)[1]; return tool({ sections: [{ name: 'Additional', text: t + ' Model Numbers: 71ADC01AD' }], check: [] }); };
res = await handler(new Request('https://x.web.val.run/?test=stirling&k=k1'));
j = await res.json();
check('Stirling test: an unsorted, unflagged answer fails (round 16 behaviour is caught)', j.ok === false && j.results.filter(x => x.result === 'FAIL').length >= 14, j.passed);
res = await handler(new Request('https://x.web.val.run/?test=stirling'));
check('Stirling test needs the key', res.status === 403);

// 17.1: an answer stuck repeating itself inside one check entry (live Stirling Bathroom 1).
res = await handler(new Request('https://x.web.val.run/'));
j = await res.json();
check('17.2: GET reports version 17.2 (round still 17)', j.round === 17 && j.version === '17.2', j);
const post = () => handler(new Request('https://x.web.val.run/?k=k1', { method: 'POST', body: JSON.stringify({ transcript: 'doors painted white metal chip to the frame shower screen black vinyl framing', room: 'Bathroom 1', subsections: ['Door', 'Shower', 'Additional'] }) }));
const goodRoom = { sections: [{ name: 'Door', text: 'Doors painted white {+in good condition+}. Metal chip to the frame.' }, { name: 'Shower', text: 'Shower screen black vinyl framing.' }],
  check: [{ quote: 'Metal chip to the frame.', words: 'Metal chip', why: 'garbled' }, { quote: 'Shower screen black vinyl framing.', words: 'vinyl', why: 'garbled' }] };
const stuck = { sections: goodRoom.sections, check: [{ quote: 'Metal chip to the frame.', words: 'Metal chip', why: 'garbled, unclear. Check audio. ' + 'Ok. Done. End. '.repeat(60) }] };
check('Rules: why is kept to a few words, never repeated', /two to eight plain words/.test(sys()) && /never repeat yourself/.test(sys()));
let calls = 0;
reply = () => (++calls === 1 ? tool(stuck) : tool(goodRoom));
j = await (await post()).json();
check('17.1: a stuck answer is asked again once and the good second answer is used', calls === 2 && j.ok && j.retried === true && !j.cut_short && j.check.length === 2 && j.check[1].words === 'vinyl', { calls, j });
calls = 0;
reply = () => { calls++; return tool(stuck); };
j = await (await post()).json();
check('17.1: stuck twice keeps the sorted text and adds "check list cut short" first (quote without the added phrase, as the app shows it)', calls === 2 && j.ok && j.cut_short === true && j.sections.length === 2 && /check list cut short/.test(j.check[0].why) && j.check[0].quote === 'Doors painted white.', { calls, c: j.check });
check('17.1: the runaway "why" is cut to its first sentence', j.check[1].why === 'garbled, unclear.' , j.check[1]);
calls = 0;
reply = () => { calls++; return { ...tool(goodRoom), stop_reason: calls === 1 ? 'max_tokens' : 'tool_use' }; };
j = await (await post()).json();
check('17.1: an answer that ran out of room (max_tokens) is asked again too', calls === 2 && j.ok && j.retried === true && !j.cut_short, { calls, j });
calls = 0;
reply = () => { calls++; return tool(goodRoom); };
j = await (await post()).json();
check('17.1: a normal answer is asked once, with no retried or cut_short flag', calls === 1 && j.ok && j.retried === undefined && j.cut_short === undefined, { calls, j });

// 17.1: plates always on the check list; run-on "why" text trimmed (second live Stirling run).
reply = () => tool({ sections: [{ name: 'Door', text: 'Doors painted white, metal chip to the frame.' }, { name: 'Shower', text: 'Oven shower vinyl framing.\nModel Numbers: Not present\nType: 71ADC01AD\nSerial Numbers: 82897294' }],
  check: [{ quote: 'Doors painted white, metal chip to the frame.', words: 'metal chip', why: 'garbled, may be door."\n\t\t\t,"heard":"doors painted white' },
    { quote: 'Serial Numbers: 82897294', words: '82897294', why: 'check against the photo' }] });
j = await (await post()).json();
const whys = j.check.map(c => c.quote + ' | ' + c.why);
check('17.1: type number added to the check list when the model left it off', whys.includes('Type: 71ADC01AD | check against the photo'), whys);
check('17.1: a plate already listed is not listed twice; "Not present" is not listed', whys.filter(w => /82897294/.test(w)).length === 1 && !whys.some(w => /Not present/.test(w)), whys);
check('17.1: run-on text after "why" is trimmed', j.check[0].why === 'garbled, may be door.', j.check[0].why);

// 17.1: the Stirling test runs no-thinking and short-thinking side by side; the app keeps no-thinking.
const bodies = [];
reply = (body) => { bodies.push(body); const room = /Room: (.*)\n/.exec(body.messages[0].content)[1]; const t = /"""\n([\s\S]*)\n"""/.exec(body.messages[0].content)[1]; return tool(pad(good[room], t)); };
j = await (await handler(new Request('https://x.web.val.run/?test=stirling&k=k1&compare=1'))).json();
const offB = bodies.filter(b => b.thinking.type === 'between_tools'), lowB = bodies.filter(b => b.thinking.type === 'adaptive');
check('17.1: Stirling test with &compare=1 runs no thinking and short thinking (4 rooms each)', offB.length === 4 && lowB.length === 4 && lowB.every(b => b.output_config.effort === 'low' && b.max_tokens === 16000) && offB.every(b => !b.output_config && b.max_tokens === 8192), bodies.map(b => b.thinking));
check('17.1: comparison lists both, the app still uses no thinking', j.in_use === 'off' && j.compare.length === 2 && j.compare[0].thinking === 'off' && j.compare[1].thinking === 'low' && j.compare.every(c => c.passed === '19 of 19') && j.results.length === 19, j.compare);
calls = 0;
reply = () => { calls++; return tool(calls === 1 ? { ...goodRoom, check: [{ quote: 'Metal chip to the frame.', words: '', why: 'mis-heard handle description, fixed and flagged.\nunclear garbled words' }] } : goodRoom); };
j = await (await post()).json();
check('17.1: a reason that runs across lines counts as stuck and is asked again', calls === 2 && j.retried === true && j.check.length === 2, { calls, j });

bodies.length = 0;
reply = (body) => { bodies.push(body); const room = /Room: (.*)\n/.exec(body.messages[0].content)[1]; const t = /"""\n([\s\S]*)\n"""/.exec(body.messages[0].content)[1]; return tool(pad(good[room], t)); };
j = await (await handler(new Request('https://x.web.val.run/?test=stirling&k=k1'))).json();
check('17.1: Stirling test without &compare asks only 4 rooms, the way the app works', bodies.length === 4 && bodies.every(b => b.thinking.type === 'between_tools') && j.compare.length === 1 && j.passed === '19 of 19', { n: bodies.length, c: j.compare });
calls = 0;
reply = () => { calls++; if (calls === 2) throw new Error('slow'); return tool(stuck); };
j = await (await post()).json();
check('17.1: if asking again fails (error or no answer), the first answer is kept, marked cut short', calls === 2 && j.ok && j.cut_short === true && j.sections.length === 2 && /check list cut short/.test(j.check[0].why), { calls, j });

// Review fixes (12 Oct).
reply = () => tool({ sections: [{ name: 'Door', text: 'Doors painted white, metal chip to the frame.' }, { name: 'Shower', text: 'One grey plastic cutlery rack. Model Numbers: FSE73700P\nModel Numbers: HAF 2000 / Serial Numbers: 8001128 / Type: Not present' }], check: [] });
j = await (await post()).json();
const plates = j.check.filter(c => c.why === 'check against the photo').map(c => c.quote);
check('Review: a plate partway through a line is flagged; " / " plates and spaced models too; "Not present" is not', plates.join('|') === 'Model Numbers: FSE73700P|Model Numbers: HAF 2000|Serial Numbers: 8001128', plates);
calls = 0;
reply = () => { calls++; return calls === 1 ? tool(stuck) : { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here is the room.' }] }; };
j = await (await post()).json();
check('Review: a second answer in plain words does not replace a usable first answer', calls === 2 && j.ok && j.cut_short === true && j.sections.length === 2, { calls, j });
calls = 0;
reply = () => { calls++; return calls === 1 ? tool(stuck) : tool({ sections: [{ name: 'Door', text: 'Doors.' }], check: [] }); };
j = await (await post()).json();
check('Review: a second answer that drops words does not replace a first answer that keeps them', calls === 2 && j.ok && j.cut_short === true && /Shower screen black vinyl framing/.test(j.text), { calls, j });
const realNow = Date.now; let skew = 0; Date.now = () => realNow() + skew;
calls = 0;
reply = () => { calls++; skew += 31000; return tool(stuck); };
j = await (await post()).json();
Date.now = realNow;
check('Review: no second try when the first answer took over 30 s; marked cut short instead', calls === 1 && j.ok && j.cut_short === true && j.retried === undefined, { calls, j });

// 17.2: a long room with nothing to check is asked again (live Stirling Bedroom 1).
const longT = 'walls painted white with scuff marks near the door and spiderwebs present on the ceiling '.repeat(9);
const postLong = () => handler(new Request('https://x.web.val.run/?k=k1', { method: 'POST', body: JSON.stringify({ transcript: longT, room: 'Bedroom 1', subsections: ['Walls', 'Additional'] }) }));
const longSecs = [{ name: 'Walls', text: longT }];
calls = 0;
reply = () => { calls++; return tool({ sections: longSecs, check: calls === 1 ? [] : [{ quote: 'Spiderwebs present on the ceiling.', words: 'spiderwebs', why: 'unusual condition word' }] }); };
j = await (await postLong()).json();
check('17.2: a long room with an empty check list is asked again and the second, fuller list is used', calls === 2 && j.ok && j.retried === true && !j.cut_short && j.check.length === 1 && j.check[0].words === 'spiderwebs', { calls, c: j.check });
calls = 0;
reply = () => { calls++; return tool({ sections: longSecs, check: [] }); };
j = await (await postLong()).json();
check('17.2: still empty the second time: the answer is kept, not marked cut short (the room may be clean)', calls === 2 && j.ok && !j.cut_short && j.check.length === 0, { calls, j });
calls = 0;
reply = () => { calls++; return tool(goodRoom.check ? { ...goodRoom, check: [] } : goodRoom); };
j = await (await post()).json();
check('17.2: a short room with nothing to check is not asked again', calls === 1 && j.ok && j.retried === undefined, { calls });
calls = 0;
reply = () => { calls++; return calls === 1 ? tool({ sections: longSecs, check: [] }) : tool({ sections: [{ name: 'Walls', text: 'Walls.' }], check: [{ quote: 'Walls.', words: 'Walls', why: 'x' }] }); };
j = await (await postLong()).json();
check('17.2: a second answer that drops words does not replace the first', calls === 2 && j.ok && j.text.length > 500, { calls, len: j.text && j.text.length });

console.log(out.join('\n') + `\n\n${pass} of ${pass + fail} checks pass`);
process.exit(fail ? 1 : 0);
