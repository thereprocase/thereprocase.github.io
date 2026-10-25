'use client';
import { useEffect, useState } from 'react';

// Filters the server-rendered A–Z list and project cards in place. Without JavaScript every
// project stays visible, so the static export keeps working as a plain directory.
export function ProjectFilter({ total }: { total: number }) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(total);

  // A ?q= link opens the index already filtered, e.g. /?q=gridfinity.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q');
    if (initial) setQuery(initial);
  }, []);

  useEffect(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    document.querySelectorAll<HTMLElement>('[data-filter]').forEach(item => {
      const match = terms.every(term => (item.dataset.filter ?? '').includes(term));
      item.hidden = !match;
      if (match && item.dataset.filterCount !== undefined) count++;
    });
    // Hide a group whose cards are all filtered out, so no empty panels remain.
    document.querySelectorAll<HTMLElement>('[data-filter-group]').forEach(group => {
      group.hidden = terms.length > 0 && !group.querySelector('[data-filter]:not([hidden])');
    });
    setShown(count);
  }, [query]);

  return <div className="io-filter">
    <label htmlFor="project-filter">Filter projects</label>
    <div className="io-filter-row">
      <input id="project-filter" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="gridfinity, P1S, font, Android…" autoComplete="off" spellCheck={false} />
      {query && <button type="button" onClick={() => setQuery('')}>Clear</button>}
    </div>
    <p className="io-filter-count" aria-live="polite">{query ? (shown ? `${shown} of ${total} projects` : 'No projects match. Try a shorter word.') : `${total} projects`}</p>
  </div>;
}
