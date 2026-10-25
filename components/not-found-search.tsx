'use client';
/* oxlint-disable next/no-html-link-for-pages -- Static Pages document navigation. */
import { useEffect, useState } from 'react';

// Turns the missing address into a filter query, so /gridfinity-shelf/ offers /?q=gridfinity shelf.
export function NotFoundSearch() {
  const [words, setWords] = useState('');
  useEffect(() => {
    let path = window.location.pathname;
    // A malformed escape such as /bar% would throw and blank the whole 404 page.
    try { path = decodeURIComponent(path); } catch { /* keep the raw path */ }
    setWords(path.replace(/\.(html?|php)$/i, '').split(/[^a-z0-9]+/i).filter(word => word.length > 1 && !['404', 'index', 'projects', 'media', 'assets'].includes(word.toLowerCase())).join(' ').toLowerCase());
  }, []);
  if (!words) return null;
  return <p><a className="gl-button" href={`/?q=${encodeURIComponent(words)}`}>Search the index for “{words}” →</a></p>;
}
