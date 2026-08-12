import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import { ToastProvider } from '@/components/ui/toast';
import { PWARegister } from '@/components/pwa-register';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/lib/i18n/provider';
import { CookieBanner } from '@/components/cookie-banner';
import { withBasePath } from '@/lib/base-path';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TrainMind',
    template: '%s | TrainMind',
  },
  // In inglese come la lingua di default dell'interfaccia: i metadata sono
  // statici e non seguono lo switcher, quindi è questa la versione che
  // vedono i motori di ricerca e le anteprime dei link.
  description:
    'AI platform for basketball strength and conditioning coaches — training management, athlete monitoring, intelligent assistant',
  // Il manifest è generato da src/app/manifest.ts, non più servito da public/:
  // i percorsi che contiene devono seguire il sottopercorso dell'app.
  manifest: withBasePath('/manifest.webmanifest'),
  // Next non applica il basePath ai riferimenti scritti nei metadata:
  // le risorse di public/ vanno prefissate a mano.
  icons: {
    icon: withBasePath('/favicon.svg'),
    shortcut: withBasePath('/favicon.svg'),
    apple: withBasePath('/favicon.svg'),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TrainMind',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  themeColor: '#0D3B3B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Lingua di partenza: deve combaciare con DEFAULT_LOCALE in
    // src/lib/i18n/store.ts. Al primo mount I18nProvider la sostituisce
    // con quella scelta dall'utente.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TrainMind" />
        <meta name="theme-color" content="#0D3B3B" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href={withBasePath('/manifest.webmanifest')} />
        <link rel="apple-touch-icon" href={withBasePath('/favicon.svg')} />
        <link rel="icon" type="image/svg+xml" href={withBasePath('/favicon.svg')} />
        <link rel="icon" type="image/x-icon" href={withBasePath('/favicon.ico')} />
      </head>
      <body className="min-h-screen bg-slate-50 antialiased dark:bg-slate-950">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider>{children}</ToastProvider>
              <CookieBanner />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
