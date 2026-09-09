/* oxlint-disable next/no-html-link-for-pages -- Static Pages document navigation. */
import { GridlineShell } from '@/components/gridline-shell';
export default function NotFound() {
  return <GridlineShell current="Page not found"><section className="gl-pane"><h1 className="gl-pane-title">404 / PAGE NOT FOUND</h1><div className="gl-prose"><p>This address does not match a published page.</p><a className="gl-button" href="/">Open the project directory →</a></div></section></GridlineShell>;
}
