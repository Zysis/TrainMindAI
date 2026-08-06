import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { PwaRegister } from '@/components/pwa-register';
import { I18nProvider } from '@/lib/i18n/provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'TrainMind Athlete',
  description: 'La tua app per allenamento e wellness',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TrainMind',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
            <PwaRegister />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
