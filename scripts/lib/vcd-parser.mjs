// Parses Icarus Verilog's VCD output into a structure a waveform renderer can use.
// Signals are looked up by full hierarchical path (e.g. "Testing.dff.q") since VCD
// scopes can reuse leaf names (a DUT's output port and the testbench wire driving it
// are commonly both just called "q").
export function parseVCD(text) {
  const lines = text.split('\n');
  const scopeStack = [];
  const byPath = new Map(); // path -> { id, width, type }
  const byId = new Map(); // id -> path (first path wins if an id is aliased to multiple paths)
  let i = 0;
  let timescale = null;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '$enddefinitions $end') { i++; break; }
    if (line.startsWith('$scope')) {
      const parts = line.split(/\s+/); // $scope module Name $end
      scopeStack.push(parts[2]);
      i++; continue;
    }
    if (line.startsWith('$upscope')) { scopeStack.pop(); i++; continue; }
    if (line.startsWith('$timescale')) {
      // value may be on the same line or the next line, ending with $end
      let buf = line;
      while (!buf.includes('$end')) { i++; buf += ' ' + lines[i].trim(); }
      timescale = buf.replace('$timescale', '').replace('$end', '').trim();
      i++; continue;
    }
    if (line.startsWith('$var')) {
      // $var wire 1 ! q $end   OR   $var reg 4 ) Q [3:0] $end
      const m = line.match(/^\$var\s+(\w+)\s+(\d+)\s+(\S+)\s+(\S+)(?:\s+\[[^\]]+\])?\s+\$end$/);
      if (m) {
        const [, type, width, id, name] = m;
        const path = [...scopeStack, name].join('.');
        if (!byPath.has(path)) byPath.set(path, { id, width: Number(width), type });
        if (!byId.has(id)) byId.set(id, path);
      }
      i++; continue;
    }
    i++;
  }

  // Body: alternating #<time> markers and value-change lines.
  const changesById = new Map(); // id -> [{time, value}]
  let time = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#')) { time = Number(line.slice(1)); continue; }
    if (line.startsWith('$')) continue; // $dumpvars / $end / $comment blocks
    let id, value;
    if (line[0] === 'b' || line[0] === 'B') {
      // vector: "b1010 <id>"
      const sp = line.indexOf(' ');
      value = line.slice(1, sp);
      id = line.slice(sp + 1);
    } else {
      // scalar: "0!" / "1!" / "x!" / "z!" — first char is the value, rest is the id
      value = line[0];
      id = line.slice(1);
    }
    if (!changesById.has(id)) changesById.set(id, []);
    changesById.get(id).push({ time, value });
  }

  return { timescale, byPath, byId, changesById };
}

// Builds a step-function timeline for one signal (by path) from `time: 0` to `endTime`.
export function signalTimeline(parsed, path, endTime) {
  const info = parsed.byPath.get(path);
  if (!info) throw new Error(`No signal at path "${path}" in this VCD (available: ${[...parsed.byPath.keys()].join(', ')})`);
  const changes = (parsed.changesById.get(info.id) || []).slice().sort((a, b) => a.time - b.time);
  const segments = [];
  let last = null;
  for (const c of changes) {
    if (c.time >= endTime) break; // outside the display window — the prior segment just runs to endTime
    if (last && last.time === c.time) { last.value = c.value; continue; } // same-time overwrite
    if (last) segments.push({ ...last, endTime: c.time });
    last = { time: c.time, value: c.value };
  }
  if (last) segments.push({ ...last, endTime });
  return { width: info.width, type: info.type, segments };
}
