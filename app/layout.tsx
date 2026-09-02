import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solitaire Associations',
  description: 'A calm word-matching solitaire game.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Solitaire' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
