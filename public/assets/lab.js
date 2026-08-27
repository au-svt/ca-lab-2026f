const VERILOG_KEYWORDS = new Set(['module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'assign', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buf', 'always', 'initial', 'begin', 'end', 'if', 'else', 'case', 'endcase', 'function', 'endfunction', 'posedge', 'negedge', 'parameter']);

function highlightVerilog(code) {
  const tokenPattern = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(\d+'[bBhHdD][0-9a-fA-Fxz]*|\b\d+\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z0-9_])/g;
  let html = '';
  let match;
  while ((match = tokenPattern.exec(code))) {
    const [, comment, string, number, ident, space, punct] = match;
    if (comment) html += `<span class="tok-com">${escapeHtml(comment)}</span>`;
    else if (string) html += `<span class="tok-str">${escapeHtml(string)}</span>`;
    else if (number) html += `<span class="tok-num">${escapeHtml(number)}</span>`;
    else if (ident) html += VERILOG_KEYWORDS.has(ident) ? `<span class="tok-kw">${ident}</span>` : `<span class="tok-id">${escapeHtml(ident)}</span>`;
    else if (space) html += space;
    else html += escapeHtml(punct);
  }
  return html;
}

// Draws the mux4to1_gate schematic used by the step-by-step slides. `stage` controls
// how much of the circuit is visible: shell -> +not -> +and -> +wired (cumulative).
function muxDiagramSvg(stage) {
  const wireColor = '#4a6a8a', dotColor = '#8fb4d6', textColor = '#9fb7cf', boxColor = '#3a5570', gateFill = '#16283d';
  const rows = [96, 122, 148, 174];
  const els = [];
  const line = d => els.push(`<path d="${d}" fill="none" stroke="${wireColor}" stroke-width="1.5"/>`);
  const dot = (x, y) => els.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="${dotColor}"/>`);
  const label = (x, y, s, anchor = 'start') => els.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="SF Mono, Menlo, monospace" font-size="9" fill="${textColor}">${s}</text>`);
  const gate = d => els.push(`<path d="${d}" fill="${gateFill}" stroke="${wireColor}" stroke-width="1.5"/>`);
  const bubble = (cx, cy) => els.push(`<circle cx="${cx}" cy="${cy}" r="3.2" fill="${gateFill}" stroke="${wireColor}" stroke-width="1.5"/>`);
  const wrap = () => `<svg viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg">${els.join('')}</svg>`;

  els.push(`<rect x="64" y="10" width="300" height="196" rx="10" fill="none" stroke="${boxColor}" stroke-width="1.5"/>`);
  label(214, 25, 'mux4to1_gate', 'middle');

  [['sel[1]', 40], ['sel[0]', 64], ['in[0]', 96], ['in[1]', 122], ['in[2]', 148], ['in[3]', 174]].forEach(([name, y]) => {
    line(`M40,${y} L64,${y}`);
    label(36, y + 3, name, 'end');
  });
  line('M364,110 L388,110');
  label(392, 113, 'out');

  if (stage === 'shell') return wrap();

  line('M64,40 L158,40 L158,50');
  gate('M146,50 L170,50 L158,70 Z');
  bubble(158, 74);
  line('M64,64 L198,64 L198,76');
  gate('M186,76 L210,76 L198,96 Z');
  bubble(198, 100);

  if (stage === 'not') {
    line('M158,77.2 L158,96'); label(162, 99, 'n1');
    line('M198,103.2 L198,122'); label(202, 125, 'n2');
    return wrap();
  }

  line('M158,77.2 L158,182');
  line('M198,103.2 L198,182');
  rows.forEach(y => { dot(158, y); dot(198, y); });
  label(162, 187, 'n1'); label(202, 187, 'n2');

  const andLabels = ['a1', 'a2', 'a3', 'a4'];
  rows.forEach((y, i) => {
    line(`M64,${y} L258,${y} L258,${y - 6} L278,${y - 6}`);
    line(`M158,${y} L278,${y}`);
    line(`M198,${y} L248,${y} L248,${y + 6} L278,${y + 6}`);
    gate(`M278,${y - 11} L278,${y + 11} L295,${y + 11} A11,11 0 0 1 295,${y - 11} Z`);
    line(`M306,${y} L318,${y}`);
    label(320, y - 3, andLabels[i]);
  });

  if (stage === 'and') return wrap();

  const converge = [92, 101, 119, 128];
  rows.forEach((y, i) => line(`M318,${y} L328,${converge[i]}`));
  gate('M325,85 Q345,110 325,135 Q358,132 364,110 Q358,88 325,85 Z');
  label(340, 114, 'or1', 'middle');

  return wrap();
}

const SIMULATORS = {
  'mux4to1-gate': values => {
    const index = values['sel[0]'] * 2 + values['sel[1]'];
    return { out: values[`in[${index}]`] };
  },
  'decoder-fadder': values => {
    const { x, y, z } = values;
    return { s: x ^ y ^ z, c: (x & y) | (y & z) | (x & z) };
  },
  'fulladder': values => {
    const { x, y, z } = values;
    return { s: x ^ y ^ z, c: (x & y) | (x & z) | (y & z) };
  },
  'addsub': values => {
    const A = [0, 1, 2, 3].map(i => values[`A[${i}]`]);
    const B = [0, 1, 2, 3].map(i => values[`B[${i}]`]);
    const M = values.M;
    const Bx = B.map(b => b ^ M);
    let carry = M, c3 = 0, c4 = 0;
    const S = [];
    for (let i = 0; i < 4; i++) {
      const x = A[i], y = Bx[i], z = carry;
      S.push(x ^ y ^ z);
      const next = (x & y) | (x & z) | (y & z);
      if (i === 2) c3 = next;
      carry = next;
      if (i === 3) c4 = next;
    }
    return { 'S[0]': S[0], 'S[1]': S[1], 'S[2]': S[2], 'S[3]': S[3], V: c3 ^ c4 };
  },
  'alu4': values => {
    const A = [0, 1, 2, 3].map(i => values[`A[${i}]`]);
    const B = [0, 1, 2, 3].map(i => values[`B[${i}]`]);
    const op = (values['OP[1]'] << 1) | values['OP[0]'];
    let Result = [0, 0, 0, 0], C = 0, V = 0;
    if (op === 0 || op === 1) {
      const Bx = op === 1 ? B.map(b => 1 - b) : B;
      let carry = op === 1 ? 1 : 0, c3 = 0, c4 = 0;
      for (let i = 0; i < 4; i++) {
        const x = A[i], y = Bx[i], z = carry;
        Result[i] = x ^ y ^ z;
        const next = (x & y) | (x & z) | (y & z);
        if (i === 2) c3 = next;
        carry = next;
        if (i === 3) c4 = next;
      }
      C = c4;
      V = c3 ^ c4;
    } else if (op === 2) {
      Result = A.map((a, i) => a & B[i]);
    } else {
      Result = A.map((a, i) => a ^ B[i]);
    }
    const Z = Result.every(b => b === 0) ? 1 : 0;
    const N = Result[3];
    return { 'Result[0]': Result[0], 'Result[1]': Result[1], 'Result[2]': Result[2], 'Result[3]': Result[3], C, V, Z, N };
  }
};

const STEP_DIAGRAMS = {
  'mux4to1-gate': muxDiagramSvg
};

// `descending`: bit-print order within each group. Ascending (default) matches
// this course's `input [0:N]`-declared buses (e.g. mux's `sel`/`in` — bit 0 is
// declared first, so it prints first, same as real Verilog's %b for that
// declaration direction). Standard `[N:0]`-declared buses (e.g. ADDSUB's
// A/B/S, where bit N-1 is the MSB/sign bit) need `descending: true` so the
// diagram and legend print MSB-first, matching both Verilog %b semantics for
// that declaration and how a student would actually read/construct a value.
function groupBits(names, descending = false) {
  const groups = new Map();
  names.forEach(name => {
    const match = name.match(/^(.+)\[(\d+)\]$/);
    const base = match ? match[1] : name;
    const index = match ? Number(match[2]) : 0;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ name, index });
  });
  return [...groups.entries()].map(([base, members]) => ({
    base,
    width: members.length,
    members: members.slice().sort((a, b) => descending ? b.index - a.index : a.index - b.index)
  }));
}

function formatBusLegend(groups, values) {
  return groups.map(g => `${g.base}=${g.width}'b${g.members.map(m => values[m.name] ?? 0).join('')}`).join(' | ');
}

// --- Playground: runs a REAL Verilog simulator (Icarus Verilog compiled to
// WebAssembly, loaded lazily from ./verilog-wasm/engine.js) against a hidden
// per-module testbench. Gate-level, dataflow (assign), hierarchical module
// instantiation, and behavioral (always/if) modeling are all genuinely
// supported, because it's real Icarus Verilog underneath, not a hand-rolled
// subset interpreter. See README for how testbenches are authored per module.
function parseVerilogTestOutput(output) {
  const cases = [];
  let result = null;
  for (const line of output.split('\n')) {
    const testMatch = line.match(/^TEST\|[^|]+\|([^|]+)\|(PASS|FAIL)(?:\|(.*))?$/);
    if (testMatch) { cases.push({ id: testMatch[1], pass: testMatch[2] === 'PASS', detail: testMatch[3] || '' }); continue; }
    const resultMatch = line.match(/^RESULT\|[^|]+\|(PASS|FAIL)\|(\d+)\/(\d+)$/);
    if (resultMatch) result = { pass: resultMatch[1] === 'PASS', passed: Number(resultMatch[2]), total: Number(resultMatch[3]) };
  }
  return { cases, result };
}

function playgroundSpecHtml(module) {
  return `Paste a Verilog implementation of <code>${escapeHtml(module.signature)}</code> and click Run. Your code is compiled and run by a real Verilog simulator (Icarus Verilog, via WebAssembly, entirely in your browser) against a hidden testbench — gate-level, dataflow, and behavioral modeling are all supported.`;
}

function playgroundTemplate(module) {
  return `${module.signature}\n\n// your Verilog goes here\n\nendmodule`;
}

async function runPlaygroundAndRender(module, sourceCode, resultsEl) {
  if (!sourceCode.trim()) { resultsEl.innerHTML = '<div class="empty-state">Paste your code above and click Run to see results.</div>'; return; }
  resultsEl.innerHTML = '<div class="empty-state">Loading simulator (first run only, ~3&nbsp;MB)…</div>';
  try {
    const { runVerilog } = await import('./verilog-wasm/engine.js');
    resultsEl.innerHTML = '<div class="empty-state">Compiling and running…</div>';
    const sim = await runVerilog(sourceCode, module.testbench);
    if (!sim.ok) { resultsEl.innerHTML = `<div class="playground-error">${escapeHtml(sim.error)}</div>`; return; }
    const { cases, result } = parseVerilogTestOutput(sim.output);
    if (!result) {
      resultsEl.innerHTML = `<div class="playground-error">The simulator ran but didn't report a result. Raw output:\n${escapeHtml(sim.output || '(none)')}</div>`;
      return;
    }
    const failing = cases.filter(c => !c.pass);
    const shown = result.pass ? cases.slice(0, 12) : failing.slice(0, 30);
    const rows = shown.map(c => `<div class="playground-case" data-pass="${c.pass}"><span class="playground-case-mark">${c.pass ? '✓' : '✗'}</span><span>Test ${escapeHtml(c.id)}${c.detail ? ' — ' + escapeHtml(c.detail) : ''}</span></div>`).join('');
    const more = !result.pass && failing.length > shown.length ? `<p class="empty-state">+ ${failing.length - shown.length} more failing case(s) not shown.</p>` : '';
    resultsEl.innerHTML = `<p class="playground-summary" data-pass="${result.pass}">${result.passed} / ${result.total} test cases passed</p><div class="playground-cases">${rows}</div>${more}`;
  } catch (err) {
    resultsEl.innerHTML = `<div class="playground-error">Simulator error: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

const moduleState = { pinValues: {}, stepIndex: {} };

function renderPinDiagram(module) {
  const values = moduleState.pinValues[module.id];
  const simulate = SIMULATORS[module.simulate];
  const outputs = simulate ? simulate(values) : {};
  const boxLabel = (module.signature.match(/module\s+(\w+)/) || [, module.title])[1];

  const inputPin = (input, vertical) => {
    const value = values[input.name];
    const inputEl = `<input class="pin-input" type="text" inputmode="numeric" maxlength="1" data-pin-bit="${escapeHtml(input.name)}" value="${value}" aria-label="${escapeHtml(input.name)}" />`;
    const nameEl = `<span class="pin-name">${escapeHtml(input.name)}</span>`;
    const arrowEl = `<span class="pin-arrow" aria-hidden="true">${vertical ? '↑' : '→'}</span>`;
    return vertical ? `<div class="pin-item pin-item-bottom">${arrowEl}${inputEl}${nameEl}</div>` : `<div class="pin-item">${nameEl}${inputEl}${arrowEl}</div>`;
  };

  const leftHtml = module.inputs.filter(i => (i.side || 'left') !== 'bottom').map(i => inputPin(i, false)).join('');
  const bottomHtml = module.inputs.filter(i => i.side === 'bottom').map(i => inputPin(i, true)).join('');
  const rightHtml = module.outputs.map(output => {
    const value = outputs[output.name] ?? 0;
    return `<div class="pin-item"><span class="pin-arrow" aria-hidden="true">→</span><span class="pin-readout" data-bit-value="${value}">${value}</span><span class="pin-name">${escapeHtml(output.name)}</span></div>`;
  }).join('');

  const descending = module.bitOrder === 'desc';
  const legend = [
    formatBusLegend(groupBits(module.inputs.map(i => i.name), descending), values),
    formatBusLegend(groupBits(module.outputs.map(o => o.name), descending), outputs)
  ].filter(Boolean).join(' | ');

  return `<div class="pin-diagram-main">
    <div class="pin-side pin-side-left">${leftHtml}</div>
    <div class="pin-box">${escapeHtml(boxLabel)}</div>
    <div class="pin-side pin-side-right">${rightHtml}</div>
    ${bottomHtml ? `<div class="pin-side-bottom">${bottomHtml}</div>` : ''}
  </div>
  <p class="pin-legend">${escapeHtml(legend)}</p>`;
}

function renderSlideWidget(module) {
  const steps = module.steps || [];
  const idx = moduleState.stepIndex[module.id] || 0;
  const step = steps[idx];
  if (!step) return '<p class="empty-state">No step-by-step walkthrough yet.</p>';
  const diagramFn = STEP_DIAGRAMS[module.simulate];
  const dots = steps.map((_, i) => `<span class="slide-dot" data-active="${i === idx}"></span>`).join('');
  return `<div class="slide-stage"><pre class="slide-code"><code>${highlightVerilog(step.code)}</code></pre><div class="slide-diagram">${diagramFn ? diagramFn(step.stage) : ''}</div></div>
    <div class="slide-controls"><button type="button" data-slide-prev ${idx === 0 ? 'disabled' : ''} aria-label="Previous step">&lsaquo;</button><div class="slide-dots">${dots}</div><button type="button" data-slide-next ${idx === steps.length - 1 ? 'disabled' : ''} aria-label="Next step">&rsaquo;</button></div>
    <p class="slide-label">Step ${idx + 1} of ${steps.length} — ${escapeHtml(step.label)}</p>`;
}

function renderModuleCard(module) {
  const hasDiagram = Array.isArray(module.inputs) && module.inputs.length > 0;
  if (hasDiagram) {
    moduleState.pinValues[module.id] = moduleState.pinValues[module.id] || Object.fromEntries(module.inputs.map(input => [input.name, input.default]));
  }
  moduleState.stepIndex[module.id] = moduleState.stepIndex[module.id] || 0;

  const diagramPane = hasDiagram ? `<div><h4 class="module-subhead">Interactive diagram</h4><div class="pin-diagram" data-pin-diagram></div></div>` : '';
  const circuitPane = module.circuit ? `<div><h4 class="module-subhead">Circuit diagram</h4><figure class="circuit-figure"><img src="${encodeURI(module.circuit.image)}" alt="${escapeHtml(module.title)} circuit diagram" loading="lazy" /><figcaption>${escapeHtml(module.circuit.caption)}</figcaption></figure></div>` : '';
  const gridPane = (diagramPane || circuitPane) ? `<div class="module-grid">${diagramPane}${circuitPane}</div>` : '';
  // Modules the lab sheet hands out as a worked example show their reference code;
  // modules that are the student's assigned task (module.code absent) don't — only
  // the expected signature, diagram, and a Playground to self-check their own code.
  const codePane = module.code ? `<h4 class="module-subhead">Verilog code</h4>
      <div class="code-block">
        <div class="code-block-head"><span>${escapeHtml(module.id)}.v</span><button class="code-copy" type="button" data-copy>Copy</button></div>
        <pre><code>${highlightVerilog(module.code)}</code></pre>
      </div>
      <h4 class="module-subhead">Building the code, step by step</h4>
      <div class="slide-widget" data-slide-widget></div>` : '';

  return `<article class="module-card" data-module="${escapeHtml(module.id)}">
    <button class="module-toggle" type="button" aria-expanded="false">
      <span class="module-toggle-text"><h3>${escapeHtml(module.title)}</h3><p>${escapeHtml(module.summary)}</p></span>
      <span class="module-chev" aria-hidden="true">⌄</span>
    </button>
    <div class="module-body" hidden>
      <span class="module-signature">${escapeHtml(module.signature)}</span>
      ${gridPane}
      ${codePane}
      <h4 class="module-subhead">Playground</h4>
      <div class="playground">
        <p class="playground-spec">${playgroundSpecHtml(module)}</p>
        <div class="playground-grid">
          <div class="playground-editor">
            <textarea class="playground-code" data-playground-code spellcheck="false" placeholder="${escapeHtml(playgroundTemplate(module))}"></textarea>
            <button class="button button-primary playground-run" type="button" data-playground-run>Run tests</button>
          </div>
          <div class="playground-results" data-playground-results><div class="empty-state">Paste your code and click Run to see results.</div></div>
        </div>
      </div>
    </div>
  </article>`;
}

function findModule(modules, id) {
  return modules.find(module => module.id === id) || null;
}

function wireModuleInteractions(modules) {
  const listEl = $('[data-lab-modules]');
  listEl.addEventListener('click', event => {
    const moduleCard = event.target.closest('[data-module]');
    if (!moduleCard) return;
    const module = findModule(modules, moduleCard.dataset.module);

    const toggle = event.target.closest('.module-toggle');
    if (toggle) {
      const body = moduleCard.querySelector('.module-body');
      const wasExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!wasExpanded));
      body.hidden = wasExpanded;
      if (!wasExpanded && !body.dataset.rendered) {
        const pinDiagramEl = body.querySelector('[data-pin-diagram]');
        if (pinDiagramEl) pinDiagramEl.innerHTML = renderPinDiagram(module);
        const slideWidgetEl = body.querySelector('[data-slide-widget]');
        if (slideWidgetEl) slideWidgetEl.innerHTML = renderSlideWidget(module);
        body.dataset.rendered = 'true';
      }
      return;
    }

    const copyButton = event.target.closest('[data-copy]');
    if (copyButton) {
      (navigator.clipboard?.writeText(module.code) ?? Promise.reject()).then(() => {
        copyButton.textContent = 'Copied';
        copyButton.dataset.copied = 'true';
        setTimeout(() => { copyButton.textContent = 'Copy'; delete copyButton.dataset.copied; }, 1500);
      }).catch(() => {
        copyButton.textContent = 'Copy failed — select manually';
        setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
      });
      return;
    }

    const prevButton = event.target.closest('[data-slide-prev]');
    const nextButton = event.target.closest('[data-slide-next]');
    if (prevButton || nextButton) {
      const steps = module.steps || [];
      const idx = moduleState.stepIndex[module.id] || 0;
      moduleState.stepIndex[module.id] = prevButton ? Math.max(0, idx - 1) : Math.min(steps.length - 1, idx + 1);
      moduleCard.querySelector('[data-slide-widget]').innerHTML = renderSlideWidget(module);
      return;
    }

    const runButton = event.target.closest('[data-playground-run]');
    if (runButton) {
      const code = moduleCard.querySelector('[data-playground-code]').value;
      const resultsEl = moduleCard.querySelector('[data-playground-results]');
      runButton.disabled = true;
      runPlaygroundAndRender(module, code, resultsEl).finally(() => { runButton.disabled = false; });
    }
  });

  listEl.addEventListener('input', event => {
    const pinInput = event.target.closest('.pin-input');
    if (!pinInput) return;
    const moduleCard = event.target.closest('[data-module]');
    const module = findModule(modules, moduleCard.dataset.module);
    const bit = pinInput.dataset.pinBit;
    const values = moduleState.pinValues[module.id];
    const sanitized = pinInput.value.replace(/[^01]/g, '');
    values[bit] = sanitized ? Number(sanitized[sanitized.length - 1]) : values[bit];
    const container = moduleCard.querySelector('[data-pin-diagram]');
    container.innerHTML = renderPinDiagram(module);
    const refocused = container.querySelector(`[data-pin-bit="${CSS.escape(bit)}"]`);
    if (refocused) { refocused.focus(); refocused.select(); }
  });
}

// --- Page bootstrap: read ?lab=N, fetch content.json + modules.json, render just
// that one lab's sheet + modules. A dedicated page per lab (not a same-page tab).
function renderLabSheet(lab) {
  const available = Boolean(lab.file && lab.available);
  const actions = available ? `<div class="file-actions"><a class="button button-secondary" href="${encodeURI(lab.file)}" target="_blank" rel="noopener">View PDF ↗</a><a class="button button-primary" href="${encodeURI(lab.file)}" download>Download</a></div>` : '<span class="download" aria-disabled="true">Not released</span>';
  return `<article class="lab-row"><div class="lab-number">${String(lab.number).padStart(2, '0')}</div><div class="lab-copy"><h3>${escapeHtml(lab.title)}</h3><p>${escapeHtml(lab.summary)}</p>${lab.fileSize ? `<span class="file-size">PDF · ${escapeHtml(lab.fileSize)}</span>` : ''}</div>${actions}</article>`;
}

function showLabNotFound(message) {
  $('[data-lab-title]').textContent = 'Lab not found';
  $('[data-lab-eyebrow]').textContent = 'CS F342';
  $('[data-lab-summary]').textContent = message;
  $('[data-lab-sheet]').innerHTML = '';
  $('[data-lab-modules]').innerHTML = '';
}

async function initLabPage() {
  wireMobileNav();
  const labNumber = Number(new URLSearchParams(location.search).get('lab'));
  if (!labNumber) { showLabNotFound('No lab was specified. Go back and pick a lab from the course home page.'); return; }

  let content, modulesData;
  try {
    [content, modulesData] = await Promise.all([
      fetch('data/content.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch('data/modules.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => ({ labs: [] }))
    ]);
  } catch {
    showLabNotFound('Course content is temporarily unavailable. Please refresh the page.');
    return;
  }

  renderLabNav(content.labs, labNumber);
  const lab = content.labs.find(l => l.number === labNumber);
  if (!lab) { showLabNotFound(`Lab ${labNumber} doesn't exist yet.`); return; }

  document.title = `Lab ${lab.number} · ${content.course.code}`;
  $('[data-lab-eyebrow]').textContent = `${content.course.code} · Lab ${lab.number}`;
  $('[data-lab-title]').textContent = lab.title;
  $('[data-lab-summary]').textContent = lab.summary;
  $('[data-lab-sheet]').innerHTML = renderLabSheet(lab);

  const modules = (modulesData.labs.find(l => l.lab === labNumber) || {}).modules || [];
  $('[data-lab-modules]').innerHTML = modules.length ? modules.map(renderModuleCard).join('') : '<div class="empty-state">No extra materials for this lab yet.</div>';
  if (modules.length) wireModuleInteractions(modules);
}

initLabPage();
