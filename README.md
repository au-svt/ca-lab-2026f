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

The build includes only public/released items in `dist`. GitHub Actions also runs daily at 07:45 IST so scheduled items can appear without a new commit.

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
