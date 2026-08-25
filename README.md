# CS F342 Computer Architecture Lab portal

Public-facing course website for sections P4 and P7, First Semester 2026–2027.

## Preview locally

```bash
npm run preview
```

Open <http://localhost:4173>. Stop the server with `Ctrl+C`.

## Routine updates

All course copy, announcements, schedules, and lab metadata live in `content/content.json`.

To publish a PDF:

1. Add the file to `source-materials/`.
2. Add its exact filename to the relevant lab object's `file` field.
3. Set `visibility` to `public`, or use `scheduled` with a future ISO-8601 `releaseAt` value.
4. Update `updatedAt` and commit to `main`.

General course PDFs use the same fields under `resources` and appear above the numbered lab sheets.

The build includes only public/released items in `dist`. GitHub Actions also runs daily at 07:45 IST so scheduled items can appear without a new commit.

## Lab pages and interactive modules

Each lab gets its own page (`lab.html?lab=N`, linked from the nav and from the homepage's lab index) showing that lab's PDF plus its interactive modules — content for these lives in `content/modules.json`, grouped by `{ lab, label, modules: [] }`. Add a new lab by adding one of those objects; add a module by pushing onto an existing lab's `modules` array.

Each module entry supports:

- `signature` (required): the expected `module Name(ports);` line, shown to students and used to derive the Playground's starter template.
- `testbench` (required for a working Playground): a hidden Verilog testbench, compiled together with whatever the student pastes in. It must instantiate the DUT under the exact name in `signature` and, for every case, `$display` a line in one of these two forms so the UI can parse it:
  - `TEST|<MODULE>|<id>|PASS` or `TEST|<MODULE>|<id>|FAIL|<any detail text>`
  - one final `RESULT|<MODULE>|PASS|<passed>/<total>` or `RESULT|<MODULE>|FAIL|<passed>/<total>`
- `code` (optional): the exact reference Verilog, shown syntax-highlighted with a copy button. **Only set this for modules the lab sheet hands out as a worked example** (e.g. `mux4to1-gate`, `decoder-fadder` — the PDF itself labels these "Solution:"). Leave it unset for the student's own assigned task (e.g. `fadder8`, `fulladder`, `addsub`) — showing a reference answer there would give away the exercise. `steps[]` (the step-by-step build-up slides) only makes sense alongside `code`.
- `inputs[]` / `outputs[]` / `simulate` (optional): bit-level ports (e.g. `{"name":"sel[1]","default":0,"side":"bottom"}`, `side` ∈ `left`/`bottom`, default `left`; outputs always render right) plus a key into the `SIMULATORS` map in `public/assets/lab.js` — a small JS function computing outputs from input values, driving the live interactive diagram. Omit all three for wide-bus modules (8+ bits) where a per-bit toggle diagram stops being usable — the module still gets its Playground.
- `circuit` (optional): `{ image, caption }`, where `image` is a file under `source-materials/diagrams/`, referenced as `materials/diagrams/<file>` (published as-is, no visibility filtering). Multiple modules can point at the same image if it depicts more than one of them (see `fadder8`/`fadder32`, which both point at the same diagram as `decoder-fadder`).

### The Playground: a real Verilog simulator, not a reimplementation

`public/assets/verilog-wasm/` vendors **Icarus Verilog compiled to WebAssembly** (`ivlpp`/`ivl`/`vvp`, ~2.7 MB total), adapted from [VeriSim](https://github.com/senolgulgonul/verisim) — itself a WASM build of [Icarus Verilog](https://github.com/steveicarus/iverilog) (GPLv2). `public/assets/verilog-wasm/engine.js` orchestrates the three stages (preprocess → compile → simulate) and is only ever `import()`-ed lazily, the first time a student clicks "Run tests" on any module — nothing loads it up front. Because it's the real compiler, gate-level, dataflow (`assign`), hierarchical (one module instantiating another), and behavioral (`always`/`if`) Verilog are all genuinely supported — there's no artificial subset to work around.

Before trusting a new testbench, run it once against a correct reference solution and once against a deliberately wrong one (e.g. in Node, importing the three `.js` files directly — they run outside the browser too) to confirm it reports the exact pass count you expect in both cases.

## Live Lab Board

Issue [#1](https://github.com/au-svt/ca-lab-2026f/issues/1) is the live classroom board. Edit its body to post text or links, or drag files into the GitHub editor to attach them. The student homepage reads the rendered issue and checks for updates every 60 seconds; no site deployment is needed.

Use the live board for temporary in-class material. Use `content/content.json` and `source-materials/` for permanent course material.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. Open the Actions tab and run **Deploy course portal**, or push a commit.

The repository owner is the administrator. Give write access only to trusted course staff.

## Visibility and privacy

- `draft` content is excluded from the deployed site.
- `scheduled` content is excluded until its release time.
- `public` content is deployed immediately.
- A publicly deployed PDF can be downloaded by anyone with its URL.
- A public source repository also exposes draft files committed to `source-materials/`.

For confidential unreleased files, use a private source repository. For true student-only access, GitHub Pages is insufficient; add an authenticated service (for example, an institutional LMS or an auth-enabled backend) and do not deploy protected PDFs as static files.

The unlinked `/admin.html` page is a publishing reference for the owner; repository permissions provide the actual administration security.
