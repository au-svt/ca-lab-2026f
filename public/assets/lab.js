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
  }
};

const STEP_DIAGRAMS = {
  'mux4to1-gate': muxDiagramSvg
};

function groupBits(names) {
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
    members: members.slice().sort((a, b) => a.index - b.index)
  }));
}

function formatBusLegend(groups, values) {
  return groups.map(g => `${g.base}=${g.width}'b${g.members.map(m => values[m.name] ?? 0).join('')}`).join(' | ');
}

// --- Playground: a small gate-level Verilog parser + combinational simulator, so
// students can paste their own code and have it checked against the reference
// SIMULATORS function across many input combinations. Deliberately scoped to gate
// primitives only (and/or/not/nand/nor/xor/xnor/buf) — assign/always are not
// supported yet and raise a clear error rather than being silently mishandled.
class VerilogError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message);
  }
}

function tokenizeVerilog_forSim(source) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
  const tokens = [];
  const re = /(\d+'[bBhHdD][0-9a-fA-Fxz]+)|(\d+)|([A-Za-z_]\w*)|(\S)/g;
  let line = 1, lastIndex = 0, match;
  while ((match = re.exec(clean))) {
    line += (clean.slice(lastIndex, match.index).match(/\n/g) || []).length;
    lastIndex = match.index;
    const [, numLit, num, ident, sym] = match;
    if (numLit) tokens.push({ type: 'number', value: numLit, line });
    else if (num) tokens.push({ type: 'number', value: num, line });
    else if (ident) tokens.push({ type: 'ident', value: ident, line });
    else if (sym) tokens.push({ type: 'sym', value: sym, line });
  }
  tokens.push({ type: 'eof', value: '<end of file>', line });
  return tokens;
}

const VERILOG_GATE_TYPES = new Set(['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buf']);

function parseVerilogModule(source) {
  const tokens = tokenizeVerilog_forSim(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (type, value) => {
    const t = next();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new VerilogError(`expected "${value ?? type}" but found "${t.value}"`, t.line);
    }
    return t;
  };
  const expectIdent = () => expect('ident').value;
  const parseNet = () => {
    const name = expectIdent();
    if (peek().value === '[') {
      next();
      const idx = parseInt(expect('number').value, 10);
      expect('sym', ']');
      return `${name}[${idx}]`;
    }
    return name;
  };
  const parseRange = () => {
    if (peek().value !== '[') return null;
    next();
    const msb = parseInt(expect('number').value, 10);
    expect('sym', ':');
    const lsb = parseInt(expect('number').value, 10);
    expect('sym', ']');
    return { width: Math.abs(msb - lsb) + 1 };
  };

  if (peek().type === 'eof') throw new VerilogError('the code is empty', peek().line);
  expect('ident', 'module');
  const moduleName = expectIdent();
  expect('sym', '(');
  if (peek().value !== ')') {
    expectIdent();
    while (peek().value === ',') { next(); expectIdent(); }
  }
  expect('sym', ')');
  expect('sym', ';');

  const ports = {};
  const gates = [];
  while (peek().type !== 'eof' && peek().value !== 'endmodule') {
    const tok = peek();
    if (tok.type === 'ident' && (tok.value === 'input' || tok.value === 'output' || tok.value === 'inout')) {
      const dir = next().value;
      const range = parseRange();
      const names = [expectIdent()];
      while (peek().value === ',') { next(); names.push(expectIdent()); }
      expect('sym', ';');
      names.forEach(name => { ports[name] = { dir, width: range ? range.width : 1 }; });
      continue;
    }
    if (tok.type === 'ident' && (tok.value === 'wire' || tok.value === 'reg')) {
      next();
      parseRange();
      expectIdent();
      while (peek().value === ',') { next(); expectIdent(); }
      expect('sym', ';');
      continue;
    }
    if (tok.type === 'ident' && VERILOG_GATE_TYPES.has(tok.value)) {
      const gateType = next().value;
      if (peek().type === 'ident') next(); // optional instance name, unused
      expect('sym', '(');
      const nets = [parseNet()];
      while (peek().value === ',') { next(); nets.push(parseNet()); }
      expect('sym', ')');
      expect('sym', ';');
      gates.push({ type: gateType, nets, line: tok.line });
      continue;
    }
    throw new VerilogError(`unsupported statement starting with "${tok.value}" — the playground currently checks gate-level Verilog only (module/input/output/wire declarations plus and/or/not/nand/nor/xor/xnor/buf instantiations). assign and always blocks aren't supported yet.`, tok.line);
  }
  if (peek().type === 'eof') throw new VerilogError('missing "endmodule"', peek().line);
  expect('ident', 'endmodule');
  return { name: moduleName, ports, gates };
}

const VERILOG_GATE_EVAL = {
  and: bits => (bits.every(b => b === 1) ? 1 : 0),
  or: bits => (bits.some(b => b === 1) ? 1 : 0),
  nand: bits => (bits.every(b => b === 1) ? 0 : 1),
  nor: bits => (bits.some(b => b === 1) ? 0 : 1),
  xor: bits => bits.reduce((a, b) => a ^ b, 0),
  xnor: bits => 1 - bits.reduce((a, b) => a ^ b, 0)
};

function simulateParsedModule(parsed, inputValues) {
  const signals = { ...inputValues };
  const isKnown = net => signals[net] === 0 || signals[net] === 1;
  let progressed = true, iterations = 0;
  while (progressed && iterations < 500) {
    progressed = false;
    iterations++;
    for (const gate of parsed.gates) {
      const { type, nets } = gate;
      if (type === 'not' || type === 'buf') {
        const input = nets[nets.length - 1];
        if (!isKnown(input)) continue;
        const value = type === 'not' ? 1 - signals[input] : signals[input];
        for (const out of nets.slice(0, -1)) {
          if (signals[out] !== value) { signals[out] = value; progressed = true; }
        }
      } else {
        const inputs = nets.slice(1);
        if (!inputs.every(isKnown)) continue;
        const value = VERILOG_GATE_EVAL[type](inputs.map(n => signals[n]));
        if (signals[nets[0]] !== value) { signals[nets[0]] = value; progressed = true; }
      }
    }
  }
  if (iterations >= 500) throw new VerilogError('the circuit did not settle after 500 propagation passes — check for a combinational loop, or a gate referencing a net that is never driven');
  return signals;
}

function generateTestVectors(inputBitNames) {
  const total = inputBitNames.length;
  if (total <= 16) {
    return Array.from({ length: 2 ** total }, (_, i) => {
      const values = {};
      inputBitNames.forEach((name, bitPos) => { values[name] = (i >> bitPos) & 1; });
      return values;
    });
  }
  return Array.from({ length: 512 }, () => {
    const values = {};
    inputBitNames.forEach(name => { values[name] = Math.random() < 0.5 ? 0 : 1; });
    return values;
  });
}

function runPlaygroundTests(module, sourceCode) {
  const expectedName = (module.signature.match(/module\s+(\w+)/) || [, ''])[1];
  const parsed = parseVerilogModule(sourceCode);
  if (parsed.name !== expectedName) throw new VerilogError(`expected a module named "${expectedName}" but found "${parsed.name}"`);

  const inputGroups = groupBits(module.inputs.map(i => i.name));
  const outputGroups = groupBits(module.outputs.map(o => o.name));
  for (const group of [...inputGroups.map(g => ({ ...g, dir: 'input' })), ...outputGroups.map(g => ({ ...g, dir: 'output' }))]) {
    const found = parsed.ports[group.base];
    if (!found) throw new VerilogError(`missing ${group.dir} port "${group.base}" (expected width ${group.width})`);
    if (found.dir !== group.dir) throw new VerilogError(`port "${group.base}" should be ${group.dir}, but your code declares it as ${found.dir}`);
    if (found.width !== group.width) throw new VerilogError(`port "${group.base}" should be width ${group.width}, but your code declares width ${found.width}`);
  }

  const simulate = SIMULATORS[module.simulate];
  const inputBitNames = module.inputs.map(i => i.name);
  const outputBitNames = module.outputs.map(o => o.name);
  let pass = 0;
  const cases = generateTestVectors(inputBitNames).map(values => {
    const expected = simulate(values);
    const signals = simulateParsedModule(parsed, values);
    const got = {};
    outputBitNames.forEach(name => { got[name] = signals[name] ?? 'x'; });
    const ok = outputBitNames.every(name => got[name] === expected[name]);
    if (ok) pass++;
    return { values, expected, got, ok };
  });
  return { total: cases.length, pass, cases };
}

function playgroundSpecHtml(module) {
  const inputGroups = groupBits(module.inputs.map(i => i.name));
  const outputGroups = groupBits(module.outputs.map(o => o.name));
  const name = (module.signature.match(/module\s+(\w+)/) || [, ''])[1];
  const describe = g => `<code>${escapeHtml(g.base)}</code> (${g.width}-bit)`;
  const exhaustive = module.inputs.length <= 16;
  return `Implement <code>${escapeHtml(name)}</code> with input${inputGroups.length > 1 ? 's' : ''} ${inputGroups.map(describe).join(' and ')} and output${outputGroups.length > 1 ? 's' : ''} ${outputGroups.map(describe).join(' and ')}. Gate-level Verilog only for now — <code>and</code>/<code>or</code>/<code>not</code>/<code>nand</code>/<code>nor</code>/<code>xor</code>/<code>xnor</code>/<code>buf</code> primitive instantiations (no <code>assign</code>/<code>always</code> yet). Paste your code and click Run to test it against ${exhaustive ? 'every possible input combination' : 'a sample of input combinations'}.`;
}

function playgroundTemplate(module) {
  const decl = (g, dir) => g.width > 1 ? `${dir} [0:${g.width - 1}] ${g.base};` : `${dir} ${g.base};`;
  return [
    module.signature,
    ...groupBits(module.inputs.map(i => i.name)).map(g => decl(g, 'input')),
    ...groupBits(module.outputs.map(o => o.name)).map(g => decl(g, 'output')),
    '', '// your gate-level code here', '', 'endmodule'
  ].join('\n');
}

function renderPlaygroundResults(module, sourceCode) {
  if (!sourceCode.trim()) return '<div class="empty-state">Paste your code above and click Run to see results.</div>';
  try {
    const result = runPlaygroundTests(module, sourceCode);
    const allPass = result.pass === result.total;
    const inputGroups = groupBits(module.inputs.map(i => i.name));
    const outputGroups = groupBits(module.outputs.map(o => o.name));
    const failing = result.cases.filter(c => !c.ok);
    const shown = allPass ? result.cases.slice(0, 12) : failing.slice(0, 30);
    const rows = shown.map(c => `<div class="playground-case" data-pass="${c.ok}"><span class="playground-case-mark">${c.ok ? '✓' : '✗'}</span><span>${escapeHtml(formatBusLegend(inputGroups, c.values))} → expected ${escapeHtml(formatBusLegend(outputGroups, c.expected))}, got ${escapeHtml(formatBusLegend(outputGroups, c.got))}</span></div>`).join('');
    const more = !allPass && failing.length > shown.length ? `<p class="empty-state">+ ${failing.length - shown.length} more failing case(s) not shown.</p>` : '';
    return `<p class="playground-summary" data-pass="${allPass}">${result.pass} / ${result.total} test cases passed</p><div class="playground-cases">${rows}</div>${more}`;
  } catch (err) {
    return `<div class="playground-error">${escapeHtml(err.message)}</div>`;
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

  const legend = [
    formatBusLegend(groupBits(module.inputs.map(i => i.name)), values),
    formatBusLegend(groupBits(module.outputs.map(o => o.name)), outputs)
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
  moduleState.pinValues[module.id] = moduleState.pinValues[module.id] || Object.fromEntries(module.inputs.map(input => [input.name, input.default]));
  moduleState.stepIndex[module.id] = moduleState.stepIndex[module.id] || 0;
  return `<article class="module-card" data-module="${escapeHtml(module.id)}">
    <button class="module-toggle" type="button" aria-expanded="false">
      <span class="module-toggle-text"><h3>${escapeHtml(module.title)}</h3><p>${escapeHtml(module.summary)}</p></span>
      <span class="module-chev" aria-hidden="true">⌄</span>
    </button>
    <div class="module-body" hidden>
      <span class="module-signature">${escapeHtml(module.signature)}</span>
      <div class="module-grid">
        <div><h4 class="module-subhead">Interactive diagram</h4><div class="pin-diagram" data-pin-diagram></div></div>
        <div><h4 class="module-subhead">Circuit diagram</h4><figure class="circuit-figure"><img src="${encodeURI(module.circuit.image)}" alt="${escapeHtml(module.title)} circuit diagram" loading="lazy" /><figcaption>${escapeHtml(module.circuit.caption)}</figcaption></figure></div>
      </div>
      <h4 class="module-subhead">Verilog code</h4>
      <div class="code-block">
        <div class="code-block-head"><span>${escapeHtml(module.id)}.v</span><button class="code-copy" type="button" data-copy>Copy</button></div>
        <pre><code>${highlightVerilog(module.code)}</code></pre>
      </div>
      <h4 class="module-subhead">Building the code, step by step</h4>
      <div class="slide-widget" data-slide-widget></div>
      ${module.playground === false ? '' : `<h4 class="module-subhead">Playground</h4>
      <div class="playground">
        <p class="playground-spec">${playgroundSpecHtml(module)}</p>
        <div class="playground-grid">
          <div class="playground-editor">
            <textarea class="playground-code" data-playground-code spellcheck="false" placeholder="${escapeHtml(playgroundTemplate(module))}"></textarea>
            <button class="button button-primary playground-run" type="button" data-playground-run>Run tests</button>
          </div>
          <div class="playground-results" data-playground-results><div class="empty-state">Paste your code and click Run to see results.</div></div>
        </div>
      </div>`}
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
        body.querySelector('[data-pin-diagram]').innerHTML = renderPinDiagram(module);
        body.querySelector('[data-slide-widget]').innerHTML = renderSlideWidget(module);
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
      moduleCard.querySelector('[data-playground-results]').innerHTML = renderPlaygroundResults(module, code);
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
