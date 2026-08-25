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

## Extra materials (interactive modules)

The "Extra materials" section on the homepage holds one tab per lab, each listing interactive modules (`content/modules.json`). Each module needs:

- `simulate`: a key registered in the `SIMULATORS` map in `public/assets/app.js` — a small function computing outputs from input bit values.
- `circuit.image`: a diagram file placed under `source-materials/diagrams/`, referenced as `materials/diagrams/<file>` (published as-is, no visibility filtering).
- `code` and `steps[].code`: the exact Verilog, syntax-highlighted automatically.
- `steps[].stage`: only `mux4to1-gate` has a matching entry in `STEP_DIAGRAMS` today (`muxDiagramSvg`). A new module needs its own step-diagram function added there, or its `steps` can omit diagrams by leaving that lookup empty.

Add a new lab by adding a `{ lab, label, modules: [] }` object to `content/modules.json`; add a new module by pushing onto an existing lab's `modules` array.

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
