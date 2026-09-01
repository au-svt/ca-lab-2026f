#!/usr/bin/env node
// Authoring-time tool: runs a design+testbench through the REAL Icarus Verilog
// WASM engine (the same one public/assets/verilog-wasm/engine.js uses at runtime)
// and extracts a ready-to-embed waveform timeline. Not shipped to the site — this
// is how content/modules.json's `waveform` blocks get generated/verified.
//
// Usage:
//   node scripts/waveform-cli.mjs spec.json
//   cat spec.json | node scripts/waveform-cli.mjs -
//
// spec.json:
//   {
//     "design": "module foo(...); ... endmodule",
//     "testbench": "module tb; ... $dumpfile(\"dump.vcd\"); $dumpvars(0, tb); ... endmodule",
//     "signals": [{"path": "tb.d", "label": "d"}, ...],
//     "maxTime": 42
//   }
//
// Prints JSON to stdout: { ok: true, maxTime, signals: [{label,width,segments}], stdout }
// or { ok: false, error: "..." } on a compile failure. Never throws for a bad
// design — that's an expected outcome you're supposed to see, not a script bug.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseVCD, signalTimeline } from './lib/vcd-parser.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const wasmDir = join(root, 'public/assets/verilog-wasm');
const initIvlpp = (await import(join(wasmDir, 'ivlpp.js'))).default;
const initIvl = (await import(join(wasmDir, 'ivl.js'))).default;
const initVvp = (await import(join(wasmDir, 'vvp.js'))).default;

const ivlConf = () => `basedir:/
module:system.vpi
generation:2005
generation:no-specify
out:/out.vvp
iwidth:32
widthcap:65536
functor:cprop
functor:nodangle
flag:DLL=vvp.tgt
`;

async function preprocessAll(files) {
  const code = [];
  const m = await initIvlpp({ print: s => code.push(s), printErr: () => {} });
  const args = ['-L'];
  for (const f of files) {
    m.FS.writeFile('/' + f.name, f.src.endsWith('\n') ? f.src : f.src + '\n');
    args.push('/' + f.name);
  }
  m.callMain(args);
  return code.join('\n') + '\n';
}

async function compile(srcText) {
  const err = [];
  const m = await initIvl({ print: () => {}, printErr: s => err.push(s) });
  m.FS.writeFile('/ivl.conf', ivlConf());
  m.FS.writeFile('/src.v', srcText);
  m.callMain(['-C/ivl.conf', '--', '/src.v']);
  let vvp = null;
  try { vvp = m.FS.readFile('/out.vvp'); } catch {}
  const errText = err.join('\n').split('\n').filter(l => !/system\.vpi|dynamic linking not enabled/.test(l)).join('\n');
  return { vvp, err: errText };
}

async function simulate(bytes) {
  const out = [];
  const m = await initVvp({ print: s => out.push(s), printErr: s => out.push(s) });
  m.FS.writeFile('/sim.vvp', bytes);
  m.callMain(['/sim.vvp']);
  let vcd = null;
  try { vcd = m.FS.readFile('/dump.vcd', { encoding: 'utf8' }); } catch {}
  return { out: out.join('\n'), vcd };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node scripts/waveform-cli.mjs <spec.json | ->'); process.exit(2); }
  const raw = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
  const spec = JSON.parse(raw);

  const pp = await preprocessAll([{ name: 'design.v', src: spec.design }, { name: 'tb.v', src: spec.testbench }]);
  const compiled = await compile(pp);
  if (!compiled.vvp) {
    console.log(JSON.stringify({ ok: false, error: compiled.err || 'Compilation failed with no diagnostic output.' }, null, 2));
    return;
  }
  const sim = await simulate(compiled.vvp);
  if (!sim.vcd) {
    console.log(JSON.stringify({ ok: false, error: `No VCD produced (missing $dumpfile/$dumpvars in the testbench?). stdout:\n${sim.out}` }, null, 2));
    return;
  }
  const parsed = parseVCD(sim.vcd);
  try {
    const signals = spec.signals.map(s => {
      const t = signalTimeline(parsed, s.path, spec.maxTime);
      return { label: s.label, width: t.width, segments: t.segments };
    });
    console.log(JSON.stringify({ ok: true, maxTime: spec.maxTime, signals, stdout: sim.out }, null, 2));
  } catch (e) {
    const available = [...parsed.byPath.keys()];
    console.log(JSON.stringify({ ok: false, error: `${e.message}\nAvailable signal paths in this VCD: ${available.join(', ')}` }, null, 2));
  }
}

main();
