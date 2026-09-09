/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Pages links are document navigation; the supplied logo is a static asset. */
import { ProjectNavigation } from '@/components/project-navigation';

export function GridlineShell({ children, current = 'Project directory', category, project }: { children: React.ReactNode; current?: string; category?: string; project?: string }) {
  return <div className="gl-desktop" data-project={project}>
    <a className="gl-skip" href="#content">Skip to content</a>
    <header className="gl-titlebar"><a href="/" className="gl-brand"><img src="/gridline/logo-white.svg" width="20" height="20" alt="" />thereprocase</a><span>{current}</span><span className="gl-state">PUBLIC WORKSPACE</span></header>
    <nav className="gl-menu" aria-label="Main navigation"><a href="/" aria-current={current === 'Project directory' ? 'page' : undefined}>Projects</a><a href="/#render-library">Renders</a><a href="/#airflow">Flow videos</a><a href="https://github.com/thereprocase">GitHub ↗</a></nav>
    <div className="gl-workspace">
      <ProjectNavigation category={category} />
      <main id="content" className={`gl-content ${current === 'Project directory' ? 'gl-home' : 'gl-project-detail'}`}>{children}</main>
    </div>
    <footer className="gl-statusbar"><span>THEREPROCASE / PROJECT INDEX</span><span>GRIDLINE · 10 CONNECTED SITES</span><a href="https://github.com/thereprocase">Open GitHub ↗</a></footer>
  </div>;
}
