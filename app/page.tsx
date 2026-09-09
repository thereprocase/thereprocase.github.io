/* oxlint-disable next/no-html-link-for-pages -- Document navigation also links independent GitHub Pages sites. */
import { categories, featuredProjects, projects } from '@/lib/projects';

const flowBase = '/dell-5560-wall-mount/simulation/revh-transient/sequence/';

export default function Home() {
  return (
    <>
      <a className="skip" href="#projects">Skip to projects</a>
      <header className="masthead">
        <a className="brand" href="/" aria-label="thereprocase home"><span className="mark" aria-hidden="true">r.</span>thereprocase</a>
        <nav aria-label="Main navigation"><a href="#projects">Projects</a><a href="#airflow">Flow videos</a><a href="https://github.com/thereprocase">GitHub ↗</a></nav>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">THE PROJECT INDEX · {featuredProjects.length} FEATURED PROJECTS</p>
          <h1 id="page-title">Tools, parts<br /><span>&amp; experiments.</span></h1>
          <p className="lede">Coding agents, printable hardware, and tools built around everyday problems.</p>
        </section>
        <section className="spotlights" aria-label="Featured collaboration tools">
          {projects.filter(project => project.spotlight).map(project => (
            <a className="spotlight" key={project.slug} href={`/projects/${project.slug}/`}>
              <p className="eyebrow">AGENT COLLABORATION</p>
              <h2>{project.name}<span aria-hidden="true">↗</span></h2>
              <p>{project.summary}</p>
              <span className="spotlight-action">Explore the project →</span>
            </a>
          ))}
        </section>
        <nav className="category-nav" aria-label="Project categories">
          {categories.map(category => <a key={category.id} href={`#${category.id}`}>{category.name}</a>)}
        </nav>
        <div className="content-grid">
          <div id="projects">
            {categories.map(category => (
              <section className="project-group" id={category.id} aria-labelledby={`${category.id}-title`} key={category.id}>
                <div className="section-label"><h2 id={`${category.id}-title`}>{category.name}</h2><span>{projects.filter(project => project.category === category.id).length} projects</span></div>
                <p className="group-description">{category.description}</p>
                <div className="project-list">
                  {projects.filter(project => project.category === category.id).map(project => (
                    <a className={`project${project.fork ? ' fork-project' : ''}`} href={`/projects/${project.slug}/`} key={project.slug}>
                      <div><h3>{project.name}</h3><p className="description">{project.summary}</p></div><span className="project-arrow" aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside id="airflow" aria-labelledby="airflow-title">
            <div className="flow-panel">
              <p className="eyebrow">REV H / AIRFLOW STUDY</p>
              <h2 id="airflow-title">Follow<br />the flow.</h2>
              <p className="flow-copy">Moving particles and trails at 5× playback. These links follow each newly published checkpoint.</p>
              <div className="video-link"><div><span className="video-index">A</span><h3>Started from still air</h3></div><a href={flowBase + 'latest-tracers.mp4'}>Play latest particle video <span aria-hidden="true">↗</span></a></div>
              <div className="video-link"><div><span className="video-index">B</span><h3>Already flowing</h3></div><a href={flowBase + 'flowing/latest-tracers.mp4'}>Play latest particle video <span aria-hidden="true">↗</span></a></div>
              <a className="archive-link" href={flowBase}>Progress &amp; archived videos <span aria-hidden="true">↗</span></a>
              <p className="flow-note">Exploratory CFD for visualization. The flowing case starts from an unconverged steady-solver field; these videos do not establish validated cooling performance.</p>
            </div>
            <p className="side-note">Each project page points to its source, current status, and the files or instructions needed to explore it.</p>
          </aside>
        </div>
      </main>
      <footer><span>thereprocase / project index</span><a href="https://github.com/thereprocase/thereprocase.github.io">Source for this index ↗</a></footer>
    </>
  );
}
