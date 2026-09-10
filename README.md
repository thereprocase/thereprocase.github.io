# thereprocase project index

**[Explore the projects](https://thereprocase.github.io/)**

The public project directory, grouped by what each project does. Every listed
repository has a landing page with its current status, source, and useful links.
Trio and Lord of the Code lead the agent selection. The E13 spool wall rack has
a dedicated hardware feature, original engineering figures and local CAD downloads.

All twelve sites use the supplied Gridline design system, with labeled render panes,
semantic color blocks, sticky project navigation and ruled project registers.
Layouts adapt from 280-pixel phones through 4K; links and actions have persistent
visual cues. See
[Gridline maintenance notes](GRIDLINE.md) for the shared assets and publishing flow.

| Category | Featured projects |
| --- | --- |
| Agent collaboration | [Trio / nth](https://thereprocase.github.io/trio/), [Lord of the Code](https://thereprocase.github.io/lord-of-the-code/) |
| Hardware & mechanisms | [Spool wall rack / E13](https://thereprocase.github.io/spool-wall-rack/), [Laptop wall mount](https://thereprocase.github.io/dell-5560-wall-mount/), [Precision 5680 desk dock](https://thereprocase.github.io/5680-dock/), [Conformal pegboard anchor](https://thereprocase.github.io/peg/) |
| CAD tools | [Reference Align for Onshape](https://thereprocase.github.io/onshape-reference-align/) |
| Developer tools | [Claude Code status line](https://thereprocase.github.io/claude-statusline/), [Claude usage](https://thereprocase.github.io/claude-usage/) |
| Home automation | [Bambu Bridge](https://thereprocase.github.io/bambu-bridge/), [HomeKit Preview](https://thereprocase.github.io/homekit-preview/) |

Public working forks appear separately under **Forks & upstream work**, with
links to the original projects. The index itself is linked in the footer.

The airflow panel links the final particle-flow videos at about 1/200th speed.
CFD is paused with resumable checkpoints. No simulation files are copied here.

## Development and publishing

- `npm ci`, then `npm run dev` for development.
- `npm run build`, then `node scripts/export-pages.mjs` to prepare `docs/`.
- GitHub Pages serves the committed `docs/` export on `main`.
- Project content and categories live in `lib/projects.ts`; landing pages share
  `app/projects/[slug]/page.tsx`.
- The export helper adds directory index aliases for the canonical URLs. This
  avoids a trailing-slash prerender redirect in the current Vinext beta while
  retaining its generated static output.
- Commit source and public output together. Keep `docs/.nojekyll`.

No server runtime, API keys, analytics, or visitor accounts are needed.

## Spool wall rack

`components/spool-rack-project.tsx` supplies the dedicated `/spool-wall-rack/`
page and its `/projects/spool-wall-rack/` directory alias. Original CAD renders,
scientific figures and geometry are copied from the pinned E13 source revision
by `scripts/sync-spool-rack.mjs <spool-wall-rack checkout>`; the script verifies
the working files against that published commit. The accompanying provenance
record lists source paths, dimensions, file sizes and SHA-256 hashes.
Run `python scripts/package-spool-stls.py` after syncing to create the verified,
reproducible STL fallback bundle and add its checksum to that record.

Review the page's numerical claims and print instructions before advancing the
source revision. Preserve original scientific scales and qualification limits.
