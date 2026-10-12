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

console.log(out.join('\n') + `\n\n${pass} of ${pass + fail} checks pass`);
process.exit(fail ? 1 : 0);
