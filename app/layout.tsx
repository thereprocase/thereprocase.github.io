import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'thereprocase | Tools, parts & experiments',
  description: 'Explore Trio, Lord of the Code, printable hardware, CAD tools, developer utilities, home automation, and the latest CFD airflow videos.',
  metadataBase: new URL('https://thereprocase.github.io/'),
  alternates: { canonical: '/' },
  icons: { icon: '/gridline/logo.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
