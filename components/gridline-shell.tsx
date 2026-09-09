/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Pages links are document navigation; the supplied logo is a static asset. */
import { categories } from '@/lib/projects';

export function GridlineShell({ children, current = 'Project directory', category }: { children: React.ReactNode; current?: string; category?: string }) {
  return <div className="gl-desktop">
    <a className="gl-skip" href="#content">Skip to content</a>
    <header className="gl-titlebar"><a href="/" className="gl-brand"><img src="/gridline/logo-white.svg" width="20" height="20" alt="" />thereprocase</a><span>{current}</span><span className="gl-state">PUBLIC WORKSPACE</span></header>
    <nav className="gl-menu" aria-label="Main navigation"><a href="/" aria-current={current === 'Project directory' ? 'page' : undefined}>Projects</a><a href="/#render-library">Renders</a><a href="/#airflow">Flow videos</a><a href="https://github.com/thereprocase">GitHub ↗</a></nav>
    <div className="gl-workspace">
      <aside className="gl-directory"><h2 className="gl-caption">PROJECT GROUPS</h2><nav aria-label="Project categories">{categories.map((item, i) => <a key={item.id} href={`/#${item.id}`} aria-current={category === item.id ? 'location' : undefined}><span className="gl-index">0{i + 1}</span>{item.name}</a>)}</nav><div className="gl-directory-note"><span className="gl-state">9 FEATURED PROJECTS</span><p>Tools, printable hardware, and the working record behind them.</p></div><a className="gl-directory-source" href="https://github.com/thereprocase/thereprocase.github.io">View index source ↗</a></aside>
      <main id="content" className="gl-content">{children}</main>
    </div>
    <footer className="gl-statusbar"><span>THEREPROCASE / PROJECT INDEX</span><span>GRIDLINE · 5 CONNECTED SITES</span><a href="https://github.com/thereprocase">Open GitHub ↗</a></footer>
  </div>;
}

export function Workflow({ kind }: { kind: 'trio' | 'lord-of-the-code' }) {
  return <div className="gl-workflow" aria-label={kind === 'trio' ? 'Independent agent sessions share messages and task claims through Trio' : 'Review findings lead to fixes and a merge workflow'}>
    {(kind === 'trio' ? ['AGENT SESSIONS', 'MESSAGES + CLAIMS', 'SHARED WORKSPACE'] : ['SPECIALIST REVIEW', 'FINDINGS + FIXES', 'SCRIBE-MERGE']).map((step, i) => <div key={step}><span className="gl-index">0{i + 1}</span><strong>{step}</strong>{i < 2 && <span aria-hidden="true">→</span>}</div>)}
  </div>;
}
