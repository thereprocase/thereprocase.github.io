/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Static Pages uses document navigation and existing image assets without an image server. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categories, projects, sourceUrl } from '@/lib/projects';

export const dynamicParams = false;
export function generateStaticParams() { return projects.map(project => ({ slug: project.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find(item => item.slug === slug);
  return project ? { title: `${project.name} | thereprocase`, description: project.summary, alternates: { canonical: `/projects/${slug}/` } } : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projects.find(item => item.slug === slug);
  if (!project) notFound();
  const category = categories.find(item => item.id === project.category)!;
  return (
    <>
      <a className="skip" href="#project-detail">Skip to project</a>
      <header className="masthead"><a className="brand" href="/"><span className="mark" aria-hidden="true">r.</span>thereprocase</a><nav aria-label="Main navigation"><a href={`/#${category.id}`}>{category.name}</a><a href="/">All projects</a></nav></header>
      <main id="project-detail" className="detail">
        <a className="back-link" href={`/#${category.id}`}>← {category.name}</a>
        <p className="eyebrow">{project.fork ? 'FORKS & UPSTREAM WORK' : category.name.toUpperCase()}</p>
        <h1>{project.name}</h1>
        <p className="detail-summary">{project.summary}</p>
        <p className="status">{project.status}</p>
        {project.image && <img className="project-image" src={project.image.src} alt={project.image.alt} width="1200" height="675" />}
        <div className="detail-columns">
          <section aria-labelledby="about-title"><h2 id="about-title">About the project</h2><p>{project.description}</p><ul>{project.highlights.map(item => <li key={item}>{item}</li>)}</ul></section>
          <section className="project-links" aria-labelledby="links-title"><h2 id="links-title">Explore</h2>{project.links.map(link => <a key={link.href} href={link.href}>{link.label}<span aria-hidden="true">↗</span></a>)}<a href={sourceUrl(project)}>{project.fork ? 'This fork on GitHub' : 'Source on GitHub'}<span aria-hidden="true">↗</span></a></section>
        </div>
      </main>
      <footer><a href="/">← All projects</a><a href="https://github.com/thereprocase/thereprocase.github.io">Source for this index ↗</a></footer>
    </>
  );
}
