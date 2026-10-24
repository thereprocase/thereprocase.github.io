# Kraken spool rings, nut and gear generator

`/kraken-rings/` is Repro's (thereprocase) generator for Kraken spool centering rings (cardboard spool adapters for the Bambu Lab AMS) for any spool hole from 45.0 to 95.0 mm in 0.1 mm steps. It also thickens the Kraken spool nut flange and cuts custom spoke windows into the Kraken spool gear. The page lists the published ready-made pairs from [thereprocase/kraken-remix-ogAMS](https://github.com/thereprocase/kraken-remix-ogAMS/tree/main/rings).

Kraken is designed by [humebeam](https://www.printables.com/model/1788417-kraken-revolutionary-bambu-lab-ams). The rings, nut and gear are Repro's remixes of humebeam's original files under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Keep that credit in the page header, beside every download block, in the footer, in the STL headers and in the ZIP's `CREDITS-AND-LICENSE.txt`.

## Files

| File | Role |
| --- | --- |
| `kernel.js` | Ring, nut and gear construction with Manifold; parameter limits and guards, file names, STL writer |
| `worker.js` | Module worker: loads Manifold and one geometry asset, builds, writes STL and the pair ZIP |
| `app.js` | Form handling, live diagram, downloads, settings link, toon-shaded bed previews |
| `diagram.js`, `core-outline.js` | Ring fit diagram and gear spoke layout (wide and phone layouts); holder-bore outline sliced from the 55 mm core |
| `assets/core-NN.bin` | For each stock size 45–95: humebeam's ring inside the 22.5 mm core cylinder plus its 0.4 mm lip slab |
| `assets/nut.bin` | humebeam's `nut.stl`, exact duplicate vertices merged |
| `assets/gear-plain.bin.gz` | humebeam's gear with a solid web (`gear_web.py plain`), gzip; fetched only when the gear section opens |
| `assets/provenance.json` | Source names and SHA-256, asset hashes, volumes |
| `kraken-rings*.png`, `kraken-rings-render.json` | Render-skill illustration of generated STLs; hero and Open Graph crops |

Shared tooling: `../gridfinity-shelves/vendor/manifold.js` (Manifold 3.2.1), `../gridfinity-common/` (worker runtime, settings link), `../gridfinity-drawers/zip.js`, Three.js from `/p1s-feet/vendor/`.

## Geometry

The ring kernel repeats `rings/source/generate_family.py` `build_pair()` operation for operation: support circle at hole/2 − 0.1 (256 segments), five pentagon points at hole/2 + 0.7 with the first at +Y, a 2 mm lead-in scaled by (corner − 1.9)/corner, the source core kept inside min(22.5, support·scale − 0.1) mm (must exceed 20.3), the source 0.4 mm lip on the cap side, and a 1.5 mm gear-side flange reaching 10.25 mm past the hole radius with the spigot raised 1.1 mm. Bite and undersize are adjustable; a fractional size uses the holder core and lip of the next smaller stock ring, as the Python generator does, so the cap lip is Ø(floor(hole) + 5).

The 51 source rings share one core design but are tessellated differently (1.3–4 mm³ apart at the core), so each size ships its own core asset (about 175 kB, fetched on demand) for exact agreement with the published files.

The nut follows `gear-taper-2026-10-24/nut/build_nut.py` with the added thickness as input (0–6 mm, so 1.5–7.5 mm total). The added slab's bore is the nut's own thread one 6 mm pitch lower; the lead-in cone and the bed-edge chamfer are re-applied at the new face, which is placed on Z0.

## Gear

The gear tool subtracts N window prisms (Z −1 to 5) from the plain gear asset. The window outline matches `gear_web_taper.window_face`: spoke edges run linearly from root width/2 at the pad radius to tip width/2 at the window outer radius, measured from the spoke centre line, with arcs at both radii sampled to 0.1 µm. Corners are rounded by `offset(−r).offset(+r)`, which equals the 2D fillet on these convex corners. Guards: spokes ≥ 1.35 mm, hub- and rim-side openings ≥ 4 mm, windows inside R90 (rim ≥ 5 mm inside the R95 tooth band), and pad radius + 2 × fillet + 4 ≤ window radius. The hub above the disc ends at R18.13, so the pad radius floor of 25 mm keeps the prisms clear of it.

## Checks

```sh
node scripts/check-kraken-rings.mjs                       # limits, names, headers, diagram, kernel builds
node scripts/check-kraken-rings.mjs --rings <generate_family output>/models --sizes 55,53.4,45 \
  --nut <nut-stiff-3mm.stl> --nut-flange 3 \
  --gears <dir with gear-spokes.stl, gear-taper-r54t12.stl, gear-n6r42t12.stl>   # compare with the Python meshes
```

Results on 2026-10-24: largest ring symmetric difference 7.4 × 10⁻⁵ mm³ (45, 46, 50, 53.4, 55, 55.5, 60, 70, 80, 95 mm, both sides, against `generate_family.py` output and the published STL/3MF); nut 3.0 mm 1.5 × 10⁻⁴ mm³ against `nut-stiff-3mm.stl`. Gear presets: all 53,083 source facets outside R90 or above the disc are bit-identical; volumes are within 0.16 mm³ of the analytic CAD (window areas from `geometry_report`); against the Python STLs the symmetric difference is 0.82 (published spokes), 1.09 (r54t12) and 1.18 mm³ (n6r42t12), the Python meshes' OCCT arc chord sag. A 53.4 mm pair, a 3.5 mm nut and the r54t12 gear sliced in OrcaSlicer (P1S, PETG, no supports or brim) without errors. Physical fit of generated fractional sizes has not been measured.

Rebuild the assets from a kraken-remix-ogAMS checkout with the CAD venv:

```sh
python scripts/build-kraken-ring-assets.py <kraken-remix-ogAMS> <humebeam nut.stl> <gear_web.py plain output gear-plain.stl>
```
