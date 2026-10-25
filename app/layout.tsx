import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'thereprocase | CAD, 3D printing and software projects',
  description: 'Printable parts with CAD and downloads, browser tools that generate STL files, fonts for printed labels, and software for printers and coding agents.',
  metadataBase: new URL('https://thereprocase.github.io/'),
  alternates: { canonical: '/' },
  icons: { icon: '/gridline/logo.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="gl-polished gl-react">{children}</body></html>;
}
