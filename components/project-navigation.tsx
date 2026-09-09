'use client';
/* oxlint-disable next/no-html-link-for-pages -- The project network uses static document navigation. */
import { useState } from 'react';
import { categories } from '@/lib/projects';

export function ProjectNavigation({ category }: { category?: string }) {
  const [expanded, setExpanded] = useState(false);
  return <aside className="gl-directory" data-expanded={expanded}>
    <div className="gl-directory-inner">
      <h2 className="gl-caption">PROJECT GROUPS</h2>
      <button className="gl-groups-toggle" aria-expanded={expanded} aria-controls="project-groups" onClick={() => setExpanded(!expanded)}><span>PROJECT GROUPS</span><span>{expanded ? 'Close −' : 'Browse +'}</span></button>
      <nav id="project-groups" aria-label="Project categories">{categories.map((item, i) => <a key={item.id} href={`/#${item.id}`} aria-current={category === item.id ? 'location' : undefined} onClick={() => setExpanded(false)}><span className="gl-index">0{i + 1}</span><span>{item.name}</span></a>)}</nav>
      <div className="gl-directory-note"><span className="gl-state">9 FEATURED PROJECTS</span><p>Tools, printable hardware, and the working record behind them.</p></div>
      <a className="gl-directory-source" href="https://github.com/thereprocase/thereprocase.github.io">View index source ↗</a>
    </div>
  </aside>;
}
