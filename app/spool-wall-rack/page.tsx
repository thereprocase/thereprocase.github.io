import type { Metadata } from 'next';
import { SpoolRackProject } from '@/components/spool-rack-project';

export const metadata: Metadata = {
  title: 'Spool wall rack / E13 | thereprocase',
  description: 'Explore the E13 printable spool rack: angular reinforcement, finished CAD, refined stress fields, print setup and direct STEP downloads.',
  alternates: { canonical: '/spool-wall-rack/' },
  openGraph: {
    title: 'Spool wall rack / E13',
    description: 'Printable hardware, finished CAD and the engineering behind the shape.',
    url: '/spool-wall-rack/',
  },
};

export default SpoolRackProject;
