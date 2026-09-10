/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Static Pages navigation and original engineering figures. */
import { GridlineShell } from '@/components/gridline-shell';
import provenance from '@/public/spool-wall-rack/assets/provenance.json';

const revision = '5e95cbf5544b205bdf2b73611d24ce3f826e837d';
const source = `https://github.com/thereprocase/spool-wall-rack/blob/${revision}`;
const assets = '/spool-wall-rack/assets/';
const downloads = '/spool-wall-rack/downloads/';

function Figure({ file, alt, caption, eager = false }: { file: string; alt: string; caption: string; eager?: boolean }) {
  const dimensions = provenance.files.find(item => item.published === assets + file);
  return <figure className="sr-figure">
    <a href={assets + file} aria-label={`Open full-size figure: ${alt}`}><img src={assets + file} alt={alt} width={dimensions?.width} height={dimensions?.height} loading={eager ? 'eager' : 'lazy'} /></a>
    <figcaption>{caption}<a href={assets + file}>Full size ↗</a></figcaption>
  </figure>;
}

export function SpoolRackProject() {
  return <GridlineShell current="Spool wall rack / E13" category="hardware" project="spool-wall-rack">
    <nav className="gl-breadcrumb" aria-label="Breadcrumb"><a href="/">Projects</a><span>/</span><a href="/#hardware">Hardware &amp; mechanisms</a><span>/</span><span>Spool wall rack</span></nav>
    <div className="sr-page">
      <section className="gl-pane sr-hero" aria-labelledby="rack-title">
        <div className="gl-pane-title"><span>HARDWARE / SPOOL WALL RACK</span><span>E13 · 10 SEP 2026</span></div>
        <div className="sr-hero-grid">
          <div className="sr-hero-copy"><p className="gl-kicker">PRINTABLE HARDWARE / OPEN ENGINEERING</p><h1 id="rack-title">A place for<br />every spool.</h1><p>A wall-mounted, two-rail rack built around a compact printed bracket. Straight tapers reinforce the inner seat; flexible fingers retain the rods.</p><p className="sr-lede">The finished shape, the print setup, and the evidence behind both.</p><div className="sr-actions"><a className="gl-button sr-primary" href={downloads + 'bracket-with-modifier-helpers.step'} download>Download E13 STEP ↓</a><a className="gl-button" href="#engineering">Explore the engineering →</a></div><p className="sr-caption">Engineering prototype. Physical fit, hot-load and lifetime qualification remain.</p></div>
          <Figure file="progress-exterior.png" alt="E13 bracket with straight underside tapers, two rod seats and two recessed screw accesses" caption="ACTUAL FINISHED CAD / E13" eager />
        </div>
        <dl className="sr-specs"><div><dt>Print envelope</dt><dd>207.51 × 219 × 24 <small>mm</small></dd></div><div><dt>Added seat depth</dt><dd>11 <small>mm</small></dd></div><div><dt>Broad-face chamfers</dt><dd>50° <small>above the bed</small></dd></div></dl>
      </section>

      <nav className="sr-contents" aria-label="On this page"><a href="#design">01 / Design</a><a href="#engineering">02 / Engineering</a><a href="#printing">03 / Print setup</a><a href="#downloads">04 / Downloads</a><a href="#record">05 / Project record</a></nav>

      <section className="gl-pane" id="design" aria-labelledby="design-title">
        <div className="gl-pane-title"><h2 id="design-title">01 / STRAIGHT LINES, CAREFUL DETAILS</h2><span>GEOMETRY CHECKED</span></div>
        <div className="sr-two-column"><div className="sr-copy"><h3>Strength follows the shape.</h3><p>Two long, straight flanks lead into a short flat underside. The 11 mm reinforcement is only 1.5 mm deeper than the curved E12, with a broader taper into the knee and outer arm.</p><p>Small corner blends and mirrored chamfers finish the edges. The original flexible fingers, relief pockets, screw access and rod positions stay in place.</p><dl className="sr-facts"><div><dt>Flanks</dt><dd>41 mm horizontal run · about 15°</dd></div><div><dt>Flat underside</dt><dd>28 mm long</dd></div><div><dt>Inner-center section</dt><dd>30 mm deep</dd></div><div><dt>Nominal rod seat</dt><dd>26.0 mm for nominal 25.4 mm stock</dd></div></dl><p className="sr-caption">Measure the actual rods and print a fit coupon before making the rack.</p><a href={source + '/fit/README.md'}>Rod fit coupons &amp; measurement plan ↗</a></div><Figure file="depth-comparison.png" alt="Overlay of E13 straight underside tapers and the earlier curved E12 reinforcement" caption="THE SHAPE CHANGE / E12 TO E13" /></div>
        <div className="sr-two-column sr-rule"><Figure file="finish-inner-front.png" alt="Close-up of the E13 inner rod seat showing the retained flexible fingers and chamfer finish" caption="INNER SEAT / FINGERS AND FINISH" /><Figure file="engineering-drawing.png" alt="Dimensioned E13 profile and sections through the finished bracket" caption="PROFILE, DIMENSIONS AND FINISHED SECTIONS" /></div>
        <p className="gl-caution">CAD checks pass: one valid body, two aligned helpers, mirrored chamfers, preserved finger geometry and 322 nominal spool-clearance cases. These checks do not establish printed fit or snap force.</p>
      </section>

      <section className="gl-pane" id="engineering" aria-labelledby="engineering-title">
        <div className="gl-pane-title"><h2 id="engineering-title">02 / INSIDE THE LOAD PATH</h2><span>REFINED 3D ANALYSIS</span></div>
        <div className="sr-copy"><h3>Better across the seat, knee and arm.</h3><p>The E13 model includes the finished chamfers, contour walls, four continuous solid plates and screw tunnels. It uses compression-only wall contact and rigid washer and shank restraints. Sparse infill receives zero structural credit.</p><p>The comparison below uses volume-weighted 99th-percentile stress in matching regions at the same nominal 1 mm mesh size. The reference load is <strong>12 kg equivalent per bracket</strong>; it is an analysis case, not a released load rating.</p></div>
        <div className="sr-table-wrap"><table><caption>Regional p99 stress change versus E12 · negative means lower</caption><thead><tr><th scope="col">Region</th><th scope="col">8 walls</th><th scope="col">10 walls</th></tr></thead><tbody>{[['Inner seat', '−13.28%', '−13.22%'], ['Knee', '−9.31%', '−10.37%'], ['Outer arm', '−19.41%', '−20.24%'], ['Lower screw landing', '−0.17%', '+0.93%'], ['Upper screw landing', '+1.17%', '−1.12%']].map(row => <tr key={row[0]}><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div>
        <div className="sr-two-column sr-rule"><Figure file="fem-3d.png" alt="Refined eight-wall E13 von Mises stress field with full bracket and cutaway views" caption="ACTUAL SOLVED FIELD / 8 WALLS" /><div className="sr-copy"><h3>Resolution where the geometry matters.</h3><p>Three global mesh levels—2, 1.5 and 1 mm—resolve the complete bracket. The finest models contain <strong>757,028</strong> tetrahedra at 8 walls and <strong>787,137</strong> at 10 walls.</p><p>The last refinement changes front movement by about <strong>1.9%</strong> and the near-seat stress statistic by <strong>1.1% or less</strong>. Independent force, moment and free-residual checks pass.</p><p>The E12 eight-wall baseline required a different mesher. Nominal resolution and physical inputs match; individual meshes differ. The full audit records that limit.</p><a href={source + '/analysis/e13/HOTSPOTS.md'}>Mesh refinement, regional windows &amp; raw peaks ↗</a></div></div>
        <Figure file="fem-sections.png" alt="XY and transverse sections through the solved E13 tetrahedra showing walls and internal solid plates" caption="CUT THROUGH THE MODEL / ACTUAL TETRAHEDRAL SECTIONS" />
        <p className="gl-caution"><strong>Local peaks remain.</strong> Isolated maxima still change with mesh refinement; screw-landing stress is essentially unchanged. Figures use a common 6 MPa display cap, while saved fields retain every finite element and its raw stress. These results do not establish rupture strength or long-term print performance.</p>
        <div className="sr-copy"><p>At the reference load, grade-specific room-temperature moduli give about <strong>0.627 mm</strong> initial front movement for the 8-wall PLA case and <strong>0.838 mm</strong> for 10-wall PETG. These are bracket-only model results. Rod sag, mounting movement, heat and creep still need to be accounted for.</p><div className="sr-actions"><a className="gl-button" href={source + '/analysis/e13/RESULTS.md'}>Materials, loads &amp; creep sensitivities ↗</a><a className="gl-button" href={assets + 'hotspot-comparison.png'}>Open hotspot comparison ↗</a></div></div>
      </section>

      <section className="gl-pane" id="printing" aria-labelledby="printing-title">
        <div className="gl-pane-title"><h2 id="printing-title">03 / PRINT THE STRUCTURE</h2><span>ORCASLICER PATHS CHECKED</span></div>
        <div className="sr-two-column"><div className="sr-copy"><h3>Four solid bands. One aligned object.</h3><p>Print on the supplied broad side so the main bending load lies in the layer plane. Import the STEP as one object with three aligned parts.</p><ol className="sr-steps"><li><strong>Set up the body.</strong> Use 0.20 mm layers, a 0.4 mm nozzle, Arachne walls and Everywhere gap fill. Start with 8 walls for the PLA prototype or 10 for PETG.</li><li><strong>Keep the four solid bands.</strong> Use six top and six bottom layers. Convert both helpers to 100% infill modifiers at their supplied positions; keep body infill at 15%.</li><li><strong>Inspect the sliced paths.</strong> Check the bands, seat walls, flexible fingers, screw lands and access roofs. Calibrate temperature, flow, cooling and bonding for the actual filament.</li></ol></div><Figure file="modifier-stack.png" alt="Stack showing the two exterior solid skins and two internal 1.2 mm solid bands across the bracket" caption="FOUR CONTINUOUS 1.2 MM PLATES" /></div>
        <p className="gl-caution"><strong>STEP stores alignment, not slicer settings.</strong> Convert both helpers to modifiers. They must not print as extra exterior slabs. Check the 207.51 × 219 mm footprint against your printer’s usable bed area.</p>
        <Figure file="toolpath-sections.png" alt="Actual OrcaSlicer E13 extrusion paths through the seat and four solid bands for eight and ten walls" caption="ACTUAL ORCASLICER PATHS / BOTH WALL COUNTS" />
        <div className="sr-copy"><p>Both reference slices pass all 120 layers and all 24 intended solid-band layers, with sampled checks of the full planes, seat walls and fingers. Slicing does not qualify physical bonding, bridging or curling.</p><a href={source + '/designs/closed-wall-e13/README.md'}>Detailed print handoff &amp; verification records ↗</a></div>
      </section>

      <section className="gl-pane" id="downloads" aria-labelledby="downloads-title">
        <div className="gl-pane-title"><h2 id="downloads-title">04 / TAKE IT TO THE WORKBENCH</h2><span>E13 DOWNLOADS</span></div>
        <div className="sr-two-column"><div className="sr-copy"><h3>Start with the assembled STEP.</h3><p>The main body and both infill helpers retain their alignment. The STL bundle is a fallback if the importer loses those parts.</p><div className="sr-actions"><a className="gl-button sr-primary" href={downloads + 'bracket-with-modifier-helpers.step'} download>STEP with aligned helpers ↓</a><a className="gl-button" href={downloads + 'e13-stl-bundle.zip'} download>STL bundle ↓</a></div><p className="sr-caption">STEP: 15.25 MB · millimeters · geometry only. STL bundle: body-only.stl, helper-1.stl and helper-2.stl with setup notes.</p></div><div className="gl-link-list"><a href={source + '/README.md'}>Complete print &amp; engineering guide<span>↗</span></a><a href={source + '/fit/README.md'}>Fit coupons &amp; measurement plan<span>↗</span></a><a href={source + '/analysis/e13/README.md'}>Reproduce the analysis<span>↗</span></a><a href={source + '/analysis/e13/release-verification.json'}>Release checks &amp; artifact hashes<span>↗</span></a><a href={assets + 'provenance.json'}>Source record for these downloads and figures<span>↗</span></a></div></div>
      </section>

      <section className="gl-pane" id="record" aria-labelledby="record-title">
        <div className="gl-pane-title"><h2 id="record-title">05 / AN OPEN PROJECT RECORD</h2><span>DESIGN → ANALYSIS → PHYSICAL CHECKS</span></div>
        <div className="sr-two-column"><div className="sr-copy"><h3>The earlier shapes stay on record.</h3><p>E11 explored a deeper reinforcement. E12 reduced the protrusion. E13 adds straight tapers and a little depth, then follows the change through section checks, slicer paths and refined stress fields.</p><div className="sr-actions"><a className="gl-button" href={source + '/DESIGN-JOURNAL.md'}>Read the design journal ↗</a><a className="gl-button" href="https://github.com/thereprocase/spool-wall-rack">Open the repository ↗</a></div></div><div className="sr-copy sr-qualification"><h3>Next: prove the printed rack.</h3><p>Check rod fit and snap retention, immediate loaded movement, dowel sag and wall contact. Measure drift under the intended warm service conditions and inspect for cracking or layer separation.</p><p>No physical proof test or lifetime qualification is claimed. All figures and downloads on this page come from the published E13 revision.</p></div></div>
      </section>
      <a className="gl-button" href="/#hardware">← More hardware &amp; mechanisms</a>
    </div>
  </GridlineShell>;
}
