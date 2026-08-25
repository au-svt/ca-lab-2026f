// Runs real Icarus Verilog (compiled to WebAssembly) entirely client-side: no
// server, nothing sent over the network. Adapted from the three-stage pipeline
// (ivlpp -> ivl -> vvp) used by VeriSim (https://github.com/senolgulgonul/verisim),
// itself a WASM build of Icarus Verilog (GPLv2) — https://github.com/steveicarus/iverilog.
// Loaded lazily (only when a Playground's Run button is first clicked), since the
// three .wasm files are ~2.7MB combined.

let modulesPromise = null;
function loadModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import('./ivlpp.js'),
      import('./ivl.js'),
      import('./vvp.js')
    ]).then(([ivlpp, ivl, vvp]) => ({ initIvlpp: ivlpp.default, initIvl: ivl.default, initVvp: vvp.default }));
  }
  return modulesPromise;
}

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

async function preprocessAll(initIvlpp, files) {
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

async function compile(initIvl, srcText) {
  const err = [];
  const m = await initIvl({ print: () => {}, printErr: s => err.push(s) });
  m.FS.writeFile('/ivl.conf', ivlConf());
  m.FS.writeFile('/src.v', srcText);
  m.callMain(['-C/ivl.conf', '--', '/src.v']);
  let vvpBytes = null;
  try { vvpBytes = m.FS.readFile('/out.vvp'); } catch {}
  // "system.vpi"/"dynamic linking" warnings are expected noise from the WASM port —
  // $display/$monitor/$finish still work (statically linked in), so filter them out.
  const errText = err.join('\n').split('\n').filter(l => !/system\.vpi|dynamic linking not enabled/.test(l)).join('\n');
  return { vvp: vvpBytes, err: errText };
}

async function simulate(initVvp, bytes) {
  const out = [];
  const m = await initVvp({ print: s => out.push(s), printErr: s => out.push(s) });
  m.FS.writeFile('/sim.vvp', bytes);
  m.callMain(['/sim.vvp']);
  return out.join('\n');
}

// Compiles `design` (student code) together with `testbench` (hidden reference
// testbench) and returns the simulation's console output, or a compile error.
export async function runVerilog(design, testbench) {
  const { initIvlpp, initIvl, initVvp } = await loadModules();
  const pp = await preprocessAll(initIvlpp, [{ name: 'design.v', src: design }, { name: 'testbench.v', src: testbench }]);
  const compiled = await compile(initIvl, pp);
  if (!compiled.vvp) return { ok: false, error: compiled.err || 'Compilation failed with no diagnostic output.' };
  const output = await simulate(initVvp, compiled.vvp);
  return { ok: true, output, warnings: compiled.err };
}
