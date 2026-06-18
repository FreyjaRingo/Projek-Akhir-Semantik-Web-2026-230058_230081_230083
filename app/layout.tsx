import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AnimeGraph Nexus',
    template: '%s | AnimeGraph Nexus',
  },
  description: 'Eksplorasi knowledge graph anime berbasis RDF, SPARQL, dan data MyAnimeList.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
