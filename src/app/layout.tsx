import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Video Link Queue Service',
  description: 'Automated content curation and publishing system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}