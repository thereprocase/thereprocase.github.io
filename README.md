# thereprocase project index

**[Explore the projects](https://thereprocase.github.io/)**

The public project directory, grouped by what each project does. Every listed
repository has a landing page with its current status, source, and useful links.
Trio and Lord of the Code lead the featured selection.

All five sites use the supplied Gridline design system, with labeled render panes,
semantic color blocks, sticky project navigation and ruled project registers.
Layouts adapt from 280-pixel phones through 4K; links and actions have persistent
visual cues. See
[Gridline maintenance notes](GRIDLINE.md) for the shared assets and publishing flow.

| Category | Featured projects |
| --- | --- |
| Agent collaboration | [Trio / nth](https://thereprocase.github.io/projects/trio/), [Lord of the Code](https://thereprocase.github.io/projects/lord-of-the-code/) |
| Hardware & mechanisms | [Laptop wall mount](https://thereprocase.github.io/projects/dell-5560-wall-mount/), [Precision 5680 desk dock](https://thereprocase.github.io/projects/5680-dock/), [Conformal pegboard anchor](https://thereprocase.github.io/projects/peg/) |
| CAD tools | [Reference Align for Onshape](https://thereprocase.github.io/projects/onshape-reference-align/) |
| Developer tools | [Claude Code status line](https://thereprocase.github.io/projects/claude-statusline/), [Claude usage](https://thereprocase.github.io/projects/claude-usage/) |
| Home automation | [HomeKit Preview](https://thereprocase.github.io/projects/homekit-preview/) |

Public working forks appear separately under **Forks & upstream work**, with
links to the original projects. The index itself is linked in the footer.

The airflow panel uses the existing cumulative particle-video aliases, so hourly
CFD publications appear without rebuilding this index. No simulation files are
copied here.

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
