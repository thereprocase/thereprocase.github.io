'use client';
/* oxlint-disable next/no-html-link-for-pages -- Static Pages document navigation. */
import { useEffect, useState } from 'react';

// Turns the missing address into a filter query, so /gridfinity-shelf/ offers /?q=gridfinity shelf.
export function NotFoundSearch() {
  const [words, setWords] = useState('');
  useEffect(() => {
    setWords(decodeURIComponent(window.location.pathname).replace(/\.(html?|php)$/i, '').split(/[^a-z0-9]+/i).filter(word => word.length > 1 && !['404', 'index'].includes(word.toLowerCase())).join(' ').toLowerCase());
  }, []);
  if (!words) return null;
  return <p><a className="gl-button" href={`/?q=${encodeURIComponent(words)}`}>Search the index for “{words}” →</a></p>;
}
