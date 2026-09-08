# thereprocase project index

https://thereprocase.github.io/

Root landing page for the published projects and the latest Rev H CFD videos.
Video links resolve to the existing cumulative MP4 aliases; this index does not
copy or regenerate simulation results.

## Development and publishing

- Install with `npm ci` and run `npm run dev`.
- `npm run build` exports the static site to `dist/client/`.
- GitHub Pages serves the committed `docs/` export on `main`.
- After a successful build, copy the public export into `docs/` and commit both
  source and output. Keep `.nojekyll` in the published directory.

No server runtime, API keys, analytics, or visitor accounts are needed.
