import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from './providers';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Merge Life — a calm merge game',
  description:
    'A calm, local-first merge game about watches, hobbies and spending less time gaming. No streaks, no timers, no adverts.',
  applicationName: 'Merge Life',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: 'Merge Life',
    statusBarStyle: 'default',
  },
  icons: {
    icon: `${basePath}/icons/icon.svg`,
    apple: `${basePath}/icons/icon-192.png`,
  },
};

export const viewport: Viewport = {
  themeColor: '#f5f0e8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
            focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-surface-raised"
        >
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
