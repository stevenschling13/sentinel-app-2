import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from '@/components/ui/sonner';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Sentinel Trading Platform',
    template: '%s | Sentinel',
  },
  description: 'Autonomous stock trading command center',
  openGraph: {
    title: 'Sentinel Trading Platform',
    description: 'Autonomous stock trading command center',
    type: 'website',
  },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="h-full antialiased bg-background text-foreground font-sans">
        <AppShell>{children}</AppShell>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
