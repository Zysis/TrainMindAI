import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import { ToastProvider } from '@/components/ui/toast';
import { PWARegister } from '@/components/pwa-register';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/lib/i18n/provider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TrainMind AI',
    template: '%s | TrainMind AI',
  },
  description:
    'Piattaforma AI per preparatori fisici nel basket — gestione allenamenti, monitoraggio atleti, assistente intelligente',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TrainMind AI',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom for accessibility (WCAG 1.4.4)
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0D3B3B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TrainMind AI" />
        <meta name="theme-color" content="#0D3B3B" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-slate-50 antialiased dark:bg-slate-950">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
