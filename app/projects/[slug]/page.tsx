/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Static Pages uses document navigation and existing assets without an image server. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categories, projects, sourceUrl } from '@/lib/projects';
import { GridlineShell } from '@/components/gridline-shell';
import { SpoolRackProject } from '@/components/spool-rack-project';

export const dynamicParams = false;
export function generateStaticParams() { return projects.map(project => ({ slug: project.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find(item => item.slug === slug);
  return project ? { title: `${project.name} | thereprocase`, description: project.summary, alternates: { canonical: slug === 'spool-wall-rack' ? '/spool-wall-rack/' : `/projects/${slug}/` } } : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projects.find(item => item.slug === slug);
  if (!project) notFound();
  if (slug === 'spool-wall-rack') return <SpoolRackProject />;
  const category = categories.find(item => item.id === project.category)!;
  return <GridlineShell current={project.name} category={project.category} project={project.slug}>
    <nav className="gl-breadcrumb" aria-label="Breadcrumb"><a href="/">Projects</a><span>/</span><a href={`/#${category.id}`}>{category.name}</a><span>/</span><span>{project.name}</span></nav>
    <section className="gl-introduction"><div><p className="gl-kicker">{project.fork ? 'FORK / UPSTREAM CREDITED BELOW' : category.name.toUpperCase()}</p><h1>{project.name}</h1><p>{project.summary}</p></div></section>
    <p className={project.category === 'hardware' ? 'gl-caution' : 'gl-state-line'}>{project.status}</p>
    {project.image && <figure className="gl-pane gl-detail-render"><div className="gl-pane-title"><span>PROJECT PREVIEW / {project.name.toUpperCase()}</span></div><img src={project.image.src} alt={project.image.alt} width="1200" height="800" /><figcaption>{project.image.alt}. <a href={project.image.src}>Open original ↗</a></figcaption></figure>}
    <div className="gl-detail-columns"><section className="gl-pane"><h2 className="gl-pane-title">PROJECT RECORD</h2><div className="gl-prose"><p>{project.description}</p><h3>What it includes</h3><ul>{project.highlights.map(item => <li key={item}>{item}</li>)}</ul></div></section><section className="gl-pane"><h2 className="gl-pane-title gl-linked">OPEN / DOWNLOAD / SOURCE</h2><div className="gl-link-list">{project.links.map(link => <a key={link.href} href={link.href}>{link.label}<span aria-hidden="true">↗</span></a>)}<a href={sourceUrl(project)}>{project.fork ? 'This fork on GitHub' : 'Source on GitHub'}<span aria-hidden="true">↗</span></a></div></section></div>
    <a className="gl-button" href={`/#${category.id}`}>← Back to {category.name}</a>
  </GridlineShell>;
}
