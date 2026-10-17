/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Static Pages navigation and original engineering images. */
import { categories, featuredProjects, projects, projectUrl } from '@/lib/projects';
import { GridlineShell } from '@/components/gridline-shell';

const studies = [
  {name:'Compare the hotspots.', src:'/spool-wall-rack/assets/hotspot-comparison.png', href:'/spool-wall-rack/#engineering', tag:'E12 → E13 / REGIONAL STRESS', caption:'Published regional stress comparison. Matching physical regions and nominal mesh resolution; the baseline and revised meshes differ. Local peaks are not a strength rating.'},
  {name:'The whole isolation stack.', src:'/paver-feet/stack-transmission.png', href:'/paver-feet/', tag:'PRINTER → PAVER → SHELF', caption:'Modeled transmission through the isolation stack. A sensitivity study, not measured attenuation; actual TPU behavior and service conditions matter.'},
  {name:'Stress, in three dimensions.', src:'/spool-wall-rack/assets/fem-3d.png', href:'/spool-wall-rack/#engineering', tag:'01 / FINITE ELEMENTS', caption:'E13 bracket · actual solved 8-wall field. 12 kg equivalent per bracket is an analysis case, not a load rating. Common 6 MPa display cap; raw peaks retained.'},
  {name:'Look inside the load path.', src:'/spool-wall-rack/assets/fem-sections.png', href:'/spool-wall-rack/#engineering', tag:'02 / TETRAHEDRAL SECTIONS', caption:'Sections through the solved E13 model show walls and internal solid plates. Sparse infill receives zero structural credit. Local peak stress remains mesh-sensitive.'},
  {name:'Follow the force.', src:'/p1s-feet/review/transmission.png', href:'/p1s-feet/review/', tag:'03 / VIBRATION MODEL', caption:'Printer isolation study · modeled force transmission. Material and ball stiffness assumptions are explored in the review; attenuation needs physical measurement.'},
  {name:'Material where it matters.', src:'/spool-wall-rack/assets/toolpath-sections.png', href:'/spool-wall-rack/#printing', tag:'04 / SLICED PATHS', caption:'Actual OrcaSlicer paths through the E13 seat and solid bands at both wall counts. Toolpath checks establish placement, not printed strength.'},
];
const illustrations = [
  {src:'/media/render/gear.png', name:'A better disc.', href:'https://github.com/thereprocase/kraken-remix-ogAMS', caption:'Kraken spoke gear · original teeth, hub and bore facets retained. Actual model, newly rendered.'},
  {src:'/media/render/rack.png', name:'Structure with purpose.', href:'/spool-wall-rack/', caption:'E13 rack · angular reinforcement and flexible rod retention. Actual model, newly rendered.'},
  {src:'/kraken/sections.png', name:'Every interface exposed.', href:'/kraken/', caption:'Kraken section views · keys, pockets and retained hardware interfaces. Original design by Humebeam.'},
];
const imageOverrides: Record<string, string> = {'5680-dock':'/media/projects/dock.png','dell-5560-wall-mount':'/media/projects/wall-mount.png','peg':'/media/projects/peg.png','claude-statusline':'/media/projects/statusline.svg','kraken':'/media/render/kraken.png', 'spool-wall-rack':'/media/render/rack.png','bambu-bridge':'/media/bambu-bridge/dashboard.webp'};
const captions: Record<string, string> = {'thermal-field':'Synthetic thermal scene · illustrative temperatures','bambu-bridge':'Real dashboard · synthetic demonstration data','trio':'Application interface · example collaboration','lord-of-the-code':'Actual agent workflow demonstration','claude-statusline':'Theme preview · example session indicators','deepseek-spark':'Published experiment · limited sample','fillaprint':'Rendered font specimens · three families'};

export default function Home() {
 return <GridlineShell>
  <section className="io-hero gl-pane" aria-labelledby="home-title">
   <div className="gl-pane-title"><span>THEREPROCASE / OPEN WORKSHOP</span><span>DESIGN · BUILD · TEST · SHARE</span></div>
   <div className="io-hero-layout">
    <div className="io-hero-copy"><p className="gl-kicker">HARDWARE WITH THE WORKINGS SHOWN</p><h1 id="home-title">Made to work.<br/><em>Open to inspect.</em></h1><p>Printable mechanisms, software tools and the engineering behind them. Explore the geometry. Follow the evidence. Build your own.</p><div className="io-actions"><a className="gl-button io-primary" href="#projects">Explore {featuredProjects.length} projects ↓</a><a className="gl-button" href="#analysis">Inside the analysis ↘</a></div><div className="io-index"><span>REAL CAD</span><span>OPEN SOURCE</span><span>REPRODUCIBLE STUDIES</span></div></div>
    <figure className="io-hero-figure"><a href="/kraken/"><img src="/media/render/kraken.png" width="1600" height="1000" alt="Cel-shaded Kraken AMS bodies in teal with their removable orange front bars lifted above the pockets" fetchPriority="high" /></a><figcaption><span>FEATURED / KRAKEN AMS REMIX</span><a href="/kraken/">Explore the assembly ↗</a></figcaption></figure>
   </div>
  </section>
  <section className="io-render-section" id="render-library" aria-labelledby="render-title">
   <div className="io-section-heading"><div><p className="gl-kicker">THE SHAPE OF THE IDEA</p><h2 id="render-title">Geometry, in the open.</h2></div><p>Real models. Inked contours. Every opening and interface comes from the geometry.</p></div>
   <div className="io-illustrations">{illustrations.map(item=><figure className="io-illustration" key={item.src}><a href={item.href}><img src={item.src} alt={item.caption} width="1600" height="1000" loading="lazy" /></a><figcaption><h3><a href={item.href}>{item.name} ↗</a></h3><p>{item.caption}</p><a className="io-original" href={item.src}>Full-size illustration ↗</a></figcaption></figure>)}</div>
  </section>
  <section className="io-analysis gl-pane" id="analysis" aria-labelledby="analysis-title">
   <div className="gl-pane-title"><span>ENGINEERING / BENEATH THE SURFACE</span><span>FIELDS · SECTIONS · PATHS</span></div>
   <div className="io-section-heading"><div><p className="gl-kicker">SHOW THE WORK</p><h2 id="analysis-title">Beautiful is a start.<br/>Evidence goes deeper.</h2></div><p>From the stress field to the extrusion path: inspect the assumptions, follow the comparisons, and open the original figures.</p></div>
   <div className="io-study-grid">{studies.map(item=><figure className="io-study" key={item.src}><div className="io-study-tag">{item.tag}</div><a href={item.src} aria-label={`Open full-size: ${item.name}`}><img src={item.src} alt={item.caption} loading="lazy" /></a><figcaption><h3><a href={item.href}>{item.name} ↗</a></h3><p>{item.caption}</p><a className="io-original" href={item.href}>Methods &amp; limitations ↗</a></figcaption></figure>)}</div>
   <p className="gl-caution">Simulation is evidence, not physical certification. Original scientific color scales are preserved. Each study links to its assumptions and remaining tests.</p>
  </section>
  <div id="projects"><div className="io-section-heading"><div><p className="gl-kicker">THE COMPLETE COLLECTION</p><h2>Find your next build.</h2></div><p>{featuredProjects.length} public projects. Models, downloads and source, one click away.</p></div>{categories.map((category,index)=><section className="gl-pane io-category" id={category.id} aria-labelledby={`${category.id}-title`} key={category.id}><div className="gl-pane-title"><h2 id={`${category.id}-title`}>{String(index+1).padStart(2,'0')} / {category.name.toUpperCase()}</h2><span>{projects.filter(p=>p.category===category.id).length} PROJECTS</span></div><p className="io-category-description">{category.description}</p><div className="io-project-grid">{projects.filter(p=>p.category===category.id).map(project=><article className="io-project" key={project.slug}><a className="io-project-image" href={projectUrl(project)}><img src={imageOverrides[project.slug] || project.image?.src} alt={project.image?.alt || 'Bambu Bridge dashboard with synthetic demonstration data'} loading="lazy" /></a><div className="io-project-copy"><p className="io-image-label">{captions[project.slug] || 'ACTUAL MODEL GEOMETRY'}</p><h3><a href={projectUrl(project)}>{project.name} ↗</a></h3><p>{project.summary}</p><div className="io-card-footer"><span>{project.status}</span><a href={projectUrl(project)}>Explore →</a></div></div></article>)}</div></section>)}</div>
 </GridlineShell>;
}
