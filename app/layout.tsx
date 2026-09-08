import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'thereprocase ? Projects & experiments',
  description: 'The project index for thereprocase: laptop mounts, the Precision 5680 desk dock, CAD tools, and the latest CFD airflow videos.',
  metadataBase: new URL('https://thereprocase.github.io/'),
  alternates: { canonical: '/' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
