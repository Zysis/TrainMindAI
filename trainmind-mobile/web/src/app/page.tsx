import Link from 'next/link';

const FEATURES = [
  {
    icon: '🏀',
    title: 'Gestione atleti',
    desc: 'Profili completi, metriche antropometriche, storico infortuni e Return-to-Play integrato.',
  },
  {
    icon: '📊',
    title: 'Analytics avanzati',
    desc: 'sRPE, ACWR, wellness score, load monitoring con grafici interattivi e alert automatici.',
  },
  {
    icon: '🤖',
    title: 'AI Coach',
    desc: 'Assistente AI basato su RAG per suggerimenti su periodizzazione, esercizi e protocolli RTP.',
  },
  {
    icon: '📅',
    title: 'Periodizzazione',
    desc: 'Piani a blocchi, ondulati o lineari con simulazione carico/fatica e drag-and-drop.',
  },
  {
    icon: '📋',
    title: 'Report automatici',
    desc: 'Report PDF/DOCX schedulati via email per staff tecnico, medico e preparazione atletica.',
  },
  {
    icon: '🔒',
    title: 'Sicurezza e GDPR',
    desc: 'Autenticazione JWT, RBAC, crittografia, export dati e gestione consensi GDPR compliant.',
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: '29',
    period: '/mese',
    features: ['5 atleti', '1 utente', 'Report base', 'Wellness tracking', 'Calendario'],
    cta: 'Inizia gratis',
    popular: false,
  },
  {
    name: 'Professional',
    price: '79',
    period: '/mese',
    features: ['25 atleti', '5 utenti', 'Report avanzati', 'AI Coach', 'Periodizzazione', 'RTP', 'Analytics'],
    cta: 'Prova 14 giorni gratis',
    popular: true,
  },
  {
    name: 'Team',
    price: '149',
    period: '/mese',
    features: ['Atleti illimitati', 'Utenti illimitati', 'Tutto Professional', 'API access', 'Supporto prioritario', 'Onboarding dedicato'],
    cta: 'Contattaci',
    popular: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900">TrainMind <span className="text-teal-600">AI</span></span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">Funzionalità</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">Prezzi</a>
            <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">Accedi</Link>
            <Link href="/login" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Prova gratis</Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-indigo-50" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm text-teal-700">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Piattaforma AI per il basket
            </div>
            <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
              Preparazione atletica <br />
              <span className="bg-gradient-to-r from-teal-600 to-indigo-600 bg-clip-text text-transparent">
                potenziata dall&apos;AI
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600">
              TrainMind AI aiuta preparatori fisici nel basket a pianificare allenamenti,
              monitorare il carico, gestire infortuni e prendere decisioni basate sui dati.
              Tutto in un&apos;unica piattaforma.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/login" className="rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-500/30">
                Inizia la prova gratuita
              </Link>
              <a href="#features" className="rounded-xl border border-slate-300 px-8 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50">
                Scopri di più
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-slate-900">Tutto quello che serve al tuo staff</h2>
            <p className="mx-auto max-w-2xl text-slate-600">
              Dalla gestione degli atleti alla periodizzazione AI-assisted,
              TrainMind AI copre l&apos;intero workflow della preparazione atletica.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/5">
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-slate-900">Piani e prezzi</h2>
            <p className="mx-auto max-w-xl text-slate-600">
              Scegli il piano adatto alla tua organizzazione. Tutti i piani includono 14 giorni di prova gratuita.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-white p-8 ${
                  plan.popular
                    ? 'border-teal-500 shadow-xl shadow-teal-500/10'
                    : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-4 py-1 text-xs font-semibold text-white">
                    Più popolare
                  </div>
                )}
                <h3 className="mb-2 text-xl font-bold text-slate-900">{plan.name}</h3>
                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">&euro;{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="h-4 w-4 flex-shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition ${
                    plan.popular
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900">Pronto a trasformare la tua preparazione atletica?</h2>
          <p className="mx-auto mb-8 max-w-xl text-slate-600">
            Unisciti ai preparatori fisici che usano TrainMind AI per prendere decisioni migliori, più velocemente.
          </p>
          <Link href="/login" className="inline-flex rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-700">
            Inizia la prova gratuita
          </Link>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-900">TrainMind AI</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-700">Funzionalità</a>
            <a href="#pricing" className="hover:text-slate-700">Prezzi</a>
            <a href="mailto:info@trainmind.ai" className="hover:text-slate-700">Contatti</a>
          </div>
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} TrainMind AI. Tutti i diritti riservati.</p>
        </div>
      </footer>
    </div>
  );
}
