const projectBase = '/dell-5560-wall-mount/';
const projects = [
  { number: '01', category: 'HARDWARE / CAD', name: 'Laptop wall mount', description: 'Minimalist M1 and ducted Rev H. Explore the models, print files, and assembly guides.', href: projectBase, tag: '5560' },
  { number: '02', category: 'HARDWARE / CAD', name: 'Precision 5680 desk dock', description: 'An open design with recessed fans, printed hardware, and a resettable connector holder.', href: '/5680-dock/', tag: '5680' },
  { number: '03', category: 'CAD TOOL', name: 'Onshape reference align', description: 'Scale and rotate reference images in Onshape using independent pixel pairs.', href: '/onshape-reference-align/', tag: 'TOOL' },
  { number: '04', category: 'DEVELOPER TOOL', name: 'Claude usage', description: 'A 90-day usage heatmap for Claude Code.', href: '/claude-usage/', tag: 'TOOL' },
];

export default function Home() {
  return (
    <>
      <a className="skip" href="#projects">Skip to projects</a>
      <header className="masthead">
        <a className="brand" href="/" aria-label="thereprocase home"><span className="mark" aria-hidden="true">r.</span>thereprocase</a>
        <nav aria-label="Main navigation"><a href="#airflow">Flow videos</a><a href="https://github.com/thereprocase">GitHub <span aria-hidden="true">?</span></a></nav>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">THE PROJECT INDEX</p>
          <h1 id="page-title">Projects &amp;<br /><span>experiments.</span></h1>
          <p className="lede">Hardware, CAD, airflow, and the tools along the way.</p>
        </section>
        <div className="content-grid">
          <section id="projects" aria-labelledby="projects-title">
            <div className="section-label"><h2 id="projects-title">Explore the projects</h2><span>01 ? 04</span></div>
            <div className="project-list">
              {projects.map(project => (
                <a className="project" href={project.href} key={project.number}>
                  <span className="project-number" aria-hidden="true">{project.number}</span>
                  <div><p className="category">{project.category}</p><h3>{project.name}</h3><p className="description">{project.description}</p></div>
                  <span className="project-arrow" aria-hidden="true">?</span>
                </a>
              ))}
            </div>
          </section>
          <aside id="airflow" aria-labelledby="airflow-title">
            <div className="flow-panel">
              <p className="eyebrow">REV H / AIRFLOW STUDY</p>
              <h2 id="airflow-title">Follow<br />the flow.</h2>
              <p className="flow-copy">Watch the latest cumulative CFD videos. These links follow each new published checkpoint.</p>
              <div className="video-link"><div><span className="video-index">A</span><h3>Started from still air</h3></div><a href={projectBase + 'simulation/revh-transient/sequence/latest.mp4'}>Play latest MP4 <span aria-hidden="true">?</span></a></div>
              <div className="video-link"><div><span className="video-index">B</span><h3>Already flowing</h3></div><a href={projectBase + 'simulation/revh-transient/sequence/flowing/latest.mp4'}>Play latest MP4 <span aria-hidden="true">?</span></a></div>
              <a className="archive-link" href={projectBase + 'simulation/revh-transient/sequence/'}>Progress &amp; archived videos <span aria-hidden="true">?</span></a>
              <p className="flow-note">Exploratory simulations. The flowing case starts from an unconverged steady-solver field.</p>
            </div>
            <p className="side-note">Models, measurements, and working notes live with each project.</p>
          </aside>
        </div>
      </main>
      <footer><span>thereprocase / project index</span><a href="https://github.com/thereprocase/thereprocase.github.io">Source for this page <span aria-hidden="true">?</span></a></footer>
    </>
  );
}
