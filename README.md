# thereprocase project index

**[Explore the projects](https://thereprocase.github.io/)**

The public project directory, grouped by what each project does. Every listed
repository has a landing page with its current status, source, and useful links.
The E13 spool wall rack has a dedicated hardware feature, original engineering
figures and local CAD downloads.

All sites use the supplied Gridline design system, with labeled render panes,
semantic color blocks, sticky project navigation and ruled project registers.
Layouts adapt from 280-pixel phones through 4K; links and actions have persistent
visual cues. See
[Gridline maintenance notes](GRIDLINE.md) for the shared assets and publishing flow.

| Category | Featured projects |
| --- | --- |
| Hardware & mechanisms | [Spool wall rack / E13](https://thereprocase.github.io/spool-wall-rack/), [TPU paver feet](https://thereprocase.github.io/paver-feet/), [P1S squash-ball cradles](https://thereprocase.github.io/p1s-feet/), [Conformal pegboard anchor](https://thereprocase.github.io/peg/) |
| CAD tools | [Fillaprint](https://thereprocase.github.io/fillaprint/) |
| Developer tools | [Claude Code status line](https://thereprocase.github.io/claude-statusline/) |
| Home automation | [Bambu Bridge](https://thereprocase.github.io/bambu-bridge/) |

The index itself is linked in the footer.

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

## P1S squash-ball foot

`public/p1s-feet/` is a standalone static prototype page with a locally vendored
Three.js viewer, parameterized deflection calculator, and CAD/source downloads.
The published copy lives at `docs/p1s-feet/`. Update both copies together; normal
builds preserve the public files. It does not require a React route or a change
to the project-registry export count. `README.md` within that directory records
the sizing assumptions, limitations and reproduction instructions. Advance the
CAD, calculation JSON, source bundle and displayed revision together.

The default foot viewer now loads versioned `p02/` assets. P01 remains at
`p01.html` with its original model files and separate viewer/calculator scripts.
`review/` contains the isolation study, full uncertainty sweep, plots and
reproducible analysis source. Its force-transmission results are model outputs,
not measured sound reductions; preserve the clearance and material qualifications.

## Fillaprint

`public/fillaprint/` contains the FDM font showcase, live type tester,
print-size calculator and downloads. `python scripts/sync-fillaprint.py <font-checkout>`
copies assets from the pinned public font commit and creates the reproducible ZIP
and provenance record. Advance the source pin when updating fonts or specimens,
then build and export `docs/` with the rest of the site.

Artwork is built with `python scripts/build-fillaprint.py` from the released fonts.
The launch page includes wordmarks, label applications, and licensed font downloads.
