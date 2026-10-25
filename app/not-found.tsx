/* oxlint-disable next/no-html-link-for-pages -- Static Pages document navigation. */
import { GridlineShell } from '@/components/gridline-shell';
import { NotFoundSearch } from '@/components/not-found-search';
import { categories, featuredProjects, projectUrl } from '@/lib/projects';
export default function NotFound() {
  return <GridlineShell current="Page not found"><section className="gl-pane"><h1 className="gl-pane-title">404 / PAGE NOT FOUND</h1><div className="gl-prose"><p>This address does not match a published page.</p><NotFoundSearch /><a className="gl-button" href="/">Open the project index →</a></div></section>
  <section className="gl-pane io-az" aria-labelledby="az-title"><div className="gl-pane-title"><h2 id="az-title">ALL PROJECTS A–Z</h2><span>{featuredProjects.length} PROJECTS</span></div><ul className="io-az-list">{[...featuredProjects].sort((a,b)=>a.name.localeCompare(b.name)).map(project=><li key={project.slug}><a href={projectUrl(project)}>{project.name}</a><span>{categories.find(c=>c.id===project.category)?.name}</span></li>)}</ul></section></GridlineShell>;
}
