'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Brain,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';

/* ─────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────── */
type Locale = 'it' | 'en' | 'es';
type BillingCycle = 'monthly' | 'yearly';

/* ─────────────────────────────────────────────────────────
 * Translations (IT / EN / ES)
 * ───────────────────────────────────────────────────────── */
const T = {
  it: {
    'nav.features': 'Funzionalità',
    'nav.pricing': 'Prezzi',
    'nav.login': 'Accedi',
    'nav.trial': 'Prova gratis',

    'hero.badge': 'Stagione 2026 · Live per il basket',
    'hero.title.1': 'Allenare di più,',
    'hero.title.2': 'decidere meglio.',
    'hero.title.3': 'Con l’AI dalla tua parte.',
    'hero.subtitle':
      'TrainMind AI è la piattaforma che usi ogni giorno per pianificare allenamenti, leggere il carico, prevenire infortuni e generare report. Pensata per preparatori atletici del basket.',
    'hero.cta.primary': 'Prova gratis 14 giorni',
    'hero.cta.secondary': 'Vedi la piattaforma',
    'hero.stat.clubs': 'Società',
    'hero.stat.athletes': 'Atleti',
    'hero.stat.reports': 'Tempo report',

    'mockup.url': 'trainmind.ai / dashboard',
    'mockup.kpi.acwr': 'ACWR',
    'mockup.kpi.wellness': 'Wellness',
    'mockup.kpi.athletes': 'Atleti',
    'mockup.chart.title': 'Load monitoring',
    'mockup.chart.range': '7 giorni',
    'mockup.ai.label': 'AI Coach',
    'mockup.ai.message': 'Pietro è in zona di rischio. Propongo',
    'mockup.ai.messageBold': 'deload di 2 giorni',
    'mockup.alert.label': 'Alert',
    'mockup.alert.value': '3 atleti',
    'mockup.today.label': 'Oggi',
    'mockup.today.value': 'Sessione ok',

    'features.pill': 'Piattaforma',
    'features.h2.1': 'Tutto quello che serve al tuo staff,',
    'features.h2.2': 'in un’unica piattaforma.',
    'features.sub':
      'Dalla gestione degli atleti alla periodizzazione AI-assisted — TrainMind AI copre l’intero workflow della preparazione atletica.',

    'features.analytics.label': 'Analytics',
    'features.analytics.title': 'Load monitoring in tempo reale',
    'features.analytics.desc':
      'sRPE, ACWR, wellness score e grafici interattivi. Alert automatici quando un atleta entra in zona di rischio.',
    'features.analytics.chartTitle': 'ACWR — Squadra',
    'features.analytics.chartRange': 'Ultimi 14 giorni',
    'features.analytics.alerts': '3 alert',

    'features.ai.label': 'AI Coach',
    'features.ai.title': 'Un assistente sempre al tuo fianco',
    'features.ai.desc':
      'Suggerimenti su periodizzazione, esercizi e protocolli RTP — basati sui dati reali della tua squadra.',
    'features.ai.chatUser': 'Pietro è ancora idoneo per martedì?',
    'features.ai.chatAI': 'Sconsigliato. ACWR 1.42 — propongo deload di 2 giorni.',

    'features.period.title': 'Periodizzazione',
    'features.period.desc': 'Blocchi, ondulati o lineari con simulazione carico.',
    'features.period.macro': 'Macrociclo',
    'features.period.weeks': '4 sett.',

    'features.athletes.title': 'Gestione atleti',
    'features.athletes.desc': 'Profili, antropometria, storico, Return-to-Play.',

    'features.reports.title': 'Report automatici',
    'features.reports.desc':
      'PDF e DOCX schedulati via email per staff tecnico e medico.',

    'features.security.title': 'Sicurezza e GDPR',
    'features.security.desc':
      'JWT, RBAC, crittografia at rest, gestione consensi e export dati.',
    'features.security.badge.gdpr': 'GDPR',
    'features.security.badge.iso': 'ISO ready',
    'features.security.badge.encrypted': 'Cifrato',

    'pricing.h2': 'Piani e prezzi',
    'pricing.sub':
      'Scegli il piano adatto alla tua organizzazione. Tutti i piani includono 14 giorni di prova gratuita.',
    'pricing.toggle.monthly': 'Mensile',
    'pricing.toggle.yearly': 'Annuale',
    'pricing.toggle.save': 'Risparmia fino all’11%',
    'pricing.popular': 'Più popolare',
    'pricing.period.month': '/mese',
    'pricing.period.year': '/anno',
    'pricing.equivalent': 'equivalenti a {price}/mese',

    'plan.starter.name': 'Starter',
    'plan.starter.tagline': 'Per chi parte e vuole le basi.',
    'plan.starter.cta': 'Inizia gratis',
    'plan.starter.feat.1': '1 squadra (12 atleti)',
    'plan.starter.feat.2': 'Report base',
    'plan.starter.feat.3': 'Wellness tracking',
    'plan.starter.feat.4': 'Calendario',

    'plan.pro.name': 'Professional',
    'plan.pro.tagline': 'Per società che vogliono fare sul serio.',
    'plan.pro.cta': 'Prova 14 giorni gratis',
    'plan.pro.feat.1': '3 squadre (12 atleti per squadra)',
    'plan.pro.feat.2': 'Report avanzati',
    'plan.pro.feat.3': 'AI Coach',
    'plan.pro.feat.4': 'Periodizzazione',
    'plan.pro.feat.5': 'RTP',
    'plan.pro.feat.6': 'Analytics',

    'plan.ultra.name': 'Ultra',
    'plan.ultra.tagline': 'Per club e federazioni, senza limiti.',
    'plan.ultra.cta': 'Contattaci',
    'plan.ultra.feat.1': 'Squadre e atleti illimitati',
    'plan.ultra.feat.2': 'Tutto Professional',
    'plan.ultra.feat.3': 'API access',
    'plan.ultra.feat.4': 'Supporto prioritario',

    'cta.h2': 'Pronto a trasformare la tua preparazione atletica?',
    'cta.sub':
      'Unisciti ai preparatori fisici che usano TrainMind AI per prendere decisioni migliori, più velocemente.',
    'cta.button': 'Inizia la prova gratuita',

    'footer.contact': 'Contatti',
    'footer.copyright': 'Tutti i diritti riservati.',
  },

  en: {
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.login': 'Log in',
    'nav.trial': 'Try for free',

    'hero.badge': '2026 Season · Live for basketball',
    'hero.title.1': 'Train more,',
    'hero.title.2': 'decide better.',
    'hero.title.3': 'With AI on your side.',
    'hero.subtitle':
      'TrainMind AI is the platform you use every day to plan training, read load, prevent injuries and generate reports. Built for basketball strength coaches.',
    'hero.cta.primary': 'Try free for 14 days',
    'hero.cta.secondary': 'See the platform',
    'hero.stat.clubs': 'Clubs',
    'hero.stat.athletes': 'Athletes',
    'hero.stat.reports': 'Time on reports',

    'mockup.url': 'trainmind.ai / dashboard',
    'mockup.kpi.acwr': 'ACWR',
    'mockup.kpi.wellness': 'Wellness',
    'mockup.kpi.athletes': 'Athletes',
    'mockup.chart.title': 'Load monitoring',
    'mockup.chart.range': '7 days',
    'mockup.ai.label': 'AI Coach',
    'mockup.ai.message': 'Pietro is in the danger zone. I suggest a',
    'mockup.ai.messageBold': '2-day deload',
    'mockup.alert.label': 'Alert',
    'mockup.alert.value': '3 athletes',
    'mockup.today.label': 'Today',
    'mockup.today.value': 'Session OK',

    'features.pill': 'Platform',
    'features.h2.1': 'Everything your staff needs,',
    'features.h2.2': 'on a single platform.',
    'features.sub':
      'From athlete management to AI-assisted periodization — TrainMind AI covers the entire athletic prep workflow.',

    'features.analytics.label': 'Analytics',
    'features.analytics.title': 'Real-time load monitoring',
    'features.analytics.desc':
      'sRPE, ACWR, wellness score and interactive charts. Automatic alerts when an athlete enters the risk zone.',
    'features.analytics.chartTitle': 'ACWR — Squad',
    'features.analytics.chartRange': 'Last 14 days',
    'features.analytics.alerts': '3 alerts',

    'features.ai.label': 'AI Coach',
    'features.ai.title': 'An assistant always by your side',
    'features.ai.desc':
      'Suggestions on periodization, exercises and RTP protocols — based on your squad’s real data.',
    'features.ai.chatUser': 'Is Pietro still fit for Tuesday?',
    'features.ai.chatAI': 'Not recommended. ACWR 1.42 — I suggest a 2-day deload.',

    'features.period.title': 'Periodization',
    'features.period.desc': 'Block, undulating or linear with load simulation.',
    'features.period.macro': 'Macrocycle',
    'features.period.weeks': '4 wks',

    'features.athletes.title': 'Athlete management',
    'features.athletes.desc': 'Profiles, anthropometry, history, Return-to-Play.',

    'features.reports.title': 'Automated reports',
    'features.reports.desc':
      'PDF and DOCX scheduled via email for technical and medical staff.',

    'features.security.title': 'Security & GDPR',
    'features.security.desc':
      'JWT, RBAC, encryption at rest, consent management and data export.',
    'features.security.badge.gdpr': 'GDPR',
    'features.security.badge.iso': 'ISO ready',
    'features.security.badge.encrypted': 'Encrypted',

    'pricing.h2': 'Plans & pricing',
    'pricing.sub':
      'Choose the plan that fits your organization. All plans include a 14-day free trial.',
    'pricing.toggle.monthly': 'Monthly',
    'pricing.toggle.yearly': 'Yearly',
    'pricing.toggle.save': 'Save up to 11%',
    'pricing.popular': 'Most popular',
    'pricing.period.month': '/month',
    'pricing.period.year': '/year',
    'pricing.equivalent': 'equivalent to {price}/month',

    'plan.starter.name': 'Starter',
    'plan.starter.tagline': 'For those starting out and wanting the basics.',
    'plan.starter.cta': 'Start free',
    'plan.starter.feat.1': '1 team (12 athletes)',
    'plan.starter.feat.2': 'Basic reports',
    'plan.starter.feat.3': 'Wellness tracking',
    'plan.starter.feat.4': 'Calendar',

    'plan.pro.name': 'Professional',
    'plan.pro.tagline': 'For clubs that want to mean business.',
    'plan.pro.cta': 'Try 14 days free',
    'plan.pro.feat.1': '3 teams (12 athletes per team)',
    'plan.pro.feat.2': 'Advanced reports',
    'plan.pro.feat.3': 'AI Coach',
    'plan.pro.feat.4': 'Periodization',
    'plan.pro.feat.5': 'RTP',
    'plan.pro.feat.6': 'Analytics',

    'plan.ultra.name': 'Ultra',
    'plan.ultra.tagline': 'For clubs and federations, no limits.',
    'plan.ultra.cta': 'Contact us',
    'plan.ultra.feat.1': 'Unlimited teams and athletes',
    'plan.ultra.feat.2': 'Everything in Professional',
    'plan.ultra.feat.3': 'API access',
    'plan.ultra.feat.4': 'Priority support',

    'cta.h2': 'Ready to transform your athletic preparation?',
    'cta.sub':
      'Join the strength coaches who use TrainMind AI to make better decisions, faster.',
    'cta.button': 'Start the free trial',

    'footer.contact': 'Contact',
    'footer.copyright': 'All rights reserved.',
  },

  es: {
    'nav.features': 'Funcionalidades',
    'nav.pricing': 'Precios',
    'nav.login': 'Iniciar sesión',
    'nav.trial': 'Prueba gratis',

    'hero.badge': 'Temporada 2026 · En vivo para el baloncesto',
    'hero.title.1': 'Entrenar más,',
    'hero.title.2': 'decidir mejor.',
    'hero.title.3': 'Con la IA de tu lado.',
    'hero.subtitle':
      'TrainMind AI es la plataforma que usas cada día para planificar entrenamientos, leer la carga, prevenir lesiones y generar informes. Pensada para preparadores físicos de baloncesto.',
    'hero.cta.primary': 'Prueba gratis 14 días',
    'hero.cta.secondary': 'Ver la plataforma',
    'hero.stat.clubs': 'Clubes',
    'hero.stat.athletes': 'Atletas',
    'hero.stat.reports': 'Tiempo informes',

    'mockup.url': 'trainmind.ai / panel',
    'mockup.kpi.acwr': 'ACWR',
    'mockup.kpi.wellness': 'Wellness',
    'mockup.kpi.athletes': 'Atletas',
    'mockup.chart.title': 'Monitoreo de carga',
    'mockup.chart.range': '7 días',
    'mockup.ai.label': 'AI Coach',
    'mockup.ai.message': 'Pietro está en zona de riesgo. Propongo',
    'mockup.ai.messageBold': 'descarga de 2 días',
    'mockup.alert.label': 'Alerta',
    'mockup.alert.value': '3 atletas',
    'mockup.today.label': 'Hoy',
    'mockup.today.value': 'Sesión OK',

    'features.pill': 'Plataforma',
    'features.h2.1': 'Todo lo que tu staff necesita,',
    'features.h2.2': 'en una única plataforma.',
    'features.sub':
      'Desde la gestión de atletas hasta la periodización asistida por IA — TrainMind AI cubre todo el flujo de la preparación física.',

    'features.analytics.label': 'Analytics',
    'features.analytics.title': 'Monitoreo de carga en tiempo real',
    'features.analytics.desc':
      'sRPE, ACWR, wellness score y gráficos interactivos. Alertas automáticas cuando un atleta entra en zona de riesgo.',
    'features.analytics.chartTitle': 'ACWR — Equipo',
    'features.analytics.chartRange': 'Últimos 14 días',
    'features.analytics.alerts': '3 alertas',

    'features.ai.label': 'AI Coach',
    'features.ai.title': 'Un asistente siempre a tu lado',
    'features.ai.desc':
      'Sugerencias de periodización, ejercicios y protocolos RTP — basados en los datos reales de tu equipo.',
    'features.ai.chatUser': '¿Pietro sigue apto para el martes?',
    'features.ai.chatAI': 'No recomendado. ACWR 1.42 — propongo descarga de 2 días.',

    'features.period.title': 'Periodización',
    'features.period.desc': 'Por bloques, ondulada o lineal con simulación de carga.',
    'features.period.macro': 'Macrociclo',
    'features.period.weeks': '4 sem.',

    'features.athletes.title': 'Gestión de atletas',
    'features.athletes.desc': 'Perfiles, antropometría, historial, Return-to-Play.',

    'features.reports.title': 'Informes automáticos',
    'features.reports.desc':
      'PDF y DOCX programados por email para staff técnico y médico.',

    'features.security.title': 'Seguridad y GDPR',
    'features.security.desc':
      'JWT, RBAC, cifrado en reposo, gestión de consentimientos y exportación de datos.',
    'features.security.badge.gdpr': 'GDPR',
    'features.security.badge.iso': 'ISO ready',
    'features.security.badge.encrypted': 'Cifrado',

    'pricing.h2': 'Planes y precios',
    'pricing.sub':
      'Elige el plan adecuado para tu organización. Todos los planes incluyen 14 días de prueba gratuita.',
    'pricing.toggle.monthly': 'Mensual',
    'pricing.toggle.yearly': 'Anual',
    'pricing.toggle.save': 'Ahorra hasta el 11%',
    'pricing.popular': 'Más popular',
    'pricing.period.month': '/mes',
    'pricing.period.year': '/año',
    'pricing.equivalent': 'equivalente a {price}/mes',

    'plan.starter.name': 'Starter',
    'plan.starter.tagline': 'Para quien empieza y quiere lo esencial.',
    'plan.starter.cta': 'Empezar gratis',
    'plan.starter.feat.1': '1 equipo (12 atletas)',
    'plan.starter.feat.2': 'Informes básicos',
    'plan.starter.feat.3': 'Wellness tracking',
    'plan.starter.feat.4': 'Calendario',

    'plan.pro.name': 'Professional',
    'plan.pro.tagline': 'Para clubes que van en serio.',
    'plan.pro.cta': 'Prueba 14 días gratis',
    'plan.pro.feat.1': '3 equipos (12 atletas por equipo)',
    'plan.pro.feat.2': 'Informes avanzados',
    'plan.pro.feat.3': 'AI Coach',
    'plan.pro.feat.4': 'Periodización',
    'plan.pro.feat.5': 'RTP',
    'plan.pro.feat.6': 'Analytics',

    'plan.ultra.name': 'Ultra',
    'plan.ultra.tagline': 'Para clubes y federaciones, sin límites.',
    'plan.ultra.cta': 'Contáctanos',
    'plan.ultra.feat.1': 'Equipos y atletas ilimitados',
    'plan.ultra.feat.2': 'Todo Professional',
    'plan.ultra.feat.3': 'Acceso API',
    'plan.ultra.feat.4': 'Soporte prioritario',

    'cta.h2': '¿Listo para transformar tu preparación física?',
    'cta.sub':
      'Únete a los preparadores físicos que usan TrainMind AI para tomar mejores decisiones, más rápido.',
    'cta.button': 'Empezar la prueba gratuita',

    'footer.contact': 'Contacto',
    'footer.copyright': 'Todos los derechos reservados.',
  },
} as const;

type TKey = keyof (typeof T)['it'];

/* ─────────────────────────────────────────────────────────
 * Pricing data
 * ───────────────────────────────────────────────────────── */
type Plan = {
  key: 'starter' | 'pro' | 'ultra';
  /** Slug brand mostrato anche come badge in alto a destra dell'app. */
  slug: 'START' | 'PRO' | 'ULTRA';
  monthly: number;
  yearly: number;
  features: TKey[];
  popular: boolean;
};

const PLANS: Plan[] = [
  {
    key: 'starter',
    slug: 'START',
    monthly: 14,
    yearly: 150,
    features: [
      'plan.starter.feat.1',
      'plan.starter.feat.2',
      'plan.starter.feat.3',
      'plan.starter.feat.4',
    ],
    popular: false,
  },
  {
    key: 'pro',
    slug: 'PRO',
    monthly: 21,
    yearly: 225,
    features: [
      'plan.pro.feat.1',
      'plan.pro.feat.2',
      'plan.pro.feat.3',
      'plan.pro.feat.4',
      'plan.pro.feat.5',
      'plan.pro.feat.6',
    ],
    popular: true,
  },
  {
    key: 'ultra',
    slug: 'ULTRA',
    monthly: 30,
    yearly: 320,
    features: [
      'plan.ultra.feat.1',
      'plan.ultra.feat.2',
      'plan.ultra.feat.3',
      'plan.ultra.feat.4',
    ],
    popular: false,
  },
];

/* ─────────────────────────────────────────────────────────
 * Main page
 * ───────────────────────────────────────────────────────── */
// Flag per mostrare/nascondere la sezione prezzi in landing e i link "Prezzi" nel menu.
// Cambiare a true quando i piani commerciali saranno pubblici.
const SHOW_PRICING = false;

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>('it');
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const t = (key: TKey): string => T[locale][key] ?? T.it[key];

  const heroStats = [
    { value: '30+', label: t('hero.stat.clubs') },
    { value: '1.200+', label: t('hero.stat.athletes') },
    { value: '−40%', label: t('hero.stat.reports') },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-9" />
            <span className="text-lg font-bold text-slate-900">
              TrainMind <span className="text-teal-600">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 md:gap-6">
            <a
              href="#features"
              className="hidden text-sm text-slate-600 hover:text-slate-900 md:inline"
            >
              {t('nav.features')}
            </a>
            {SHOW_PRICING && (
              <a
                href="#pricing"
                className="hidden text-sm text-slate-600 hover:text-slate-900 md:inline"
              >
                {t('nav.pricing')}
              </a>
            )}
            <LangSwitcher locale={locale} onChange={setLocale} />
            <Link
              href="/login"
              className="hidden text-sm font-medium text-slate-700 hover:text-slate-900 md:inline"
            >
              {t('nav.login')}
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              {t('nav.trial')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-24">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/80 via-white to-amber-50/40" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #0F172A 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="pointer-events-none absolute -top-24 right-0 h-[500px] w-[500px] rounded-full bg-teal-300/25 blur-3xl" />
        <div className="pointer-events-none absolute top-40 left-0 h-[400px] w-[400px] rounded-full bg-amber-200/30 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t('hero.badge')}
              </div>

              <h1 className="mb-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900 md:text-6xl lg:text-[4.5rem]">
                {t('hero.title.1')}{' '}
                <span className="relative inline-block">
                  <span className="relative z-10">{t('hero.title.2')}</span>
                  <span className="absolute -bottom-1 left-0 right-0 -z-0 h-3 rounded-sm bg-amber-300/60" />
                </span>
                <br />
                <span className="bg-gradient-to-r from-teal-600 via-teal-500 to-amber-500 bg-clip-text text-transparent">
                  {t('hero.title.3')}
                </span>
              </h1>

              <p className="mb-10 max-w-xl text-lg leading-relaxed text-slate-600">
                {t('hero.subtitle')}
              </p>

              <div className="mb-12 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/30"
                >
                  {t('hero.cta.primary')}
                  <Zap className="h-4 w-4 text-amber-300 transition group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-700"
                >
                  {t('hero.cta.secondary')}
                </a>
              </div>

              <div className="grid max-w-md grid-cols-3 gap-6 border-t border-slate-200/80 pt-6">
                {heroStats.map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                      {s.value}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <HeroMockup t={t} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features (Bento) ───────────────────────────── */}
      <section id="features" className="relative bg-slate-50/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700">
              {t('features.pill')}
            </div>
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              {t('features.h2.1')}{' '}
              <span className="text-teal-600">{t('features.h2.2')}</span>
            </h2>
            <p className="text-lg text-slate-600">{t('features.sub')}</p>
          </div>

          <div className="grid auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* BIG: Analytics */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10 md:col-span-2 lg:col-span-2 lg:row-span-2">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-teal-700">
                  {t('features.analytics.label')}
                </span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-slate-900">
                {t('features.analytics.title')}
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-600">
                {t('features.analytics.desc')}
              </p>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">
                      {t('features.analytics.chartTitle')}
                    </div>
                    <div className="text-[0.65rem] text-slate-400">
                      {t('features.analytics.chartRange')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="text-[0.65rem] font-medium text-amber-700">
                      {t('features.analytics.alerts')}
                    </span>
                  </div>
                </div>
                <BentoChart />
                <div className="mt-2 flex justify-between text-[0.65rem] text-slate-400">
                  <span>L</span>
                  <span>M</span>
                  <span>M</span>
                  <span>G</span>
                  <span>V</span>
                  <span>S</span>
                  <span>D</span>
                </div>
              </div>
            </div>

            {/* AI Coach */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10 md:col-span-2 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm">
                  <Brain className="h-5 w-5" />
                </div>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-amber-700">
                  {t('features.ai.label')}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">
                {t('features.ai.title')}
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-slate-600">
                {t('features.ai.desc')}
              </p>
              <div className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-100 px-3 py-2 text-xs text-slate-700">
                    {t('features.ai.chatUser')}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-gradient-to-r from-teal-600 to-teal-700 px-3 py-2 text-xs text-white">
                    {t('features.ai.chatAI')}
                  </div>
                </div>
              </div>
            </div>

            {/* Periodizzazione */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <CalendarRange className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-slate-900">
                {t('features.period.title')}
              </h3>
              <p className="mb-5 text-xs leading-relaxed text-slate-600">
                {t('features.period.desc')}
              </p>
              <div className="space-y-1.5">
                <div className="flex h-2.5 gap-1">
                  <div className="flex-[3] rounded-full bg-teal-600" />
                  <div className="flex-[2] rounded-full bg-teal-400" />
                  <div className="flex-1 rounded-full bg-amber-400" />
                </div>
                <div className="flex h-2.5 gap-1">
                  <div className="flex-[2] rounded-full bg-slate-200" />
                  <div className="flex-[3] rounded-full bg-teal-500" />
                  <div className="flex-1 rounded-full bg-slate-200" />
                </div>
                <div className="flex justify-between pt-1 text-[0.65rem] text-slate-400">
                  <span>{t('features.period.macro')}</span>
                  <span>{t('features.period.weeks')}</span>
                </div>
              </div>
            </div>

            {/* Gestione atleti */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-slate-900">
                {t('features.athletes.title')}
              </h3>
              <p className="mb-5 text-xs leading-relaxed text-slate-600">
                {t('features.athletes.desc')}
              </p>
              <AvatarStack />
            </div>

            {/* Report */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10 md:col-span-2 lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">
                    {t('features.reports.title')}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {t('features.reports.desc')}
                  </p>
                </div>
                <DocStack />
              </div>
            </div>

            {/* Sicurezza */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10 md:col-span-2 lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">
                    {t('features.security.title')}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {t('features.security.desc')}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1.5">
                  <SecurityBadge
                    tone="emerald"
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label={t('features.security.badge.gdpr')}
                  />
                  <SecurityBadge
                    tone="slate"
                    icon={<ShieldCheck className="h-3 w-3" />}
                    label={t('features.security.badge.iso')}
                  />
                  <SecurityBadge
                    tone="teal"
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label={t('features.security.badge.encrypted')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────── */}
      {SHOW_PRICING && (
      <section
        id="pricing"
        className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white py-24"
      >
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-100/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              {t('pricing.h2')}
            </h2>
            <p className="mx-auto max-w-xl text-slate-600">{t('pricing.sub')}</p>
          </div>

          {/* Billing toggle */}
          <div className="mb-12 flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setBilling('monthly')}
                className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
                  billing === 'monthly'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('pricing.toggle.monthly')}
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`relative rounded-full px-5 py-1.5 text-sm font-semibold transition ${
                  billing === 'yearly'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('pricing.toggle.yearly')}
                <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.55rem] font-bold leading-none text-slate-900 shadow-sm">
                  −11%
                </span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <Sparkles className="h-3 w-3" />
              {t('pricing.toggle.save')}
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const price = billing === 'monthly' ? plan.monthly : plan.yearly;
              const period =
                billing === 'monthly'
                  ? t('pricing.period.month')
                  : t('pricing.period.year');
              const monthlyEquivalent = (plan.yearly / 12).toLocaleString(
                locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'it-IT',
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              );

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded-2xl bg-white p-8 transition ${
                    plan.popular
                      ? 'border-2 border-transparent bg-clip-padding shadow-xl shadow-teal-500/10 [background-image:linear-gradient(white,white),linear-gradient(135deg,#0D9488,#F59E0B)] [background-origin:border-box]'
                      : 'border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-600 to-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                      ★ {t('pricing.popular')}
                    </div>
                  )}

                  <div className="mb-3 inline-flex w-fit items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-amber-500">
                    {plan.slug}
                  </div>
                  <h3 className="mb-1 text-xl font-bold text-slate-900">
                    {t(`plan.${plan.key}.name` as TKey)}
                  </h3>
                  <p className="mb-6 text-sm text-slate-500">
                    {t(`plan.${plan.key}.tagline` as TKey)}
                  </p>

                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold tracking-tight text-slate-900">
                      €{price}
                    </span>
                    <span className="text-slate-500">{period}</span>
                  </div>
                  <div className="mb-6 h-4 text-xs text-slate-400">
                    {billing === 'yearly' &&
                      t('pricing.equivalent').replace(
                        '{price}',
                        `€${monthlyEquivalent}`,
                      )}
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((featKey) => (
                      <li
                        key={featKey}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                            plan.popular ? 'text-teal-600' : 'text-teal-500'
                          }`}
                        />
                        <span>{t(featKey)}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/login"
                    className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                      plan.popular
                        ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-500/25 hover:from-teal-700 hover:to-teal-800'
                        : 'border border-slate-300 text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    {t(`plan.${plan.key}.cta` as TKey)}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ─── CTA ────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900">{t('cta.h2')}</h2>
          <p className="mx-auto mb-8 max-w-xl text-slate-600">{t('cta.sub')}</p>
          <Link
            href="/login"
            className="inline-flex rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-700"
          >
            {t('cta.button')}
          </Link>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" />
            <span className="text-sm font-semibold text-slate-900">TrainMind AI</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-700">
              {t('nav.features')}
            </a>
            {SHOW_PRICING && (
              <a href="#pricing" className="hover:text-slate-700">
                {t('nav.pricing')}
              </a>
            )}
            <a href="mailto:info@trainmind.ai" className="hover:text-slate-700">
              {t('footer.contact')}
            </a>
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} TrainMind AI. {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Language switcher
 * ───────────────────────────────────────────────────────── */
const LOCALE_LABELS: Record<Locale, string> = { it: 'IT', en: 'EN', es: 'ES' };
const LOCALE_NAMES: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
};

function LangSwitcher({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function escHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Select language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <Globe className="h-3.5 w-3.5 text-slate-500" />
        {LOCALE_LABELS[locale]}
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                onChange(l);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs transition hover:bg-slate-50 ${
                locale === l ? 'font-semibold text-teal-700' : 'text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-[0.65rem] text-slate-400">
                  {LOCALE_LABELS[l]}
                </span>
                {LOCALE_NAMES[l]}
              </span>
              {locale === l && <CheckCircle2 className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Hero — dashboard mockup
 * ───────────────────────────────────────────────────────── */
function HeroMockup({ t }: { t: (k: TKey) => string }) {
  return (
    <div className="relative mx-auto max-w-md lg:max-w-none">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-teal-300/30 via-transparent to-amber-200/30 blur-2xl" />

      <div className="relative rotate-1 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 transition duration-500 hover:rotate-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-[0.65rem] font-medium text-slate-400">
            {t('mockup.url')}
          </div>
          <div className="h-2 w-8" />
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            <KpiTile
              icon={<Activity className="h-3.5 w-3.5" />}
              label={t('mockup.kpi.acwr')}
              value="1.42"
              tone="warning"
            />
            <KpiTile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label={t('mockup.kpi.wellness')}
              value="7.8"
              tone="success"
            />
            <KpiTile
              icon={<Users className="h-3.5 w-3.5" />}
              label={t('mockup.kpi.athletes')}
              value="14"
              tone="neutral"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700">
                {t('mockup.chart.title')}
              </div>
              <div className="text-[0.65rem] text-slate-400">
                {t('mockup.chart.range')}
              </div>
            </div>
            <HeroChart />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-50 to-amber-50/40 p-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-teal-500 to-teal-700 text-white">
              <Brain className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-teal-700">
                  {t('mockup.ai.label')}
                </span>
                <Sparkles className="h-3 w-3 text-amber-500" />
              </div>
              <p className="text-xs leading-snug text-slate-700">
                {t('mockup.ai.message')}{' '}
                <strong className="text-slate-900">{t('mockup.ai.messageBold')}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-3 -top-3 hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-900/10 sm:block">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <Activity className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-[0.65rem] uppercase tracking-wider text-slate-400">
              {t('mockup.alert.label')}
            </div>
            <div className="text-xs font-semibold text-slate-900">
              {t('mockup.alert.value')}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-3 hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-900/10 sm:block">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="text-[0.65rem] uppercase tracking-wider text-slate-400">
              {t('mockup.today.label')}
            </div>
            <div className="text-xs font-semibold text-slate-900">
              {t('mockup.today.value')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'warning' | 'success' | 'neutral';
}) {
  const surface = {
    warning: 'border-amber-200 bg-amber-50/60',
    success: 'border-emerald-200 bg-emerald-50/60',
    neutral: 'border-slate-200 bg-white',
  }[tone];
  const accent = {
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    neutral: 'text-slate-500',
  }[tone];
  return (
    <div className={`rounded-lg border ${surface} p-2`}>
      <div className={`mb-1 flex items-center gap-1 ${accent}`}>
        {icon}
        <span className="text-[0.6rem] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-base font-bold text-slate-900">{value}</div>
    </div>
  );
}

function HeroChart() {
  return (
    <svg viewBox="0 0 200 60" className="h-14 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D9488" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="15" x2="200" y2="15" stroke="#E2E8F0" strokeDasharray="2 3" strokeWidth="0.5" />
      <line x1="0" y1="30" x2="200" y2="30" stroke="#E2E8F0" strokeDasharray="2 3" strokeWidth="0.5" />
      <line x1="0" y1="45" x2="200" y2="45" stroke="#E2E8F0" strokeDasharray="2 3" strokeWidth="0.5" />
      <rect x="0" y="8" width="200" height="14" fill="#F59E0B" opacity="0.1" />
      <path
        d="M 0 40 L 28 36 L 56 32 L 84 38 L 112 24 L 140 18 L 168 22 L 200 14"
        fill="none"
        stroke="#0D9488"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 0 40 L 28 36 L 56 32 L 84 38 L 112 24 L 140 18 L 168 22 L 200 14 L 200 60 L 0 60 Z"
        fill="url(#heroChartFill)"
      />
      <circle cx="200" cy="14" r="3" fill="#F59E0B" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Bento helpers
 * ───────────────────────────────────────────────────────── */
function BentoChart() {
  const points: Array<[number, number]> = [
    [0, 55],
    [40, 48],
    [80, 50],
    [120, 38],
    [160, 30],
    [200, 24],
    [240, 18],
    [280, 14],
  ];
  return (
    <svg viewBox="0 0 280 80" className="h-20 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="bentoChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D9488" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="20" x2="280" y2="20" stroke="#E2E8F0" strokeDasharray="2 4" strokeWidth="0.5" />
      <line x1="0" y1="40" x2="280" y2="40" stroke="#E2E8F0" strokeDasharray="2 4" strokeWidth="0.5" />
      <line x1="0" y1="60" x2="280" y2="60" stroke="#E2E8F0" strokeDasharray="2 4" strokeWidth="0.5" />
      <rect x="0" y="10" width="280" height="16" fill="#F59E0B" opacity="0.1" />
      <path
        d="M 0 55 L 40 48 L 80 50 L 120 38 L 160 30 L 200 24 L 240 18 L 280 14"
        fill="none"
        stroke="#0D9488"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 0 55 L 40 48 L 80 50 L 120 38 L 160 30 L 200 24 L 240 18 L 280 14 L 280 80 L 0 80 Z"
        fill="url(#bentoChartFill)"
      />
      {points.map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="2.5"
          fill="white"
          stroke="#0D9488"
          strokeWidth="1.5"
        />
      ))}
      <circle cx="280" cy="14" r="4" fill="#F59E0B" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function AvatarStack() {
  const avatars: Array<{ init: string; from: string; to: string }> = [
    { init: 'PM', from: 'from-teal-400', to: 'to-teal-600' },
    { init: 'GR', from: 'from-amber-400', to: 'to-amber-600' },
    { init: 'LB', from: 'from-slate-500', to: 'to-slate-700' },
    { init: 'AC', from: 'from-emerald-400', to: 'to-emerald-600' },
  ];
  return (
    <div className="flex -space-x-2">
      {avatars.map((a) => (
        <div
          key={a.init}
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${a.from} ${a.to} text-[0.65rem] font-bold text-white ring-2 ring-white`}
        >
          {a.init}
        </div>
      ))}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[0.65rem] font-semibold text-slate-600 ring-2 ring-white">
        +10
      </div>
    </div>
  );
}

function DocStack() {
  return (
    <div className="flex flex-shrink-0 -space-x-3">
      <div className="h-24 w-16 rotate-[-6deg] rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="mb-1 h-1 w-3/4 rounded-full bg-slate-300" />
        <div className="mb-1 h-1 w-full rounded-full bg-slate-200" />
        <div className="mb-1 h-1 w-2/3 rounded-full bg-slate-200" />
        <div className="mb-1 h-1 w-full rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded-sm bg-teal-100" />
      </div>
      <div className="h-24 w-16 rotate-[4deg] rounded-md border border-slate-200 bg-white p-1.5 shadow-md">
        <div className="mb-1 h-1 w-2/3 rounded-full bg-slate-300" />
        <div className="mb-1 h-1 w-full rounded-full bg-slate-200" />
        <div className="mb-1 h-1 w-3/4 rounded-full bg-slate-200" />
        <div className="mb-1 h-1 w-full rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded-sm bg-amber-100" />
      </div>
    </div>
  );
}

function SecurityBadge({
  tone,
  icon,
  label,
}: {
  tone: 'emerald' | 'slate' | 'teal';
  icon: React.ReactNode;
  label: string;
}) {
  const classes = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    teal: 'border-teal-200 bg-teal-50 text-teal-700',
  }[tone];
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.65rem] font-semibold ${classes}`}
    >
      {icon}
      {label}
    </div>
  );
}
