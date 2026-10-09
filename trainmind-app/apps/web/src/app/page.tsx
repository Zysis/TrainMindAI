'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Brain,
  CalendarRange,
  FileText,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { LangSwitcher } from '@/components/i18n/lang-switcher';
import { openCookiePreferences } from '@/components/cookie-banner';
import { useLocaleStore, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/store';
import { useReveal } from '@/hooks/use-reveal';
import { withBasePath } from '@/lib/base-path';
import { useForwardedParams, withForwarded } from '@/lib/attribution';
import '@/styles/landing.css';

/* ═════════════════════════════════════════════════════════
 * FOTO DELL'HERO — slot da riempire
 * ─────────────────────────────────────────────────────────
 * Per mettere la foto:
 *   1. salvala in  apps/web/public/assets/hero/
 *   2. scrivi qui sotto il suo percorso, es:
 *        const HERO_PHOTO = '/assets/hero/hero-basket.jpg';
 *
 * Finche' resta `null` l'hero mostra la trama scura di fondo
 * (linee da campo + alone verde) e non carica nessuna immagine:
 * niente richieste a vuoto, niente icona di immagine rotta.
 *
 * Formato consigliato: 1920×1080 o piu' larga, .webp o .jpg.
 * La foto viene automaticamente virata sul verde di marca dalla
 * classe `.hero-media.tint` in styles/landing.css: funziona bene
 * con scatti a contrasto medio-alto, meglio se non gia' colorati.
 * ═════════════════════════════════════════════════════════ */
/*const HERO_PHOTO: string | null = null;*/
/* hero-fine.jpg = stessa immagine con il retino rigenerato piu' fine
   (125 punti in larghezza invece di ~83) e ridimensionata a 2560px.
   L'originale resta in hero.jpg se serve tornare indietro. */
const HERO_PHOTO: string | null = '/assets/hero/hero-fine.jpg';

/* Tono dell'hero: dipende dalla foto.
 *   'light' → foto chiara: velo bianco a sinistra, testi scuri
 *   'dark'  → foto scura : velo scuro in basso, testi bianchi
 * Cambiando questo valore si ribaltano hero e navbar insieme. */
const HERO_TONE: 'light' | 'dark' = 'light';

/* ─────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────── */
type BillingCycle = 'monthly' | 'yearly';

/**
 * Iniziali di un nome, per gli avatar del pannello hero.
 * "Luca Bianchi"  → LB
 * "Andrew O’Neil" → AO
 * Prende la prima lettera delle prime due parole: cambiando lingua
 * le sigle si aggiornano da sole, senza doverle tenere allineate.
 */
function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/* ─────────────────────────────────────────────────────────
 * Translations (IT / EN / ES)
 * ───────────────────────────────────────────────────────── */
const T = {
  it: {
    'nav.features': 'Funzionalità',
    'nav.pricing': 'Prezzi',
    'nav.login': 'Login',

    'hero.badge': 'Stagione 26/27 · Live per il basket',
    'hero.title.1': 'Allenare di più,',
    'hero.title.2': 'decidere meglio.',
    'hero.subtitle':
      'TrainMind è la piattaforma che usi ogni giorno per pianificare allenamenti, leggere il carico, seguire i tuoi atleti e generare report. Pensata dai preparatori per preparatori atletici del basket.',
    'hero.cta.secondary': 'Vedi la piattaforma',
    'hero.live.title': 'Squadra · Oggi',
    'hero.live.load': 'Distribuzione carico (ACWR)',
    'hero.live.zoneOk': 'ottimale',
    'hero.live.zoneHi': 'alto',
    'hero.live.zoneRk': 'a rischio',
    'hero.live.ai': 'Deload di 2 giorni consigliato per',
    'hero.live.demo': 'DEMO',
    // Atleti d'esempio del pannello. a2 e' quello segnalato in fondo.
    'hero.live.a1': 'Luca Bianchi',
    'hero.live.a2': 'Davide Marino',
    'hero.live.a3': 'Andrea Romano',
    'hero.scroll': 'Scorri',

    'features.pill': 'Piattaforma',
    'features.h2.1': 'Tutto quello che serve al tuo staff,',
    'features.h2.2': 'in un’unica piattaforma.',
    'features.sub':
      'Dalla gestione degli atleti alla periodizzazione, TrainMind copre l’intero workflow della preparazione atletica.',

    'features.analytics.label': 'Analytics',
    'features.analytics.title': 'Load monitoring in tempo reale',
    'features.analytics.desc':
      'sRPE, ACWR, wellness score e grafici interattivi. Alert automatici quando un atleta entra in zona di rischio.',
    'features.analytics.chartTitle': 'ACWR — Squadra',
    'features.analytics.chartRange': 'Ultimi 14 giorni',
    'features.analytics.alerts': '3 alert',
    // Iniziali dei giorni, da lunedi' a domenica
    'features.analytics.days': 'L,M,M,G,V,S,D',

    'features.ai.label': 'Your personal assistant',
    'features.ai.title': 'Un assistente sempre al tuo fianco',
    'features.ai.desc':
      'Suggerimenti su periodizzazione, esercizi e protocolli RTP, basati sui dati reali della tua squadra.',
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
    'band.1': 'ore per il report settimanale, quasi mai spese ad analizzare',
    'band.2': 'lo sguardo del capo allenatore su quel report',
    'band.3': 'posti diversi dove vivono i dati: GPS, test, wellness, presenze',
    'band.4': 'dal primo caricamento al primo report: l’obiettivo di TrainMind',

    'pricing.kick': 'Prezzi',
    'pricing.h2': 'Piani e prezzi',
    'pricing.sub': 'Due offerte: una per lo Strength and Conditioning Coach, una per il club. Prezzi IVA inclusa.',
    'pricing.toggle.monthly': 'Mensile',
    'pricing.toggle.yearly': 'Annuale',
    'pricing.toggle.save': '2 mesi gratis con l’annuale',
    'pricing.toggle.badge': '−17%',
    'pricing.popular': 'Consigliato',
    'pricing.period.month': '/mese',
    'pricing.period.year': '/anno',
    'pricing.equivalent': 'equivalenti a {price}/mese',
    'pricing.individual.title': 'Strength and Conditioning Coach',
    'pricing.individual.sub': 'Per il preparatore atletico che segue una o più squadre.',
    'pricing.club.title': 'Club e società',
    'pricing.club.sub': 'Un piano unico per lo staff di una società.',
    'pricing.trial.title': 'Prova gratuita di 15 giorni',
    'pricing.trial.sub': 'Senza carta e senza addebito automatico. 1 squadra fino a 12 atleti: allenamenti, wellness, infortuni, Analytics e un report giornaliero di prova. Gli altri report e l’AI con i piani a pagamento.',
    'pricing.trial.cta': 'Inizia la prova gratuita',
    'pricing.ext': 'Con Ultra e Club puoi crescere quando serve: squadra aggiuntiva 8 €/mese, 5 atleti in più 2 €/mese, utente aggiuntivo 10 €/mese.',
    'pricing.vat': 'Tutti i prezzi sono IVA inclusa.',

    'plan.starter.name': 'Starter',
    'plan.starter.tagline': 'Per partire con una squadra e le funzioni base.',
    'plan.starter.cta': 'Acquista',
    'plan.starter.feat.1': '1 squadra · 12 atleti',
    'plan.starter.feat.2': '1 utente',
    'plan.starter.feat.3': 'Report base',
    'plan.starter.feat.4': 'Wellness e calendario',

    'plan.pro.name': 'Professional',
    'plan.pro.tagline': 'Funzioni avanzate e AI per due squadre.',
    'plan.pro.cta': 'Acquista',
    'plan.pro.feat.1': '2 squadre · 14 atleti per squadra',
    'plan.pro.feat.2': '1 utente',
    'plan.pro.feat.3': 'Report giornaliero e post-partita',
    'plan.pro.feat.4': 'AI Assistant · 200 crediti al mese',
    'plan.pro.feat.5': 'Analytics',

    'plan.ultra.name': 'Ultra',
    'plan.ultra.tagline': 'Più squadre, più atleti e un collaboratore.',
    'plan.ultra.cta': 'Acquista',
    'plan.ultra.feat.1': '4 squadre · 20 atleti per squadra',
    'plan.ultra.feat.2': 'Fino a 2 utenti',
    'plan.ultra.feat.3': 'Tutto Professional',
    'plan.ultra.feat.4': 'AI Assistant · 500 crediti al mese',
    'plan.ultra.feat.5': 'Squadre, atleti e utenti aggiuntivi',

    'plan.club.name': 'Club',
    'plan.club.tagline': 'Lo staff della società lavora insieme, fino a 6 squadre.',
    'plan.club.cta': 'Acquista',
    'plan.club.feat.1': '6 squadre · 20 atleti per squadra',
    'plan.club.feat.2': 'Fino a 4 utenti dello staff',
    'plan.club.feat.3': 'Report avanzati e Analytics',
    'plan.club.feat.4': 'AI Assistant · 750 crediti al mese',
    'plan.club.feat.5': 'Squadre, atleti e utenti aggiuntivi',

    'cta.h2': 'Pronto a trasformare la tua preparazione atletica?',
    'cta.sub':
      'Unisciti ai preparatori fisici che usano TrainMind per prendere decisioni migliori, più velocemente.',
    'cta.button': 'Prova gratis per 15 giorni',

    'cta.kick': 'Iniziamo',
    'footer.copyright': 'Tutti i diritti riservati.',
    'footer.tagline': 'La piattaforma per preparatori atletici del basket. Pianifica, monitora il carico e tieni tutti i tuoi dati sempre con te.',
    'footer.col.product': 'Prodotto',
    'footer.col.legal': 'Legale',
    'footer.col.contact': 'Contatti',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Termini',
    'footer.cookies': 'Cookie',
    'footer.cookiePrefs': 'Preferenze cookie',
    'footer.madein': 'Fatto in Italia',
  },

  en: {
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.login': 'Login',

    'hero.badge': '26/27 Season · Live for basketball',
    'hero.title.1': 'Train more,',
    'hero.title.2': 'decide better.',
    'hero.subtitle':
      'TrainMind is the platform you use every day to plan sessions, track load, stay on top of your athletes and generate reports. Built by strength and conditioning coaches, for basketball.',
    'hero.cta.secondary': 'See the platform',
    'hero.live.title': 'Team · Today',
    'hero.live.load': 'Load distribution (ACWR)',
    'hero.live.zoneOk': 'optimal',
    'hero.live.zoneHi': 'high',
    'hero.live.zoneRk': 'at risk',
    'hero.live.ai': '2-day deload suggested for',
    'hero.live.demo': 'DEMO',
    // Atleti d'esempio del pannello. a2 e' quello segnalato in fondo.
    'hero.live.a1': 'John Smith',
    'hero.live.a2': 'Ryan Jones',
    'hero.live.a3': 'Andrew O’Neil',
    'hero.scroll': 'Scroll',

    'features.pill': 'Platform',
    'features.h2.1': 'Everything your staff needs,',
    'features.h2.2': 'on a single platform.',
    'features.sub':
      'From athlete management to periodization, TrainMind covers the entire strength and conditioning workflow.',

    'features.analytics.label': 'Analytics',
    'features.analytics.title': 'Real-time load monitoring',
    'features.analytics.desc':
      'sRPE, ACWR, wellness score and interactive charts. Automatic alerts when an athlete enters the risk zone.',
    'features.analytics.chartTitle': 'ACWR — Team',
    'features.analytics.chartRange': 'Last 14 days',
    'features.analytics.alerts': '3 alerts',
    // Iniziali dei giorni, da lunedi' a domenica
    'features.analytics.days': 'M,T,W,T,F,S,S',

    'features.ai.label': 'Your personal assistant',
    'features.ai.title': 'An assistant always by your side',
    'features.ai.desc':
      'Suggestions on periodization, exercises and RTP protocols, based on your team’s real data.',
    'features.ai.chatUser': 'Is Peter still cleared for Tuesday?',
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
    'band.1': 'hours on the weekly report, hardly ever spent analysing it',
    'band.2': 'the head coach’s glance at that report',
    'band.3': 'separate places where the data lives: GPS, tests, wellness, attendance',
    'band.4': 'from first upload to first report: what TrainMind aims for',

    'pricing.kick': 'Pricing',
    'pricing.h2': 'Plans & pricing',
    'pricing.sub': 'Two offers: one for the Strength and Conditioning Coach, one for the club. Prices include VAT.',
    'pricing.toggle.monthly': 'Monthly',
    'pricing.toggle.yearly': 'Yearly',
    'pricing.toggle.save': '2 months free with yearly billing',
    'pricing.toggle.badge': '−17%',
    'pricing.popular': 'Recommended',
    'pricing.period.month': '/month',
    'pricing.period.year': '/year',
    'pricing.equivalent': 'equivalent to {price}/month',
    'pricing.individual.title': 'Strength and Conditioning Coach',
    'pricing.individual.sub': 'For the S&C coach working with one or more teams.',
    'pricing.club.title': 'Clubs',
    'pricing.club.sub': 'A single plan for a club’s staff.',
    'pricing.trial.title': '15-day free trial',
    'pricing.trial.sub': 'No card, no automatic charge. 1 team of up to 12 athletes: training, wellness, injuries, Analytics and one trial daily report. Other reports and AI come with the paid plans.',
    'pricing.trial.cta': 'Start the free trial',
    'pricing.ext': 'With Ultra and Club you grow when you need to: extra team €8/month, 5 more athletes €2/month, extra user €10/month.',
    'pricing.vat': 'All prices include VAT.',

    'plan.starter.name': 'Starter',
    'plan.starter.tagline': 'Get started with one team and the core features.',
    'plan.starter.cta': 'Buy',
    'plan.starter.feat.1': '1 team · 12 athletes',
    'plan.starter.feat.2': '1 user',
    'plan.starter.feat.3': 'Basic reports',
    'plan.starter.feat.4': 'Wellness and calendar',

    'plan.pro.name': 'Professional',
    'plan.pro.tagline': 'Advanced features and AI for two teams.',
    'plan.pro.cta': 'Buy',
    'plan.pro.feat.1': '2 teams · 14 athletes per team',
    'plan.pro.feat.2': '1 user',
    'plan.pro.feat.3': 'Daily and post-game reports',
    'plan.pro.feat.4': 'AI Assistant · 200 credits a month',
    'plan.pro.feat.5': 'Analytics',

    'plan.ultra.name': 'Ultra',
    'plan.ultra.tagline': 'More teams, more athletes and a colleague.',
    'plan.ultra.cta': 'Buy',
    'plan.ultra.feat.1': '4 teams · 20 athletes per team',
    'plan.ultra.feat.2': 'Up to 2 users',
    'plan.ultra.feat.3': 'Everything in Professional',
    'plan.ultra.feat.4': 'AI Assistant · 500 credits a month',
    'plan.ultra.feat.5': 'Extra teams, athletes and users',

    'plan.club.name': 'Club',
    'plan.club.tagline': 'The club’s staff working together, up to 6 teams.',
    'plan.club.cta': 'Buy',
    'plan.club.feat.1': '6 teams · 20 athletes per team',
    'plan.club.feat.2': 'Up to 4 staff users',
    'plan.club.feat.3': 'Advanced reports and Analytics',
    'plan.club.feat.4': 'AI Assistant · 750 credits a month',
    'plan.club.feat.5': 'Extra teams, athletes and users',

    'cta.h2': 'Ready to transform your strength and conditioning?',
    'cta.sub':
      'Join the strength coaches who use TrainMind to make better decisions, faster.',
    'cta.button': 'Try it free for 15 days',

    'cta.kick': 'Get started',
    'footer.copyright': 'All rights reserved.',
    'footer.tagline': 'The platform for basketball strength and conditioning coaches. Plan sessions, monitor load and keep all your data with you.',
    'footer.col.product': 'Product',
    'footer.col.legal': 'Legal',
    'footer.col.contact': 'Contact',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.cookies': 'Cookies',
    'footer.cookiePrefs': 'Cookie preferences',
    'footer.madein': 'Made in Italy',
  },

  es: {
    'nav.features': 'Funcionalidades',
    'nav.pricing': 'Precios',
    'nav.login': 'Login',

    'hero.badge': 'Temporada 26/27 · Ya disponible para el baloncesto',
    'hero.title.1': 'Entrenar más,',
    'hero.title.2': 'decidir mejor.',
    'hero.subtitle':
      'TrainMind es la plataforma que usas cada día para planificar entrenamientos, leer la carga, seguir a tus atletas y generar informes. Pensada por preparadores para preparadores físicos de baloncesto.',
    'hero.cta.secondary': 'Ver la plataforma',
    'hero.live.title': 'Equipo · Hoy',
    'hero.live.load': 'Distribución de carga (ACWR)',
    'hero.live.zoneOk': 'óptimo',
    'hero.live.zoneHi': 'alto',
    'hero.live.zoneRk': 'en riesgo',
    'hero.live.ai': 'Descarga de 2 días sugerida para',
    'hero.live.demo': 'DEMO',
    // Atleti d'esempio del pannello. a2 e' quello segnalato in fondo.
    'hero.live.a1': 'Lucas Rodríguez',
    'hero.live.a2': 'Adrià Martínez',
    'hero.live.a3': 'Jaime Villa',
    'hero.scroll': 'Desplázate',

    'features.pill': 'Plataforma',
    'features.h2.1': 'Todo lo que tu staff necesita,',
    'features.h2.2': 'en una única plataforma.',
    'features.sub':
      'Desde la gestión de atletas hasta la periodización, TrainMind cubre todo el flujo de la preparación física.',

    'features.analytics.label': 'Analytics',
    'features.analytics.title': 'Monitorización de carga en tiempo real',
    'features.analytics.desc':
      'sRPE, ACWR, wellness score y gráficos interactivos. Alertas automáticas cuando un atleta entra en zona de riesgo.',
    'features.analytics.chartTitle': 'ACWR — Equipo',
    'features.analytics.chartRange': 'Últimos 14 días',
    'features.analytics.alerts': '3 alertas',
    // Iniziali dei giorni, da lunedi' a domenica
    'features.analytics.days': 'L,M,M,J,V,S,D',

    'features.ai.label': 'Your personal assistant',
    'features.ai.title': 'Un asistente siempre a tu lado',
    'features.ai.desc':
      'Sugerencias de periodización, ejercicios y protocolos RTP, basados en los datos reales de tu equipo.',
    'features.ai.chatUser': '¿Pedro sigue apto para el martes?',
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
    'band.1': 'horas para el informe semanal, casi nunca dedicadas a analizarlo',
    'band.2': 'la mirada del primer entrenador a ese informe',
    'band.3': 'sitios distintos donde viven los datos: GPS, tests, wellness, asistencia',
    'band.4': 'de la primera subida al primer informe: el objetivo de TrainMind',

    'pricing.kick': 'Precios',
    'pricing.h2': 'Planes y precios',
    'pricing.sub': 'Dos ofertas: una para el Strength and Conditioning Coach y otra para el club. Precios con IVA incluido.',
    'pricing.toggle.monthly': 'Mensual',
    'pricing.toggle.yearly': 'Anual',
    'pricing.toggle.save': '2 meses gratis con el plan anual',
    'pricing.toggle.badge': '−17%',
    'pricing.popular': 'Recomendado',
    'pricing.period.month': '/mes',
    'pricing.period.year': '/año',
    'pricing.equivalent': 'equivalente a {price}/mes',
    'pricing.individual.title': 'Strength and Conditioning Coach',
    'pricing.individual.sub': 'Para el preparador físico que trabaja con uno o más equipos.',
    'pricing.club.title': 'Clubes',
    'pricing.club.sub': 'Un plan único para el staff de un club.',
    'pricing.trial.title': 'Prueba gratuita de 15 días',
    'pricing.trial.sub': 'Sin tarjeta y sin cargo automático. 1 equipo de hasta 12 atletas: entrenamientos, wellness, lesiones, Analytics y un informe diario de prueba. Los demás informes y la IA con los planes de pago.',
    'pricing.trial.cta': 'Empezar la prueba gratuita',
    'pricing.ext': 'Con Ultra y Club creces cuando lo necesitas: equipo adicional 8 €/mes, 5 atletas más 2 €/mes, usuario adicional 10 €/mes.',
    'pricing.vat': 'Todos los precios incluyen IVA.',

    'plan.starter.name': 'Starter',
    'plan.starter.tagline': 'Para empezar con un equipo y las funciones básicas.',
    'plan.starter.cta': 'Comprar',
    'plan.starter.feat.1': '1 equipo · 12 atletas',
    'plan.starter.feat.2': '1 usuario',
    'plan.starter.feat.3': 'Informes básicos',
    'plan.starter.feat.4': 'Wellness y calendario',

    'plan.pro.name': 'Professional',
    'plan.pro.tagline': 'Funciones avanzadas e IA para dos equipos.',
    'plan.pro.cta': 'Comprar',
    'plan.pro.feat.1': '2 equipos · 14 atletas por equipo',
    'plan.pro.feat.2': '1 usuario',
    'plan.pro.feat.3': 'Informe diario y post-partido',
    'plan.pro.feat.4': 'AI Assistant · 200 créditos al mes',
    'plan.pro.feat.5': 'Analytics',

    'plan.ultra.name': 'Ultra',
    'plan.ultra.tagline': 'Más equipos, más atletas y un colaborador.',
    'plan.ultra.cta': 'Comprar',
    'plan.ultra.feat.1': '4 equipos · 20 atletas por equipo',
    'plan.ultra.feat.2': 'Hasta 2 usuarios',
    'plan.ultra.feat.3': 'Todo Professional',
    'plan.ultra.feat.4': 'AI Assistant · 500 créditos al mes',
    'plan.ultra.feat.5': 'Equipos, atletas y usuarios adicionales',

    'plan.club.name': 'Club',
    'plan.club.tagline': 'El staff del club trabaja unido, hasta 6 equipos.',
    'plan.club.cta': 'Comprar',
    'plan.club.feat.1': '6 equipos · 20 atletas por equipo',
    'plan.club.feat.2': 'Hasta 4 usuarios del staff',
    'plan.club.feat.3': 'Informes avanzados y Analytics',
    'plan.club.feat.4': 'AI Assistant · 750 créditos al mes',
    'plan.club.feat.5': 'Equipos, atletas y usuarios adicionales',

    'cta.h2': '¿Listo para transformar tu preparación física?',
    'cta.sub':
      'Únete a los preparadores físicos que usan TrainMind para tomar mejores decisiones, más rápido.',
    'cta.button': 'Pruébalo gratis 15 días',

    'cta.kick': 'Empecemos',
    'footer.copyright': 'Todos los derechos reservados.',
    'footer.tagline': 'La plataforma para preparadores físicos de baloncesto. Planifica, monitoriza la carga y ten todos tus datos siempre contigo.',
    'footer.col.product': 'Producto',
    'footer.col.legal': 'Legal',
    'footer.col.contact': 'Contacto',
    'footer.privacy': 'Privacidad',
    'footer.terms': 'Términos',
    'footer.cookies': 'Cookies',
    'footer.cookiePrefs': 'Preferencias de cookies',
    'footer.madein': 'Hecho en Italia',
  },
} as const;

type TKey = keyof (typeof T)['it'];

/* ─────────────────────────────────────────────────────────
 * Pricing data
 * ───────────────────────────────────────────────────────── */
type Plan = {
  /** Chiave usata nelle traduzioni ('pro' abbrevia 'professional'). */
  key: 'starter' | 'pro' | 'ultra' | 'club';
  /** Valore accettato dall'API, passato a /register come ?plan= */
  planId: 'starter' | 'professional' | 'ultra' | 'club';
  /** Slug brand mostrato anche come badge in alto a destra dell'app. */
  slug: 'START' | 'PRO' | 'ULTRA' | 'CLUB';
  monthly: number;
  yearly: number;
  features: TKey[];
  popular: boolean;
};

/*
 * Listino dal 9/10/2026, IVA inclusa: l'annuale vale dieci mensilita'.
 * La fonte e' apps/api/src/lib/plans.ts (e la strategia commerciale v3):
 * se cambia un prezzo li', va cambiato anche qui e nella registrazione.
 */
const PLANS: Plan[] = [
  {
    key: 'starter',
    planId: 'starter',
    slug: 'START',
    monthly: 15,
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
    planId: 'professional',
    slug: 'PRO',
    monthly: 30,
    yearly: 300,
    features: [
      'plan.pro.feat.1',
      'plan.pro.feat.2',
      'plan.pro.feat.3',
      'plan.pro.feat.4',
      'plan.pro.feat.5',
    ],
    popular: false,
  },
  {
    key: 'ultra',
    planId: 'ultra',
    slug: 'ULTRA',
    monthly: 35,
    yearly: 350,
    features: [
      'plan.ultra.feat.1',
      'plan.ultra.feat.2',
      'plan.ultra.feat.3',
      'plan.ultra.feat.4',
      'plan.ultra.feat.5',
    ],
    // Il piano da spingere nell'offerta Individuale.
    popular: true,
  },
];

/** Offerta Club: piano unico, mostrato a tutta larghezza sotto i tre. */
const CLUB_PLAN: Plan = {
  key: 'club',
  planId: 'club',
  slug: 'CLUB',
  monthly: 50,
  yearly: 500,
  features: [
    'plan.club.feat.1',
    'plan.club.feat.2',
    'plan.club.feat.3',
    'plan.club.feat.4',
    'plan.club.feat.5',
  ],
  popular: false,
};

/* ─────────────────────────────────────────────────────────
 * Main page
 * ───────────────────────────────────────────────────────── */
// Flag per mostrare/nascondere la sezione prezzi in landing e i link "Prezzi" nel menu.
// Cambiare a true quando i piani commerciali saranno pubblici.
const SHOW_PRICING = true;

export default function LandingPage() {
  // La lingua vive nello store globale (localStorage + profilo utente):
  // cosi resta impostata anche navigando verso /login o /register.
  const storeLocale = useLocaleStore((s) => s.locale);
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [mounted, setMounted] = useState(false);

  // In SSR non possiamo leggere localStorage: renderizziamo nella lingua di
  // default e passiamo a quella reale al primo mount, evitando errori di
  // idratazione.
  useEffect(() => setMounted(true), []);
  const locale: Locale = mounted ? storeLocale : DEFAULT_LOCALE;

  // Comparsa progressiva degli elementi `.rv` allo scroll (stile LAB21)
  useReveal();

  // Parametri di campagna (e token del cancello) arrivati dal sito vetrina:
  // vanno riattaccati ai link verso la registrazione, altrimenti si perdono
  // qui e ogni iscritto risulterebbe arrivato da nessuna parte.
  const forwarded = useForwardedParams();

  // La navbar e' trasparente sopra l'hero scuro e diventa bianca appena
  // si scrolla, altrimenti il testo bianco finirebbe su fondo chiaro.
  const [navSolid, setNavSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const t = (key: TKey): string => T[locale][key] ?? T.it[key];

  /** Card di un piano: la stessa per l'offerta Individuale e per il Club. */
  const renderPlanCard = (plan: Plan, i: number, extraClass = '') => {
    const price = billing === 'monthly' ? plan.monthly : plan.yearly;
    const period =
      billing === 'monthly' ? t('pricing.period.month') : t('pricing.period.year');
    const monthlyEquivalent = (plan.yearly / 12).toLocaleString(
      locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'it-IT',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );

    return (
      <article
        key={plan.key}
        className={`pc rv${plan.popular ? ' hot' : ''}${i === 1 ? ' d1' : i === 2 ? ' d2' : ''}${extraClass}`}
      >
        {plan.popular && <span className="pc-flag">{t('pricing.popular')}</span>}

        <div className="pc-head">
          <div className="mb-4 flex items-center gap-3">
            <h3 className="!mb-0">{t(`plan.${plan.key}.name` as TKey)}</h3>
            <span className="plan-tag">{plan.slug}</span>
          </div>

          <p className="tagline">{t(`plan.${plan.key}.tagline` as TKey)}</p>

          <div className="pc-price">
            <span className="pc-cur">€</span>
            {price}
            <span className="pc-per">{period}</span>
          </div>
          <div className="pc-eq mono">
            {billing === 'yearly' &&
              t('pricing.equivalent').replace('{price}', `€${monthlyEquivalent}`)}
          </div>
        </div>

        <ul className="pc-feats">
          {plan.features.map((featKey) => (
            <li key={featKey}>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8.5l3.2 3.2L13 5" />
              </svg>
              <span>{t(featKey)}</span>
            </li>
          ))}
        </ul>

        {/* Percorso relativo, non l'URL assoluto di sviluppo: cosi' funziona
            anche in produzione sul dominio vero. Il piano viaggia nell'URL e
            arriva preselezionato nel modulo di registrazione, dove resta
            modificabile (anche verso la prova gratuita). */}
        <Link
          href={withForwarded(`/register?plan=${plan.planId}`, forwarded)}
          className={`btn${plan.popular ? '' : ' btn-o'}`}
        >
          {t(`plan.${plan.key}.cta` as TKey)}
        </Link>
      </article>
    );
  };

  return (
    // `lp` attiva il design system LAB21 definito in styles/landing.css.
    // Sta solo qui: la dashboard resta sul tema teal/slate.
    <div className="lp min-h-screen bg-white">
      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav
        className={`nav${navSolid ? ' solid' : ''}${
          HERO_TONE === 'light' && !navSolid ? ' over-light' : ''
        }`}
      >
        <div className="nav-in">
          <Link href="/" className="brand" aria-label="TrainMind by LAB21">
            <BrandLogo
              tone={HERO_TONE === 'light' || navSolid ? 'light' : 'dark'}
              className="h-9 w-9"
            />
            <span className="wordmark">
              Train<em>Mind</em>
            </span>
            <span className="brand-by">by</span>
            {/* Logo societa'. Due varianti: scura sui fondi chiari,
                chiara quando la barra e' trasparente su hero scuro. */}
            <img
              className="brand-lab21"
              src={withBasePath(
                HERO_TONE === 'light' || navSolid
                  ? '/assets/brand/lab21-wordmark.png'
                  : '/assets/brand/lab21-wordmark-light.png',
              )}
              alt="LAB21"
              width={960}
              height={242}
            />
          </Link>

          <div className="ml-auto hidden items-center gap-1 md:flex">
            <a href="#features" className="nav-link">
              {t('nav.features')}
            </a>
            <a href="#pricing" className="nav-link">
              {t('nav.pricing')}
            </a>
          </div>

          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <LangSwitcher />
            {/* Anche il percorso landing → accedi → registrati deve conservare
                i parametri: e' il giro che fa chi ha gia' un account in mente
                e poi cambia idea, ed e' il piu' facile da dimenticare. */}
            <Link href={withForwarded('/login', forwarded)} className="btn btn-o">
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section
        className={`hero${HERO_TONE === 'light' ? ' on-light' : ''}`}
        id="top"
      >
        {/* Slot foto — vedi HERO_PHOTO in cima al file.
            Finche' il file non esiste il <img> non viene montato e
            resta la trama di fondo: nessuna immagine rotta. */}
        <div className="hero-media tint">
          <div className="hero-fallback" aria-hidden="true" />
          {HERO_PHOTO && (
            /* withBasePath: e' un <img> normale, non next/image, quindi il
               sottopercorso dell'app non viene aggiunto in automatico. */
            <img src={withBasePath(HERO_PHOTO)} alt="" fetchPriority="high" />
          )}
        </div>

        <div className="hero-in inner">
          <div className="hero-flex">
            <div className="hero-copy">
              <div className="pill mono rv">
                <i />
                <span>{t('hero.badge')}</span>
              </div>

              <h1 className="rv d1">
                {t('hero.title.1')}
                <br />
                <em>{t('hero.title.2')}</em>
              </h1>

              <p className="rv d2">{t('hero.subtitle')}</p>

              <div className="hcta rv d3">
                <a href="#features" className="btn btn-lg">
                  {t('hero.cta.secondary')}
                  <Zap className="h-4 w-4" />
                </a>
              </div>

            </div>

            {/* Pannello di sintesi — valori dimostrativi, non una
                connessione reale. Mostra cosa fa il prodotto: leggere
                lo stato della squadra a colpo d'occhio. */}
            <div className="live rv d4">
              <div className="live-h">
                <b>{t('hero.live.title')}</b>
                <span className="chip-live">
                  <i />
                  {t('hero.live.demo')}
                </span>
              </div>

              {/* Distribuzione del carico: la larghezza dei segmenti
                  e' la proporzione degli atleti in ciascuna zona. */}
              <span className="live-label mono">{t('hero.live.load')}</span>
              <div className="zones" role="img" aria-label={t('hero.live.load')}>
                <i className="z-ok" />
                <i className="z-hi" />
                <i className="z-rk" />
              </div>
              <div className="zones-legend mono">
                <span>
                  <i style={{ background: 'var(--acc)' }} />9 {t('hero.live.zoneOk')}
                </span>
                <span>
                  <i style={{ background: 'rgba(0,201,167,.42)' }} />3 {t('hero.live.zoneHi')}
                </span>
                <span>
                  <i style={{ background: 'var(--amber)' }} />2 {t('hero.live.zoneRk')}
                </span>
              </div>

              <div className="live-athletes">
                {[
                  { key: 'hero.live.a1' as TKey, val: '0.94', dot: 'dot-ok' },
                  { key: 'hero.live.a2' as TKey, val: '1.42', dot: 'dot-rk' },
                  { key: 'hero.live.a3' as TKey, val: '1.08', dot: 'dot-hi' },
                ].map((a) => {
                  const name = t(a.key);
                  return (
                    <div className="ath" key={a.key}>
                      {/* Le iniziali si ricavano dal nome: cambiando lingua
                          si aggiornano da sole, senza doverle riallineare. */}
                      <span className="ath-av">{initials(name)}</span>
                      <span className="ath-name">{name}</span>
                      <span className="ath-val">{a.val}</span>
                      <span className={`ath-dot ${a.dot}`} />
                    </div>
                  );
                })}
              </div>

              <div className="live-ai">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {t('hero.live.ai')} <b>{t('hero.live.a2')}</b>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-hint">
          <span />
          <small className="mono">{t('hero.scroll')}</small>
        </div>
      </section>

      {/* ─── Features (Bento) ───────────────────────────── */}
      <section id="features" className="sec">
        <div className="inner">
          {/* `piena` toglie la seconda colonna: il titolo prende tutta
              la larghezza della sezione e il sottotitolo va sotto. */}
          <div className="sh piena">
            <div>
              <div className="kick mono rv">{t('features.pill')}</div>
              <h2 className="rv d1">
                {t('features.h2.1')}{' '}
                <em className="not-italic text-[var(--acc-d)]">
                  {t('features.h2.2')}
                </em>
              </h2>
              <p className="mt-7 max-w-3xl rv d2">{t('features.sub')}</p>
            </div>
          </div>

          <div className="bento">
            {/* Analytics — card alta */}
            <article className="bc a-ana rv">
              <div className="bc-head">
                <span className="bc-ico">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <span className="mono">{t('features.analytics.label')}</span>
              </div>
              <h3>{t('features.analytics.title')}</h3>
              <p>{t('features.analytics.desc')}</p>

              <div className="bc-demo">
                <div className="bc-panel">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium text-[var(--txt)]">
                        {t('features.analytics.chartTitle')}
                      </div>
                      <div className="mono mt-1 text-[var(--txt-2)]">
                        {t('features.analytics.chartRange')}
                      </div>
                    </div>
                    <span className="plan-tag">{t('features.analytics.alerts')}</span>
                  </div>
                  <BentoChart />
                  <div className="mono mt-2 flex justify-between text-[var(--txt-2)]">
                    {t('features.analytics.days')
                      .split(',')
                      .map((d, i) => (
                        // Le iniziali si ripetono (in inglese due T e due S):
                        // la chiave e' l'indice, non la lettera.
                        <span key={i}>{d}</span>
                      ))}
                  </div>
                </div>
              </div>
            </article>

            {/* AI Coach */}
            <article className="bc a-ai rv d4">
              <div className="bc-head">
                <span className="bc-ico">
                  <Brain className="h-5 w-5" />
                </span>
                <span className="mono">{t('features.ai.label')}</span>
              </div>
              <h3>{t('features.ai.title')}</h3>
              <p>{t('features.ai.desc')}</p>

              <div className="bc-demo flex flex-col gap-2">
                <div className="chat-u">{t('features.ai.chatUser')}</div>
                <div className="chat-a">{t('features.ai.chatAI')}</div>
              </div>
            </article>

            {/* Periodizzazione */}
            <article className="bc a-per rv d1">
              <div className="bc-head">
                <span className="bc-ico">
                  <CalendarRange className="h-5 w-5" />
                </span>
              </div>
              <h3>{t('features.period.title')}</h3>
              <p>{t('features.period.desc')}</p>

              <div className="bc-demo space-y-2">
                <div className="bars-row">
                  <i className="flex-[3] bg-[var(--acc)]" />
                  <i className="flex-[2] bg-[var(--acc)]/55" />
                  <i className="flex-1 bg-[var(--paper-3)]" />
                </div>
                <div className="bars-row">
                  <i className="flex-[2] bg-[var(--paper-3)]" />
                  <i className="flex-[3] bg-[var(--acc)]/75" />
                  <i className="flex-1 bg-[var(--paper-3)]" />
                </div>
                <div className="mono flex justify-between pt-1 text-[var(--txt-2)]">
                  <span>{t('features.period.macro')}</span>
                  <span>{t('features.period.weeks')}</span>
                </div>
              </div>
            </article>

            {/* Gestione atleti */}
            <article className="bc a-ath rv d2">
              <div className="bc-head">
                <span className="bc-ico">
                  <Users className="h-5 w-5" />
                </span>
              </div>
              <h3>{t('features.athletes.title')}</h3>
              <p>{t('features.athletes.desc')}</p>
              <div className="bc-demo">
                <AvatarStack />
              </div>
            </article>

            {/* Report automatici */}
            <article className="bc a-rep rv d3">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="bc-head">
                    <span className="bc-ico">
                      <FileText className="h-5 w-5" />
                    </span>
                  </div>
                  <h3>{t('features.reports.title')}</h3>
                  <p>{t('features.reports.desc')}</p>
                </div>
                <DocStack />
              </div>
            </article>

            {/* Sicurezza e GDPR */}
            <article className="bc a-sec rv d3">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="bc-head">
                    <span className="bc-ico">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                  </div>
                  <h3>{t('features.security.title')}</h3>
                  <p>{t('features.security.desc')}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-2">
                  <SecurityBadge label={t('features.security.badge.gdpr')} />
                  <SecurityBadge label={t('features.security.badge.iso')} />
                  <SecurityBadge label={t('features.security.badge.encrypted')} />
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─── Fascia numeri ──────────────────────────────── */}
      <section className="band">
        <div className="band-in inner">
          {[
            // I suffissi sono unita' di misura: " secondi, ' minuti.
            // ATTENZIONE alla `key` qui sotto: deve essere un id stabile, MAI
            // il testo tradotto. Con la lingua come key, il cambio di locale
            // dopo l'hydration cambiava le key, React ricreava questi nodi e
            // l'IntersectionObserver di useReveal restava agganciato a quelli
            // vecchi: i nuovi non venivano mai rivelati e la fascia spariva.
            { id: 'b1', n: '3', suf: '', lbl: t('band.1') },
            { id: 'b2', n: '40', suf: '”', lbl: t('band.2') },
            { id: 'b3', n: '4', suf: '', lbl: t('band.3') },
            { id: 'b4', n: '10', suf: '’', lbl: t('band.4') },
          ].map((s) => (
            <div className="st rv" key={s.id}>
              <div className="num">
                {s.n}
                {s.suf && <em className="suf">{s.suf}</em>}
              </div>
              <span className="lbl">{s.lbl}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="sec dark">
        <div className="inner">
          <div className="sh piena max-w-3xl">
            <div>
              <div className="kick mono rv">{t('pricing.kick')}</div>
              <h2 className="rv d1">{t('pricing.h2')}</h2>
              <p className="mt-6 rv d2">{t('pricing.sub')}</p>
            </div>
          </div>

          {/* Interruttore mensile / annuale */}
          <div className="bt-wrap rv d2">
            <div className="bt">
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className={billing === 'monthly' ? 'on' : undefined}
              >
                {t('pricing.toggle.monthly')}
              </button>
              <button
                type="button"
                onClick={() => setBilling('yearly')}
                className={billing === 'yearly' ? 'on' : undefined}
              >
                {t('pricing.toggle.yearly')}
                <span className="save">{t('pricing.toggle.badge')}</span>
              </button>
            </div>
            <div className="bt-note mono">
              <Sparkles className="h-3.5 w-3.5" />
              {t('pricing.toggle.save')}
            </div>
          </div>

          {/* Prova gratuita: una strada separata dai piani, per entrambe le offerte. */}
          <div className="trial-strip rv">
            <div>
              <h3>{t('pricing.trial.title')}</h3>
              <p>{t('pricing.trial.sub')}</p>
            </div>
            <Link href={withForwarded('/register?plan=trial', forwarded)} className="btn">
              {t('pricing.trial.cta')}
            </Link>
          </div>

          {/* Offerta Individuale */}
          <div className="offer-h rv">
            <h3>{t('pricing.individual.title')}</h3>
            <p>{t('pricing.individual.sub')}</p>
          </div>
          <div className="pgrid">{PLANS.map((plan, i) => renderPlanCard(plan, i))}</div>

          {/* Offerta Club: piano unico */}
          <div className="offer-h rv">
            <h3>{t('pricing.club.title')}</h3>
            <p>{t('pricing.club.sub')}</p>
          </div>
          <div className="pgrid-club">{renderPlanCard(CLUB_PLAN, 0, ' pc-club')}</div>

          <p className="pricing-note mono rv">
            {t('pricing.ext')} {t('pricing.vat')}
          </p>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────── */}
      <section className="sec">
        <div className="inner">
          <div className="cta-box">
            <div className="kick mono rv justify-center">{t('cta.kick')}</div>
            <h2 className="rv d1">{t('cta.h2')}</h2>
            <p className="rv d2">{t('cta.sub')}</p>
            <div className="rv d3">
              <Link href={withForwarded('/register', forwarded)} className="btn btn-lg">
                {t('cta.button')}
                <Zap className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer>
        <div className="inner">
          <div className="f-top">
            <div>
              <div className="f-brand">
                <BrandLogo tone="dark" className="h-8 w-8" />
                <span className="wordmark">
                  Train<em>Mind</em>
                </span>
                <span className="brand-by">by</span>
                {/* Footer su fondo scuro: serve la variante chiara del logo */}
                <img
                  className="brand-lab21"
                  src={withBasePath('/assets/brand/lab21-wordmark-light.png')}
                  alt="LAB21"
                  width={960}
                  height={242}
                />
              </div>
              <p className="f-tag">{t('footer.tagline')}</p>
            </div>

            <div className="f-links">
              <div>
                <h5>{t('footer.col.product')}</h5>
                <a href="#features">{t('nav.features')}</a>
                {SHOW_PRICING && <a href="#pricing">{t('nav.pricing')}</a>}
                <Link href={withForwarded('/login', forwarded)}>{t('nav.login')}</Link>
              </div>
              <div>
                <h5>{t('footer.col.legal')}</h5>
                <Link href="/privacy">{t('footer.privacy')}</Link>
                <Link href="/terms">{t('footer.terms')}</Link>
                <Link href="/cookies">{t('footer.cookies')}</Link>
                {/* Riapre il pannello di consenso: le Linee guida del Garante
                    chiedono che la scelta sui cookie sia sempre revocabile. */}
                <button type="button" onClick={openCookiePreferences} className="f-linkbtn">
                  {t('footer.cookiePrefs')}
                </button>
              </div>
              <div>
                <h5>{t('footer.col.contact')}</h5>
                <a href="mailto:info@trainmind.ai">info@trainmind.ai</a>
              </div>
            </div>
          </div>

          <div className="f-bot">
            <span>
              &copy; {new Date().getFullYear()} TrainMind. {t('footer.copyright')}
            </span>
            <span className="mono">{t('footer.madein')}</span>
          </div>
        </div>
      </footer>
    </div>
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
          <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00C9A7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="20" x2="280" y2="20" stroke="#E2E9E7" strokeDasharray="2 4" strokeWidth="0.5" />
      <line x1="0" y1="40" x2="280" y2="40" stroke="#E2E9E7" strokeDasharray="2 4" strokeWidth="0.5" />
      <line x1="0" y1="60" x2="280" y2="60" stroke="#E2E9E7" strokeDasharray="2 4" strokeWidth="0.5" />
      <rect x="0" y="10" width="280" height="16" fill="#F59E0B" opacity="0.1" />
      <path
        d="M 0 55 L 40 48 L 80 50 L 120 38 L 160 30 L 200 24 L 240 18 L 280 14"
        fill="none"
        stroke="#00C9A7"
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
          stroke="#00C9A7"
          strokeWidth="1.5"
        />
      ))}
      <circle cx="280" cy="14" r="4" fill="#F59E0B" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function AvatarStack() {
  const avatars: Array<{ init: string; bg: string }> = [
    { init: 'PM', bg: '#00C9A7' },
    { init: 'GR', bg: '#00A489' },
    { init: 'LB', bg: '#0E1A18' },
    { init: 'AC', bg: '#5A6B67' },
  ];
  return (
    <div className="flex -space-x-2">
      {avatars.map((a) => (
        <div
          key={a.init}
          style={{ backgroundColor: a.bg }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ring-2 ring-white" 
        >
          {a.init}
        </div>
      ))}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--paper-3)] text-[0.65rem] font-semibold text-[var(--txt-2)] ring-2 ring-white">
        +10
      </div>
    </div>
  );
}

function DocStack() {
  return (
    <div className="flex flex-shrink-0 -space-x-3">
      <div className="h-24 w-16 rotate-[-6deg] rounded-md border border-[var(--line)] bg-white p-1.5 shadow-sm">
        <div className="mb-1 h-1 w-3/4 rounded-full bg-[var(--paper-3)]" />
        <div className="mb-1 h-1 w-full rounded-full bg-[var(--paper-2)]" />
        <div className="mb-1 h-1 w-2/3 rounded-full bg-[var(--paper-2)]" />
        <div className="mb-1 h-1 w-full rounded-full bg-[var(--paper-2)]" />
        <div className="h-4 w-full rounded-sm bg-[var(--acc)]/25" />
      </div>
      <div className="h-24 w-16 rotate-[4deg] rounded-md border border-[var(--line)] bg-white p-1.5 shadow-md">
        <div className="mb-1 h-1 w-2/3 rounded-full bg-[var(--paper-3)]" />
        <div className="mb-1 h-1 w-full rounded-full bg-[var(--paper-2)]" />
        <div className="mb-1 h-1 w-3/4 rounded-full bg-[var(--paper-2)]" />
        <div className="mb-1 h-1 w-full rounded-full bg-[var(--paper-2)]" />
        <div className="h-4 w-full rounded-sm bg-[var(--acc)]/12" />
      </div>
    </div>
  );
}

/** Etichetta di conformita' (GDPR, ISO, cifratura) in stile LAB21:
 *  monospace, bordo sottile, spunta verde. Nessuna variante di colore:
 *  sono tutte allo stesso livello, non c'e' gerarchia da esprimere. */
function SecurityBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper-2)] px-3 py-2">
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 flex-none text-[var(--acc-d)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 8.5l3.2 3.2L13 5" />
      </svg>
      <span className="mono text-[var(--txt)]">{label}</span>
    </div>
  );
}
