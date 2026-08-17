/* ============================================================
   TrainMind — testi legali (Termini, Privacy, Cookie) in IT/EN/ES.

   GENERATO AUTOMATICAMENTE: non modificare a mano.
   La fonte sono gli stessi moduli da cui nascono i .docx nella cartella
   `legal/` del progetto, così la pagina web e il documento Word dicono
   esattamente la stessa cosa. Per cambiare un testo si modifica la fonte
   e si rigenera questo file.

   La versione dei documenti e' in apps/api/src/lib/legal.ts (LEGAL_VERSIONS):
   quando cambia un testo in modo sostanziale va aggiornata anche li',
   perche' e' quella che viene registrata all'accettazione dell'utente.

   Nel testo, **cosi'** indica il grassetto: lo interpreta <RichText>.
   I segnaposto fra parentesi quadre vanno compilati prima della
   pubblicazione (ragione sociale, sede, P.IVA, email, foro).
   ============================================================ */

export type LegalLocale = 'it' | 'en' | 'es';
export type LegalDocKey = 'terms' | 'privacy' | 'cookies';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] };

export interface LegalSection {
  h: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  /** Riquadro "In breve" in cima al documento (puo' mancare). */
  tldr: { title: string; items: string[] } | null;
  /** Paragrafi prima della prima sezione numerata. */
  intro: LegalBlock[];
  sections: LegalSection[];
}

export const LEGAL_CONTENT: Record<LegalDocKey, Record<LegalLocale, LegalDoc>> =
{
  terms: {
    it: {
      title: "Termini di Servizio",
      updated: "Ultimo aggiornamento: 21 luglio 2026 · Versione 2.0",
      tldr: {
        title: "In breve (non sostituisce il testo integrale)",
        items: [
          "TrainMind AI ti aiuta a pianificare e analizzare gli allenamenti con il supporto dell'IA. **Non è un consiglio medico**.",
          "Devi avere almeno 14 anni; se minorenne serve il consenso di un genitore.",
          "Alcune funzioni richiedono un abbonamento a pagamento che si rinnova automaticamente. Puoi disdire in qualsiasi momento.",
          "Sei responsabile dei contenuti che carichi e delle decisioni di allenamento che prendi.",
          "La responsabilità del Fornitore è limitata a quanto pagato negli ultimi 12 mesi (salvo casi non escludibili per legge)."
        ]
      },
      intro: [
        {
          type: "p",
          text: "I presenti Termini di Servizio (\"**Termini**\") disciplinano l'accesso e l'utilizzo della piattaforma TrainMind AI, comprensiva dell'applicazione web, dell'applicazione mobile/PWA e dei servizi correlati (collettivamente, il \"**Servizio**\"), gestita da **[RAGIONE SOCIALE / NOME TITOLARE]**, con sede legale in **[SEDE LEGALE]**, P.IVA/C.F. **[P.IVA / C.F.]**, iscrizione **[N. REA / CCIAA]**, email di contatto **[EMAIL DI CONTATTO]**, PEC **[PEC]** (il \"**Fornitore**\", \"**noi**\"). Creando un account o utilizzando il Servizio accetti di essere vincolato dai presenti Termini. Se non li accetti, non utilizzare il Servizio."
        },
        {
          type: "p",
          text: "La versione italiana è la **versione ufficiale** e prevale su qualsiasi traduzione in caso di discrepanza."
        }
      ],
      sections: [
        {
          h: "1. Il Servizio",
          blocks: [
            {
              type: "p",
              text: "TrainMind AI è una piattaforma digitale che supporta atleti e allenatori nella pianificazione, nel monitoraggio e nell'analisi dell'allenamento sportivo. Il Servizio utilizza l'intelligenza artificiale (\"**IA**\") per generare suggerimenti di allenamento, piani di lavoro e analisi delle prestazioni sulla base dei dati che fornisci."
            },
            {
              type: "p",
              text: "**Importante – nessun consiglio medico.** Il Servizio fornisce esclusivamente informazioni generali su fitness e allenamento. **Non** è un dispositivo medico ai sensi del Regolamento (UE) 2017/745 e non fornisce consulenza medica, diagnostica, terapeutica o nutrizionale. I contenuti generati dall'IA possono essere imprecisi o non adatti alla tua condizione individuale. Consulta sempre un medico o un professionista qualificato prima di iniziare o modificare un programma di allenamento, soprattutto in presenza (anche sospetta) di patologie. Utilizzi i suggerimenti di allenamento a tuo rischio e resti l'unico responsabile della valutazione della tua idoneità fisica."
            }
          ]
        },
        {
          h: "2. Requisiti, account e verifica",
          blocks: [
            {
              type: "p",
              text: "Per utilizzare il Servizio devi avere almeno **14 anni**. Se hai meno di 18 anni, puoi utilizzare il Servizio solo con il permesso di un genitore o tutore legale, che deve accettare i presenti Termini per tuo conto tramite l'apposito modulo di consenso; eventuali abbonamenti a pagamento per un minore devono essere acquistati e gestiti da un genitore o tutore. Potremo richiedere prova del consenso e sospendere gli account per i quali il consenso non sia verificabile."
            },
            {
              type: "p",
              text: "Devi fornire informazioni di registrazione accurate e complete e mantenere riservate le tue credenziali. Sei responsabile di ogni attività svolta tramite il tuo account. Segnala immediatamente a **[EMAIL DI CONTATTO]** qualsiasi uso non autorizzato. Al momento della registrazione **registriamo la lingua e la versione dei Termini che hai accettato**, data, ora e indirizzo IP, ai fini di prova ex art. 7 GDPR."
            }
          ]
        },
        {
          h: "3. Abbonamenti, pagamenti e prove gratuite",
          blocks: [
            {
              type: "p",
              text: "Alcune funzionalità sono disponibili solo con piani di abbonamento a pagamento. Prezzi, periodi di fatturazione e caratteristiche dei piani sono indicati nel Servizio al momento dell'acquisto; l'IVA è inclusa dove applicabile. I pagamenti sono elaborati da fornitori terzi (es. **Stripe**); non conserviamo i dati completi delle carte di pagamento. La fattura elettronica, ove obbligatoria, è emessa tramite SdI."
            },
            {
              type: "ul",
              items: [
                "**Rinnovo automatico.** Salvo diversa indicazione, gli abbonamenti si rinnovano automaticamente alla fine di ciascun periodo di fatturazione al prezzo allora vigente, fino alla disdetta. Riceverai un promemoria via email prima del rinnovo di piani annuali.",
                "**Disdetta.** Puoi disdire in qualsiasi momento dalle impostazioni dell'account; la disdetta ha effetto al termine del periodo di fatturazione in corso. Non sono dovuti rimborsi pro-rata per il periodo residuo, salvo quanto previsto dalla legge.",
                "**Prove gratuite.** Ove offerta, la prova gratuita si converte in abbonamento a pagamento al termine del periodo di prova, salvo disdetta prima della scadenza. Ricevi email di avviso 3 giorni prima della conversione.",
                "**Modifiche di prezzo.** Possiamo modificare i prezzi con almeno 30 giorni di preavviso; le modifiche si applicano dal rinnovo successivo. In caso di disaccordo puoi disdire prima del rinnovo senza costi aggiuntivi.",
                "**Mancato pagamento.** In caso di mancato pagamento potremo sospendere l'accesso alle funzioni a pagamento dopo ragionevole preavviso; i dati restano conservati per almeno 30 giorni per consentire il ripristino."
              ]
            }
          ]
        },
        {
          h: "4. Diritto di recesso (consumatori UE)",
          blocks: [
            {
              type: "p",
              text: "Se sei un consumatore nell'Unione Europea, hai diritto di recedere dall'acquisto entro 14 giorni senza indicarne le ragioni. **Tuttavia**, richiedendo l'accesso immediato al servizio digitale e riconoscendo che con l'inizio dell'esecuzione perdi il diritto di recesso, acconsenti alla fornitura del contenuto/servizio digitale prima della scadenza del periodo di recesso, ai sensi degli artt. 52 e ss. del Codice del Consumo (D.lgs. 206/2005). Per esercitare il recesso, ove applicabile, contattaci a **[EMAIL DI CONTATTO]** o utilizza il modulo di recesso tipo allegato al Codice del Consumo."
            }
          ]
        },
        {
          h: "5. Uso consentito e Politica di uso accettabile",
          blocks: [
            {
              type: "p",
              text: "Ti impegni a non:"
            },
            {
              type: "ul",
              items: [
                "utilizzare il Servizio in modo illecito, contrario all'ordine pubblico o al buon costume, o in violazione dei presenti Termini;",
                "condividere il tuo account, rivendere o concedere in sublicenza l'accesso al Servizio;",
                "caricare contenuti illeciti, diffamatori, discriminatori, che incitano all'odio o alla violenza, o lesivi di diritti di terzi (incluso il diritto d'autore e alla privacy);",
                "utilizzare il Servizio per attività di doping, per raccomandazioni pericolose per la salute o per aggirare i controlli antidoping;",
                "decompilare, effettuare scraping, reverse engineering o estrarre dati o modelli dal Servizio, né accedervi con sistemi automatizzati al di fuori delle interfacce previste (API ufficiali);",
                "utilizzare il Servizio o i suoi output per addestrare modelli di IA di terzi o per sviluppare un prodotto concorrente;",
                "interferire con la sicurezza o l'integrità del Servizio, tentare di superarne le misure di sicurezza o utilizzarlo per attacchi (DoS, spam, malware)."
              ]
            },
            {
              type: "p",
              text: "La violazione di queste regole comporta la sospensione o chiusura dell'account, il divieto di rientrarvi con altri account e, nei casi gravi, la segnalazione alle autorità competenti. In coerenza con il Digital Services Act (Reg. UE 2022/2065), ti ricordiamo che puoi **segnalare contenuti illeciti** presenti sul Servizio scrivendo a **[EMAIL DI CONTATTO]**; le segnalazioni saranno gestite con tempestività e imparzialità."
            }
          ]
        },
        {
          h: "6. Contenuti e dati dell'utente",
          blocks: [
            {
              type: "p",
              text: "Mantieni la titolarità dei dati e dei contenuti che inserisci (es. diari di allenamento, dati prestazionali, note, immagini) (\"**Contenuti Utente**\"). Ci concedi una licenza non esclusiva, gratuita e mondiale per ospitare, elaborare, riprodurre e visualizzare i Contenuti Utente al solo fine di erogare, mantenere, proteggere e migliorare il Servizio, in conformità all'Informativa Privacy. Garantisci di disporre dei diritti necessari sui Contenuti Utente e di aver ottenuto il consenso di eventuali terze persone ritratte o menzionate."
            },
            {
              type: "p",
              text: "Puoi esportare in qualsiasi momento i tuoi Contenuti Utente in un formato leggibile da macchina dalle impostazioni dell'account (portabilità)."
            }
          ]
        },
        {
          h: "7. Contenuti generati dall'IA e trasparenza (AI Act)",
          blocks: [
            {
              type: "p",
              text: "Gli output dell'IA sono generati automaticamente sulla base di modelli statistici e delle informazioni da te fornite. Possono contenere errori, omissioni o raccomandazioni non adatte al tuo caso individuale. **Non garantiamo** l'accuratezza, la completezza o l'idoneità allo scopo degli output dell'IA. Le decisioni sul tuo allenamento e sulla tua salute restano esclusivamente tue (o del tuo allenatore)."
            },
            {
              type: "p",
              text: "In conformità agli obblighi di trasparenza previsti dall'art. 50 del Regolamento (UE) 2024/1689 (\"**AI Act**\"), applicabili dal 2 agosto 2026:"
            },
            {
              type: "ul",
              items: [
                "il Servizio ti **informa chiaramente quando stai interagendo con un sistema di IA** (es. assistente virtuale, chat o suggeritore) e non con una persona;",
                "i contenuti generati o modificati in modo sostanziale dall'IA all'interno del Servizio (piani di allenamento, analisi delle prestazioni, testi) sono **identificati come generati dall'IA**;",
                "il Servizio **non** utilizza sistemi di riconoscimento delle emozioni né di categorizzazione biometrica, né pratiche vietate dall'art. 5 dell'AI Act (es. social scoring, sfruttamento di vulnerabilità);",
                "gli output dell'IA sono sempre soggetti a **supervisione umana**: si tratta di suggerimenti e le decisioni finali restano a te o al tuo allenatore;",
                "sulla base della nostra valutazione, il Servizio **non rientra tra i sistemi di IA ad alto rischio** ai sensi dell'Allegato III dell'AI Act. La valutazione è documentata e riesaminata periodicamente."
              ]
            }
          ]
        },
        {
          h: "8. Proprietà intellettuale",
          blocks: [
            {
              type: "p",
              text: "Il Servizio, inclusi software, modelli, design, marchi, loghi, contenuti editoriali e materiali di allenamento predefiniti (esclusi i Contenuti Utente), è di proprietà del Fornitore o dei suoi licenzianti ed è protetto dalle leggi sulla proprietà intellettuale, dal diritto d'autore e dal diritto sui generis sulle banche dati. I presenti Termini ti concedono una licenza limitata, non esclusiva, non trasferibile e revocabile per utilizzare il Servizio per finalità personali (o professionali interne, se sei un allenatore/società con piano dedicato). Nessun altro diritto è concesso. Ti è vietato rimuovere o alterare marchi, avvisi di copyright o altre indicazioni di proprietà."
            }
          ]
        },
        {
          h: "9. Servizi di terzi e integrazioni",
          blocks: [
            {
              type: "p",
              text: "Il Servizio può integrarsi con servizi di terzi (es. dispositivi wearable, calendari, provider di pagamento, provider IA). L'uso di tali servizi è soggetto ai relativi termini; non siamo responsabili delle funzionalità, disponibilità o pratiche sui dati di tali terze parti. La disattivazione di un'integrazione da parte del terzo o tua non ti dà diritto a rimborsi."
            }
          ]
        },
        {
          h: "10. Disponibilità del Servizio e livelli di servizio",
          blocks: [
            {
              type: "p",
              text: "Ci impegniamo a mantenere il Servizio disponibile con la diligenza tipica del settore. Per i piani a pagamento perseguiamo un obiettivo di **disponibilità mensile pari o superiore al 99,5%** su base annua, esclusi i tempi di manutenzione programmata comunicati con preavviso, gli eventi di forza maggiore e i malfunzionamenti di servizi di terzi. Non garantiamo un funzionamento ininterrotto o privo di errori. Le SLA e le eventuali credit note per interruzioni prolungate, ove previste per un piano specifico, sono descritte nella pagina piani."
            }
          ]
        },
        {
          h: "11. Modifiche del Servizio",
          blocks: [
            {
              type: "p",
              text: "Possiamo modificare, sospendere o interrompere funzionalità (anche per manutenzione o sicurezza), dando ragionevole preavviso delle modifiche sostanziali che incidono su funzionalità a pagamento. In caso di interruzione definitiva di una funzionalità a pagamento essenziale, potrai richiedere un rimborso pro-rata degli importi prepagati non goduti."
            }
          ]
        },
        {
          h: "12. Esclusioni e limitazioni di responsabilità",
          blocks: [
            {
              type: "p",
              text: "Nella misura massima consentita dalla legge, il Servizio è fornito \"così com'è\" e \"come disponibile\". **Nulla nei presenti Termini esclude o limita la responsabilità nei casi in cui ciò sia vietato dalla legge**, inclusa la responsabilità per dolo o colpa grave, per danni alla persona derivanti da nostra condotta, e i diritti inderogabili dei consumatori. Fermo quanto precede, non rispondiamo di:"
            },
            {
              type: "ul",
              items: [
                "danni indiretti, incidentali, consequenziali, lucro cessante, perdita di opportunità o di reputazione;",
                "perdita di dati non a noi imputabile (es. errata cancellazione da parte tua o di terzi con cui condividi l'account);",
                "infortuni, sovrallenamento o conseguenze per la salute derivanti da decisioni di allenamento assunte utilizzando il Servizio;",
                "eventi di **forza maggiore** al di fuori del nostro ragionevole controllo (calamità, guerra, sciopero, black-out, attacchi informatici massivi, interventi di autorità, malfunzionamenti di reti terze);",
                "attività di terzi (fornitori di dispositivi, provider IA, provider di pagamento)."
              ]
            },
            {
              type: "p",
              text: "Per i piani a pagamento, **la nostra responsabilità complessiva è limitata al maggiore tra: (a) gli importi da te corrisposti per il Servizio nei 12 mesi precedenti l'evento che ha originato la pretesa, o (b) 100 euro**. Tale limitazione non si applica ai casi non escludibili per legge."
            }
          ]
        },
        {
          h: "13. Manleva",
          blocks: [
            {
              type: "p",
              text: "Ti impegni a manlevare e tenere indenne il Fornitore, i suoi amministratori, dipendenti e collaboratori da qualsiasi pretesa, danno, costo o spesa (comprese ragionevoli spese legali) derivante da: (i) tuo utilizzo del Servizio in violazione dei presenti Termini o della legge; (ii) contenuti che hai caricato in violazione di diritti di terzi; (iii) danni cagionati a terzi tramite il Servizio."
            }
          ]
        },
        {
          h: "14. Risoluzione e sospensione",
          blocks: [
            {
              type: "p",
              text: "Puoi cessare l'utilizzo del Servizio ed eliminare il tuo account in qualsiasi momento dalle impostazioni. Possiamo sospendere o chiudere il tuo account per violazione sostanziale dei Termini, uso illecito, mancato pagamento persistente, o ragioni di sicurezza, con preavviso ove ragionevolmente possibile. Alla cessazione, il tuo diritto di utilizzo del Servizio termina; le clausole destinate per natura a sopravvivere (proprietà intellettuale, responsabilità, legge applicabile, manleva) restano efficaci. La conservazione dei dati dopo la cessazione è disciplinata dall'Informativa Privacy."
            }
          ]
        },
        {
          h: "15. Modifiche dei Termini",
          blocks: [
            {
              type: "p",
              text: "Possiamo modificare i presenti Termini per ragioni legali, tecniche o commerciali. Le modifiche sostanziali saranno comunicate (via email o in-app) **con almeno 30 giorni di anticipo** rispetto alla loro efficacia. L'uso continuato del Servizio dopo tale data costituisce accettazione. In caso di disaccordo, puoi recedere dall'abbonamento prima dell'entrata in vigore delle modifiche, con rimborso pro-rata degli importi non goduti."
            }
          ]
        },
        {
          h: "16. Cessione",
          blocks: [
            {
              type: "p",
              text: "Non puoi cedere i presenti Termini o i diritti da essi derivanti senza il nostro previo consenso scritto. Il Fornitore può cedere il contratto a un'affiliata o a un terzo nel contesto di operazioni straordinarie (fusione, cessione di ramo d'azienda, ecc.), previa comunicazione con ragionevole preavviso e mantenendo inalterati i tuoi diritti sostanziali."
            }
          ]
        },
        {
          h: "17. Comunicazioni",
          blocks: [
            {
              type: "p",
              text: "Le comunicazioni ufficiali ti saranno inviate all'indirizzo email associato al tuo account; è tua responsabilità mantenerlo aggiornato. Le nostre comunicazioni saranno inviate anche in-app quando appropriato. Le tue comunicazioni al Fornitore devono essere inviate a **[EMAIL DI CONTATTO]**."
            }
          ]
        },
        {
          h: "18. Reclami, ODR e legge applicabile",
          blocks: [
            {
              type: "p",
              text: "I presenti Termini sono regolati dalla **legge italiana**. Per i consumatori restano ferme le norme inderogabili del Paese di residenza abituale ed è competente il foro del luogo di residenza o domicilio del consumatore in Italia. Per gli utenti professionali è competente in via esclusiva il **Foro di [FORO COMPETENTE]**."
            },
            {
              type: "p",
              text: "Prima di adire l'autorità giudiziaria, ti invitiamo a contattarci a **[EMAIL DI CONTATTO]** per una soluzione bonaria. I consumatori UE possono inoltre utilizzare la piattaforma europea ODR: https://ec.europa.eu/consumers/odr."
            }
          ]
        },
        {
          h: "19. Contatti",
          blocks: [
            {
              type: "p",
              text: "**[RAGIONE SOCIALE / NOME TITOLARE]** — **[SEDE LEGALE]** — email **[EMAIL DI CONTATTO]** — PEC **[PEC]**."
            }
          ]
        }
      ]
    },
    en: {
      title: "Terms of Service",
      updated: "Last updated: 21 July 2026 · Version 2.0",
      tldr: {
        title: "At a glance (does not replace the full text)",
        items: [
          "TrainMind AI helps you plan and analyse training with AI assistance. **It is not medical advice.**",
          "You must be at least 14; if you are a minor, a parent must consent.",
          "Some features require a paid subscription that auto-renews. You can cancel any time.",
          "You are responsible for what you upload and for your training decisions.",
          "Provider liability is capped at what you paid in the last 12 months (except where the law does not allow such caps)."
        ]
      },
      intro: [
        {
          type: "p",
          text: "These Terms of Service (\"**Terms**\") govern access to and use of the TrainMind AI platform, including the web application, the mobile/PWA application and related services (collectively, the \"**Service**\"), operated by **[COMPANY NAME / OWNER NAME]**, with registered office at **[REGISTERED ADDRESS]**, VAT/Tax ID **[VAT / TAX ID]**, **[REA / CHAMBER OF COMMERCE NO.]**, contact email **[CONTACT EMAIL]**, certified email **[CERTIFIED EMAIL (PEC)]** (the \"**Provider**\", \"**we**\"). By creating an account or using the Service you agree to be bound by these Terms. If you do not agree, do not use the Service."
        },
        {
          type: "p",
          text: "The Italian version is the **controlling version** and prevails over any translation in case of discrepancy."
        }
      ],
      sections: [
        {
          h: "1. The Service",
          blocks: [
            {
              type: "p",
              text: "TrainMind AI is a digital platform that supports athletes and coaches in planning, tracking and analysing sports training. The Service uses artificial intelligence (\"**AI**\") to generate training suggestions, workout plans and performance analyses based on the data you provide."
            },
            {
              type: "p",
              text: "**Important – no medical advice.** The Service provides general fitness and training information only. It is **not** a medical device within the meaning of Regulation (EU) 2017/745 and does not provide medical, diagnostic, therapeutic or nutritional advice. AI-generated content may be inaccurate or unsuitable for your individual condition. Always consult a physician or qualified professional before starting or changing any training programme, especially if you have (or suspect you have) any health condition. You use training suggestions at your own risk and remain solely responsible for assessing your physical fitness."
            }
          ]
        },
        {
          h: "2. Eligibility, accounts and proof of acceptance",
          blocks: [
            {
              type: "p",
              text: "To use the Service you must be at least **14 years old**. If you are under 18, you may use the Service only with the permission of a parent or legal guardian, who must accept these Terms on your behalf via our parental consent form; any paid subscription for a minor must be purchased and managed by a parent or guardian. We may ask for proof of consent and may suspend accounts where consent cannot be verified."
            },
            {
              type: "p",
              text: "You must provide accurate and complete registration information and keep your credentials confidential. You are responsible for all activity under your account. Notify us immediately at **[CONTACT EMAIL]** of any unauthorised use. At registration we **record the language and version of the Terms you accepted**, together with date, time and IP address, as proof of consent under Art. 7 GDPR."
            }
          ]
        },
        {
          h: "3. Subscriptions, payments and trials",
          blocks: [
            {
              type: "p",
              text: "Some features are available only under paid subscription plans. Prices, billing periods and plan features are shown in the Service at the time of purchase; VAT is included where applicable. Payments are processed by third-party payment providers (e.g. **Stripe**); we do not store full payment card details. Where required, electronic invoicing is issued via the Italian SdI system."
            },
            {
              type: "ul",
              items: [
                "**Automatic renewal.** Unless stated otherwise, subscriptions renew automatically at the end of each billing period at the then-current price, until cancelled. We send a reminder email before annual renewals.",
                "**Cancellation.** You can cancel at any time from your account settings; cancellation takes effect at the end of the current billing period. No pro-rata refunds are due for the remaining period, except where required by law.",
                "**Free trials.** Where offered, a free trial converts into a paid subscription at the end of the trial unless you cancel before it ends. We notify you 3 days before conversion.",
                "**Price changes.** We may change prices with at least 30 days' advance notice; changes apply from the next renewal. If you do not agree, you may cancel before the renewal at no cost.",
                "**Non-payment.** If a payment fails, we may suspend access to paid features after reasonable notice; your data is retained for at least 30 days to allow reinstatement."
              ]
            }
          ]
        },
        {
          h: "4. Right of withdrawal (EU consumers)",
          blocks: [
            {
              type: "p",
              text: "If you are a consumer in the European Union, you have the right to withdraw from the purchase within 14 days without giving any reason. **However**, by requesting immediate access to the digital service and acknowledging that you thereby lose the right of withdrawal once performance has begun, you consent to the supply of the digital content/service before the end of the withdrawal period, in accordance with Articles 52 et seq. of the Italian Consumer Code (Legislative Decree 206/2005). To exercise withdrawal where applicable, contact us at **[CONTACT EMAIL]** or use the model withdrawal form attached to the Consumer Code."
            }
          ]
        },
        {
          h: "5. Acceptable use",
          blocks: [
            {
              type: "p",
              text: "You agree not to:"
            },
            {
              type: "ul",
              items: [
                "use the Service unlawfully, contrary to public policy or in breach of these Terms;",
                "share your account, resell or sub-license access to the Service;",
                "upload content that is unlawful, defamatory, discriminatory, hateful, or that infringes third-party rights (including copyright and privacy);",
                "use the Service for doping purposes, for health-endangering recommendations, or to circumvent anti-doping controls;",
                "reverse engineer, scrape or extract data or models from the Service, or use automated systems to access it outside the intended interfaces (official APIs);",
                "use the Service or its outputs to train third-party AI models or to develop a competing product;",
                "interfere with the security or integrity of the Service, attempt to bypass security measures or use it for attacks (DoS, spam, malware)."
              ]
            },
            {
              type: "p",
              text: "Breach of these rules leads to account suspension or termination, bars re-registration under another account and, in serious cases, referral to the competent authorities. In line with the Digital Services Act (Reg. (EU) 2022/2065), you can **report illegal content** on the Service by writing to **[CONTACT EMAIL]**; notices will be handled promptly and impartially."
            }
          ]
        },
        {
          h: "6. User content and data",
          blocks: [
            {
              type: "p",
              text: "You retain ownership of the data and content you submit (e.g. training logs, performance data, notes, images) (\"**User Content**\"). You grant us a non-exclusive, royalty-free, worldwide licence to host, process, reproduce and display User Content solely to operate, maintain, secure and improve the Service, in accordance with our Privacy Policy. You warrant that you have the rights to submit the User Content and any necessary consents from third parties shown or mentioned."
            },
            {
              type: "p",
              text: "You can export your User Content at any time from your account settings in a machine-readable format (data portability)."
            }
          ]
        },
        {
          h: "7. AI-generated content and transparency (EU AI Act)",
          blocks: [
            {
              type: "p",
              text: "AI outputs are generated automatically based on statistical models and the information you provide. They may contain errors, omissions or recommendations unsuitable for your individual case. **We do not guarantee** the accuracy, completeness or fitness for purpose of AI outputs. Decisions about your training and health remain yours (or your coach's) alone."
            },
            {
              type: "p",
              text: "In accordance with the transparency obligations under Article 50 of Regulation (EU) 2024/1689 (the \"**AI Act**\"), applicable from 2 August 2026:"
            },
            {
              type: "ul",
              items: [
                "the Service **clearly informs you when you are interacting with an AI system** (e.g. virtual assistant, chat or suggester) rather than a human;",
                "content generated or substantially modified by AI within the Service (training plans, performance analyses, texts) is **identified as AI-generated**;",
                "the Service does **not** use emotion-recognition systems or biometric categorisation, nor any practice prohibited under Article 5 of the AI Act (e.g. social scoring, exploitation of vulnerabilities);",
                "AI outputs are always subject to **human oversight**: they are suggestions, and final decisions rest with you or your coach;",
                "based on our assessment, the Service is **not a high-risk AI system** under Annex III of the AI Act. The assessment is documented and reviewed periodically."
              ]
            }
          ]
        },
        {
          h: "8. Intellectual property",
          blocks: [
            {
              type: "p",
              text: "The Service, including software, models, design, trademarks, logos, editorial content and predefined training material (excluding User Content), is owned by the Provider or its licensors and protected by intellectual property, copyright and database sui-generis rights. These Terms grant you a limited, non-exclusive, non-transferable, revocable licence to use the Service for personal purposes (or internal professional purposes if you are a coach/organisation on a dedicated plan). No other rights are granted. You may not remove or alter trademarks, copyright notices or other proprietary notices."
            }
          ]
        },
        {
          h: "9. Third-party services and integrations",
          blocks: [
            {
              type: "p",
              text: "The Service may integrate with third-party services (e.g. wearable devices, calendars, payment providers, AI providers). Use of those services is subject to their own terms; we are not responsible for the functionality, availability or data practices of those third parties. Deactivation of an integration by the third party or by you does not entitle you to a refund."
            }
          ]
        },
        {
          h: "10. Availability and service levels",
          blocks: [
            {
              type: "p",
              text: "We aim to keep the Service available with industry-standard diligence. For paid plans we target **monthly availability of at least 99.5%** on an annual basis, excluding scheduled maintenance windows communicated in advance, force-majeure events, and malfunctions of third-party services. We do not guarantee uninterrupted or error-free operation. Any SLAs and service credits for extended outages, where offered for a specific plan, are described on the pricing page."
            }
          ]
        },
        {
          h: "11. Changes to the Service",
          blocks: [
            {
              type: "p",
              text: "We may modify, suspend or discontinue features (including for maintenance or security), and will give reasonable notice of material changes affecting paid features. If we permanently discontinue an essential paid feature, you may request a pro-rata refund of pre-paid amounts not enjoyed."
            }
          ]
        },
        {
          h: "12. Disclaimer and limitation of liability",
          blocks: [
            {
              type: "p",
              text: "To the maximum extent permitted by law, the Service is provided \"as is\" and \"as available\". **Nothing in these Terms excludes or limits liability where it would be unlawful to do so**, including liability for wilful misconduct or gross negligence, personal injury caused by us, and mandatory consumer rights. Subject to the foregoing, we are not liable for:"
            },
            {
              type: "ul",
              items: [
                "indirect, incidental, consequential damages, lost profits, lost opportunities or reputational harm;",
                "loss of data not caused by us (e.g. accidental deletion by you or by third parties with whom you share the account);",
                "injuries, overtraining or health consequences resulting from training decisions made using the Service;",
                "**force majeure** events beyond our reasonable control (natural disasters, war, strikes, blackouts, large-scale cyber-attacks, actions of authorities, malfunctions of third-party networks);",
                "acts of third parties (device manufacturers, AI providers, payment providers)."
              ]
            },
            {
              type: "p",
              text: "For paid plans, **our aggregate liability is capped at the greater of: (a) the amounts you paid for the Service in the 12 months preceding the event giving rise to the claim, or (b) EUR 100**. This cap does not apply where liability cannot be limited by law."
            }
          ]
        },
        {
          h: "13. Indemnification",
          blocks: [
            {
              type: "p",
              text: "You will indemnify and hold harmless the Provider, its directors, employees and contractors from any claim, damage, cost or expense (including reasonable legal fees) arising out of: (i) your use of the Service in breach of these Terms or the law; (ii) content you uploaded in violation of third-party rights; (iii) damage caused to third parties through the Service."
            }
          ]
        },
        {
          h: "14. Termination and suspension",
          blocks: [
            {
              type: "p",
              text: "You may stop using the Service and delete your account at any time from settings. We may suspend or terminate your account for material breach of these Terms, unlawful use, persistent non-payment or security reasons, with notice where reasonably possible. Upon termination, your right to use the Service ceases; provisions that by their nature survive (IP, liability, governing law, indemnification) remain in force. Data retention after termination is governed by the Privacy Policy."
            }
          ]
        },
        {
          h: "15. Changes to these Terms",
          blocks: [
            {
              type: "p",
              text: "We may amend these Terms for legal, technical or business reasons. Material changes will be notified (by email or in-app) **at least 30 days** before they take effect. Continued use after the effective date constitutes acceptance. If you do not agree, you may terminate your subscription before the changes take effect, with a pro-rata refund of unused amounts."
            }
          ]
        },
        {
          h: "16. Assignment",
          blocks: [
            {
              type: "p",
              text: "You may not assign these Terms or the rights hereunder without our prior written consent. The Provider may assign this contract to an affiliate or third party in the context of corporate transactions (merger, business transfer, etc.), subject to reasonable prior notice and preserving your substantive rights."
            }
          ]
        },
        {
          h: "17. Communications",
          blocks: [
            {
              type: "p",
              text: "Official communications will be sent to the email address associated with your account; you must keep it up to date. We may also communicate in-app where appropriate. Your communications to the Provider must be sent to **[CONTACT EMAIL]**."
            }
          ]
        },
        {
          h: "18. Complaints, ODR and governing law",
          blocks: [
            {
              type: "p",
              text: "These Terms are governed by **Italian law**. For consumers, mandatory rules of the country of habitual residence remain unaffected and the competent court is that of the consumer's place of residence or domicile in Italy. For business users, the courts of **[COURT VENUE]** have exclusive jurisdiction."
            },
            {
              type: "p",
              text: "Before starting judicial proceedings, please contact us at **[CONTACT EMAIL]** for an amicable solution. EU consumers may also use the European ODR platform: https://ec.europa.eu/consumers/odr."
            }
          ]
        },
        {
          h: "19. Contact",
          blocks: [
            {
              type: "p",
              text: "**[COMPANY NAME / OWNER NAME]** — **[REGISTERED ADDRESS]** — email **[CONTACT EMAIL]** — PEC **[CERTIFIED EMAIL (PEC)]**."
            }
          ]
        }
      ]
    },
    es: {
      title: "Términos de Servicio",
      updated: "Última actualización: 21 de julio de 2026 · Versión 2.0",
      tldr: {
        title: "En resumen (no sustituye al texto íntegro)",
        items: [
          "TrainMind AI te ayuda a planificar y analizar entrenamientos con IA. **No es asesoramiento médico.**",
          "Debes tener al menos 14 años; si eres menor, un progenitor debe consentir.",
          "Algunas funciones requieren una suscripción de pago que se renueva automáticamente. Puedes cancelar en cualquier momento.",
          "Eres responsable de lo que subes y de tus decisiones de entrenamiento.",
          "La responsabilidad del Proveedor está limitada a lo pagado en los últimos 12 meses (salvo casos que la ley no permite limitar)."
        ]
      },
      intro: [
        {
          type: "p",
          text: "Los presentes Términos de Servicio (\"**Términos**\") regulan el acceso y el uso de la plataforma TrainMind AI, incluida la aplicación web, la aplicación móvil/PWA y los servicios relacionados (conjuntamente, el \"**Servicio**\"), gestionada por **[RAZÓN SOCIAL / NOMBRE DEL TITULAR]**, con domicilio social en **[DOMICILIO SOCIAL]**, NIF/IVA **[NIF / IVA]**, **[REA / REG. MERCANTIL]**, email de contacto **[EMAIL DE CONTACTO]**, email certificado **[EMAIL CERTIFICADO (PEC)]** (el \"**Proveedor**\", \"**nosotros**\"). Al crear una cuenta o utilizar el Servicio, aceptas quedar vinculado por los presentes Términos. Si no los aceptas, no utilices el Servicio."
        },
        {
          type: "p",
          text: "La versión italiana es la **versión oficial** y prevalece sobre cualquier traducción en caso de discrepancia."
        }
      ],
      sections: [
        {
          h: "1. El Servicio",
          blocks: [
            {
              type: "p",
              text: "TrainMind AI es una plataforma digital que ayuda a atletas y entrenadores a planificar, monitorizar y analizar el entrenamiento deportivo. El Servicio utiliza inteligencia artificial (\"**IA**\") para generar sugerencias de entrenamiento, planes de trabajo y análisis de rendimiento a partir de los datos que proporcionas."
            },
            {
              type: "p",
              text: "**Importante – no es asesoramiento médico.** El Servicio proporciona únicamente información general sobre fitness y entrenamiento. **No** es un producto sanitario en el sentido del Reglamento (UE) 2017/745 y no ofrece asesoramiento médico, diagnóstico, terapéutico ni nutricional. Los contenidos generados por la IA pueden ser inexactos o inadecuados para tu condición individual. Consulta siempre a un médico o profesional cualificado antes de iniciar o modificar un programa de entrenamiento, especialmente si padeces (o sospechas padecer) alguna patología. Utilizas las sugerencias de entrenamiento bajo tu propio riesgo y sigues siendo el único responsable de evaluar tu aptitud física."
            }
          ]
        },
        {
          h: "2. Requisitos, cuentas y prueba de aceptación",
          blocks: [
            {
              type: "p",
              text: "Para utilizar el Servicio debes tener al menos **14 años**. Si eres menor de 18 años, solo puedes utilizar el Servicio con el permiso de un progenitor o tutor legal, que deberá aceptar los presentes Términos en tu nombre mediante nuestro formulario de consentimiento parental; cualquier suscripción de pago para un menor deberá ser contratada y gestionada por un progenitor o tutor. Podremos solicitar prueba del consentimiento y suspender las cuentas cuyo consentimiento no pueda verificarse."
            },
            {
              type: "p",
              text: "Debes proporcionar información de registro veraz y completa y mantener la confidencialidad de tus credenciales. Eres responsable de toda actividad realizada con tu cuenta. Notifica inmediatamente a **[EMAIL DE CONTACTO]** cualquier uso no autorizado. En el momento del registro **registramos el idioma y la versión de los Términos aceptados**, la fecha, la hora y la dirección IP, como prueba del consentimiento conforme al art. 7 RGPD."
            }
          ]
        },
        {
          h: "3. Suscripciones, pagos y pruebas gratuitas",
          blocks: [
            {
              type: "p",
              text: "Algunas funcionalidades solo están disponibles mediante planes de suscripción de pago. Los precios, los períodos de facturación y las características de los planes se indican en el Servicio en el momento de la compra; el IVA se incluye cuando proceda. Los pagos son procesados por proveedores externos (p. ej. **Stripe**); no almacenamos los datos completos de las tarjetas. Cuando sea obligatoria, la factura electrónica se emite a través del sistema SdI italiano."
            },
            {
              type: "ul",
              items: [
                "**Renovación automática.** Salvo indicación en contrario, las suscripciones se renuevan automáticamente al final de cada período de facturación al precio vigente en ese momento, hasta su cancelación. Enviamos un recordatorio por email antes de las renovaciones anuales.",
                "**Cancelación.** Puedes cancelar en cualquier momento desde la configuración de tu cuenta; la cancelación surte efecto al final del período de facturación en curso. No procede reembolso prorrateado por el período restante, salvo que la ley disponga otra cosa.",
                "**Pruebas gratuitas.** Cuando se ofrezcan, la prueba gratuita se convierte en suscripción de pago al finalizar el período de prueba, salvo cancelación previa. Te avisamos 3 días antes de la conversión.",
                "**Cambios de precio.** Podemos modificar los precios con al menos 30 días de antelación; los cambios se aplican a partir de la siguiente renovación. Si no estás de acuerdo, puedes cancelar antes de la renovación sin coste alguno.",
                "**Impago.** En caso de impago podremos suspender el acceso a las funciones de pago tras un preaviso razonable; los datos se conservan durante al menos 30 días para permitir la reactivación."
              ]
            }
          ]
        },
        {
          h: "4. Derecho de desistimiento (consumidores UE)",
          blocks: [
            {
              type: "p",
              text: "Si eres consumidor en la Unión Europea, tienes derecho a desistir de la compra en un plazo de 14 días sin necesidad de justificación. **No obstante**, al solicitar el acceso inmediato al servicio digital y reconocer que con el inicio de la ejecución pierdes el derecho de desistimiento, consientes el suministro del contenido/servicio digital antes de que expire el plazo de desistimiento, de conformidad con los arts. 52 y ss. del Código de Consumo italiano (D.lgs. 206/2005). Para ejercer el desistimiento, cuando proceda, contáctanos en **[EMAIL DE CONTACTO]** o utiliza el modelo de formulario de desistimiento adjunto al Código de Consumo."
            }
          ]
        },
        {
          h: "5. Uso aceptable",
          blocks: [
            {
              type: "p",
              text: "Te comprometes a no:"
            },
            {
              type: "ul",
              items: [
                "utilizar el Servicio de forma ilícita, contraria al orden público o en violación de los presentes Términos;",
                "compartir tu cuenta, revender o sublicenciar el acceso al Servicio;",
                "subir contenidos ilícitos, difamatorios, discriminatorios, que inciten al odio o a la violencia, o que vulneren derechos de terceros (incluidos los derechos de autor y a la privacidad);",
                "utilizar el Servicio para actividades de dopaje, para recomendaciones peligrosas para la salud o para eludir controles antidopaje;",
                "descompilar, realizar scraping, ingeniería inversa o extraer datos o modelos del Servicio, ni acceder a él con sistemas automatizados fuera de las interfaces previstas (API oficiales);",
                "utilizar el Servicio o sus resultados para entrenar modelos de IA de terceros o para desarrollar un producto competidor;",
                "interferir con la seguridad o la integridad del Servicio, intentar eludir sus medidas de seguridad o utilizarlo para ataques (DoS, spam, malware)."
              ]
            },
            {
              type: "p",
              text: "La violación de estas reglas conlleva la suspensión o cierre de la cuenta, la prohibición de reingresar con otra cuenta y, en casos graves, la denuncia a las autoridades competentes. Conforme al Reglamento de Servicios Digitales (Reg. (UE) 2022/2065), puedes **denunciar contenidos ilícitos** presentes en el Servicio escribiendo a **[EMAIL DE CONTACTO]**; las denuncias se gestionarán con diligencia e imparcialidad."
            }
          ]
        },
        {
          h: "6. Contenidos y datos del usuario",
          blocks: [
            {
              type: "p",
              text: "Conservas la titularidad de los datos y contenidos que introduces (p. ej. diarios de entrenamiento, datos de rendimiento, notas, imágenes) (\"**Contenidos del Usuario**\"). Nos concedes una licencia no exclusiva, gratuita y mundial para alojar, procesar, reproducir y mostrar los Contenidos del Usuario con el único fin de prestar, mantener, proteger y mejorar el Servicio, de conformidad con la Política de Privacidad. Garantizas que dispones de los derechos necesarios sobre los Contenidos del Usuario y que has obtenido el consentimiento de terceros que puedan aparecer o mencionarse."
            },
            {
              type: "p",
              text: "Puedes exportar tus Contenidos del Usuario en cualquier momento desde la configuración de tu cuenta en formato legible por máquina (portabilidad)."
            }
          ]
        },
        {
          h: "7. Contenidos generados por IA y transparencia (Reglamento de IA de la UE)",
          blocks: [
            {
              type: "p",
              text: "Los resultados de la IA se generan automáticamente sobre la base de modelos estadísticos y de la información que proporcionas. Pueden contener errores, omisiones o recomendaciones inadecuadas para tu caso individual. **No garantizamos** la exactitud, integridad o idoneidad de los resultados de la IA. Las decisiones sobre tu entrenamiento y tu salud siguen siendo exclusivamente tuyas (o de tu entrenador)."
            },
            {
              type: "p",
              text: "De conformidad con las obligaciones de transparencia previstas en el art. 50 del Reglamento (UE) 2024/1689 (\"**Reglamento de IA**\" o \"AI Act\"), aplicables desde el 2 de agosto de 2026:"
            },
            {
              type: "ul",
              items: [
                "el Servicio te **informa claramente cuando interactúas con un sistema de IA** (p. ej. asistente virtual, chat o sugeridor) y no con una persona;",
                "los contenidos generados o modificados sustancialmente por la IA dentro del Servicio (planes de entrenamiento, análisis de rendimiento, textos) se **identifican como generados por IA**;",
                "el Servicio **no** utiliza sistemas de reconocimiento de emociones ni de categorización biométrica, ni ninguna práctica prohibida por el art. 5 del Reglamento de IA (p. ej. social scoring, explotación de vulnerabilidades);",
                "los resultados de la IA están siempre sujetos a **supervisión humana**: son sugerencias y las decisiones finales te corresponden a ti o a tu entrenador;",
                "según nuestra evaluación, el Servicio **no es un sistema de IA de alto riesgo** conforme al Anexo III del Reglamento de IA. La evaluación está documentada y se revisa periódicamente."
              ]
            }
          ]
        },
        {
          h: "8. Propiedad intelectual",
          blocks: [
            {
              type: "p",
              text: "El Servicio, incluidos el software, los modelos, el diseño, las marcas, los logotipos, los contenidos editoriales y los materiales de entrenamiento predefinidos (excluidos los Contenidos del Usuario), es propiedad del Proveedor o de sus licenciantes y está protegido por las leyes de propiedad intelectual, derechos de autor y derechos sui generis sobre bases de datos. Los presentes Términos te conceden una licencia limitada, no exclusiva, intransferible y revocable para utilizar el Servicio con fines personales (o profesionales internos si eres entrenador/organización con un plan dedicado). No se concede ningún otro derecho. No puedes eliminar ni alterar marcas, avisos de copyright u otros signos de propiedad."
            }
          ]
        },
        {
          h: "9. Servicios de terceros e integraciones",
          blocks: [
            {
              type: "p",
              text: "El Servicio puede integrarse con servicios de terceros (p. ej. dispositivos wearables, calendarios, procesadores de pago, proveedores de IA). El uso de dichos servicios se rige por sus propios términos; no somos responsables de la funcionalidad, la disponibilidad o las prácticas de datos de esos terceros. La desactivación de una integración por el tercero o por ti no da derecho a reembolso."
            }
          ]
        },
        {
          h: "10. Disponibilidad y niveles de servicio",
          blocks: [
            {
              type: "p",
              text: "Nos esforzamos por mantener el Servicio disponible con la diligencia habitual del sector. Para los planes de pago perseguimos una **disponibilidad mensual igual o superior al 99,5%** sobre base anual, excluidos los tiempos de mantenimiento programado comunicados con antelación, los eventos de fuerza mayor y los fallos de servicios de terceros. No garantizamos un funcionamiento ininterrumpido o libre de errores. Los SLA y los eventuales créditos por interrupciones prolongadas, cuando se ofrezcan para un plan específico, se describen en la página de planes."
            }
          ]
        },
        {
          h: "11. Modificaciones del Servicio",
          blocks: [
            {
              type: "p",
              text: "Podemos modificar, suspender o interrumpir funcionalidades (incluso por mantenimiento o seguridad), notificando con antelación razonable los cambios sustanciales que afecten a funcionalidades de pago. En caso de interrupción definitiva de una funcionalidad de pago esencial, podrás solicitar un reembolso prorrateado de los importes prepagados no disfrutados."
            }
          ]
        },
        {
          h: "12. Exclusiones y limitaciones de responsabilidad",
          blocks: [
            {
              type: "p",
              text: "En la máxima medida permitida por la ley, el Servicio se presta \"tal cual\" y \"según disponibilidad\". **Nada en los presentes Términos excluye o limita la responsabilidad en los casos en que ello esté prohibido por la ley**, incluida la responsabilidad por dolo o culpa grave, por daños a las personas causados por nosotros y los derechos irrenunciables de los consumidores. Sin perjuicio de lo anterior, no respondemos de:"
            },
            {
              type: "ul",
              items: [
                "daños indirectos, incidentales o consecuenciales, lucro cesante, pérdida de oportunidades o daño reputacional;",
                "pérdida de datos no imputable a nosotros (p. ej. borrado accidental por ti o por terceros con los que compartas la cuenta);",
                "lesiones, sobreentrenamiento o consecuencias para la salud derivadas de decisiones de entrenamiento adoptadas utilizando el Servicio;",
                "eventos de **fuerza mayor** fuera de nuestro control razonable (catástrofes, guerra, huelgas, cortes de electricidad, ciberataques masivos, actos de autoridades, fallos de redes de terceros);",
                "actos de terceros (fabricantes de dispositivos, proveedores de IA, procesadores de pago)."
              ]
            },
            {
              type: "p",
              text: "Para los planes de pago, **nuestra responsabilidad total se limita al mayor de: (a) los importes que hayas abonado por el Servicio en los 12 meses anteriores al hecho que originó la reclamación, o (b) 100 EUR**. Este límite no se aplica a los casos en que la ley no permita limitar la responsabilidad."
            }
          ]
        },
        {
          h: "13. Indemnización",
          blocks: [
            {
              type: "p",
              text: "Te comprometes a indemnizar y mantener indemne al Proveedor, sus administradores, empleados y colaboradores frente a cualquier reclamación, daño, coste o gasto (incluidos honorarios de abogados razonables) derivado de: (i) tu uso del Servicio en violación de los presentes Términos o de la ley; (ii) contenidos que hayas subido vulnerando derechos de terceros; (iii) daños causados a terceros a través del Servicio."
            }
          ]
        },
        {
          h: "14. Resolución y suspensión",
          blocks: [
            {
              type: "p",
              text: "Puedes dejar de utilizar el Servicio y eliminar tu cuenta en cualquier momento desde la configuración. Podemos suspender o cerrar tu cuenta por incumplimiento sustancial de los Términos, uso ilícito, impago reiterado o razones de seguridad, con preaviso cuando sea razonablemente posible. Tras la resolución, cesa tu derecho a utilizar el Servicio; las cláusulas destinadas por su naturaleza a sobrevivir (propiedad intelectual, responsabilidad, ley aplicable, indemnización) permanecen en vigor. La conservación de los datos tras la resolución se rige por la Política de Privacidad."
            }
          ]
        },
        {
          h: "15. Modificación de los Términos",
          blocks: [
            {
              type: "p",
              text: "Podemos modificar los presentes Términos por razones legales, técnicas o comerciales. Los cambios sustanciales se comunicarán (por email o en la app) con **al menos 30 días** de antelación a su entrada en vigor. El uso continuado del Servicio tras dicha fecha constituye aceptación. En caso de desacuerdo, puedes cancelar tu suscripción antes de la entrada en vigor de los cambios, con reembolso prorrateado de los importes no disfrutados."
            }
          ]
        },
        {
          h: "16. Cesión",
          blocks: [
            {
              type: "p",
              text: "No puedes ceder los presentes Términos o los derechos que se derivan de ellos sin nuestro consentimiento previo por escrito. El Proveedor puede ceder el contrato a una filial o tercero en el contexto de operaciones societarias (fusión, transmisión de rama de actividad, etc.), previa comunicación razonable y sin merma de tus derechos sustantivos."
            }
          ]
        },
        {
          h: "17. Comunicaciones",
          blocks: [
            {
              type: "p",
              text: "Las comunicaciones oficiales se enviarán a la dirección de email asociada a tu cuenta; es tu responsabilidad mantenerla actualizada. También podemos comunicarnos in-app cuando sea oportuno. Tus comunicaciones al Proveedor deben enviarse a **[EMAIL DE CONTACTO]**."
            }
          ]
        },
        {
          h: "18. Reclamaciones, ODR y ley aplicable",
          blocks: [
            {
              type: "p",
              text: "Los presentes Términos se rigen por la **ley italiana**. Para los consumidores quedan a salvo las normas imperativas del país de residencia habitual y es competente el tribunal del lugar de residencia o domicilio del consumidor. Para los usuarios profesionales serán exclusivamente competentes los tribunales de **[FUERO COMPETENTE]**."
            },
            {
              type: "p",
              text: "Antes de iniciar acciones judiciales, te invitamos a contactarnos en **[EMAIL DE CONTACTO]** para una solución amistosa. Los consumidores de la UE también pueden utilizar la plataforma europea de resolución de litigios en línea (ODR): https://ec.europa.eu/consumers/odr."
            }
          ]
        },
        {
          h: "19. Contacto",
          blocks: [
            {
              type: "p",
              text: "**[RAZÓN SOCIAL / NOMBRE DEL TITULAR]** — **[DOMICILIO SOCIAL]** — email **[EMAIL DE CONTACTO]** — PEC **[EMAIL CERTIFICADO (PEC)]**."
            }
          ]
        }
      ]
    }
  },
  privacy: {
    it: {
      title: "Informativa Privacy (GDPR)",
      updated: "Ultimo aggiornamento: 21 luglio 2026 · Versione 2.0",
      tldr: {
        title: "In breve (non sostituisce il testo integrale)",
        items: [
          "Trattiamo i tuoi dati per farti usare TrainMind AI: account, allenamenti, analisi IA, pagamenti, sicurezza.",
          "I dati di salute e fitness sono trattati **solo con il tuo consenso esplicito** e puoi revocarlo in ogni momento.",
          "Alcuni fornitori (es. hosting, IA) possono avere sede fuori dall'UE: usiamo garanzie di legge (adeguatezza o SCC).",
          "Puoi accedere, rettificare, cancellare, esportare i tuoi dati e proporre reclamo al Garante.",
          "Non vendiamo i tuoi dati e **non li usiamo per addestrare modelli di IA di terzi**."
        ]
      },
      intro: [
        {
          type: "p",
          text: "La presente Informativa descrive come **[RAGIONE SOCIALE / NOME TITOLARE]**, con sede legale in **[SEDE LEGALE]** (il \"**Titolare**\"), tratta i dati personali degli utenti della piattaforma TrainMind AI (il \"**Servizio**\"), ai sensi del Regolamento (UE) 2016/679 (\"**GDPR**\") e del D.lgs. 196/2003 e s.m.i. (\"Codice Privacy\"). Contatto privacy: **[EMAIL PRIVACY]**. DPO: **[EMAIL DPO se nominato]**."
        },
        {
          type: "p",
          text: "La versione italiana è la **versione ufficiale** e prevale su qualsiasi traduzione in caso di discrepanza."
        }
      ],
      sections: [
        {
          h: "1. Dati trattati",
          blocks: [
            {
              type: "ul",
              items: [
                "**Dati di account**: nome, indirizzo email, password (cifrata con hashing), data di nascita, ruolo (atleta/allenatore), sport, lingua preferita, informazioni di profilo.",
                "**Dati relativi alla salute e al fitness** (categorie particolari, art. 9 GDPR): sessioni di allenamento, carichi, prestazioni, parametri corporei (es. peso, frequenza cardiaca ove forniti da wearable), sforzo percepito (RPE), qualità del sonno, mood/wellness, infortuni o limitazioni fisiche che scegli di registrare, note antropometriche.",
                "**Dati di pagamento**: piano di abbonamento, storico transazioni, ultime 4 cifre della carta, indirizzo di fatturazione. I dati completi della carta sono trattati direttamente dal fornitore di pagamento (Stripe) e non sono mai conservati da noi.",
                "**Dati di utilizzo e del dispositivo**: log, indirizzo IP, tipo di dispositivo/browser, sistema operativo, interazioni con l'app, cookie e tecnologie simili (v. Cookie Policy).",
                "**Comunicazioni**: richieste di assistenza, corrispondenza, feedback.",
                "**Contenuti IA**: prompt inviati all'assistente IA e output ricevuti, con collegamento al tuo account."
              ]
            }
          ]
        },
        {
          h: "2. Finalità e basi giuridiche",
          blocks: [
            {
              type: "table",
              head: [
                "Finalità",
                "Dati",
                "Base giuridica (GDPR)"
              ],
              rows: [
                [
                  "Erogazione del Servizio: account, piani di allenamento, monitoraggio, sincronizzazione, chat IA",
                  "Dati di account e utilizzo, contenuti IA",
                  "Art. 6(1)(b) — contratto"
                ],
                [
                  "Suggerimenti di allenamento basati su IA e analisi delle prestazioni con dati di salute/fitness",
                  "Dati salute e fitness",
                  "Art. 9(2)(a) — consenso esplicito"
                ],
                [
                  "Fatturazione e gestione abbonamenti",
                  "Dati di account e pagamento",
                  "Art. 6(1)(b) contratto; art. 6(1)(c) obblighi di legge"
                ],
                [
                  "Sicurezza del Servizio, prevenzione frodi e abusi, resilienza",
                  "Dati di utilizzo e dispositivo",
                  "Art. 6(1)(f) — legittimo interesse"
                ],
                [
                  "Miglioramento del prodotto e statistiche aggregate",
                  "Dati di utilizzo (aggregati/pseudonimizzati)",
                  "Art. 6(1)(f) — legittimo interesse"
                ],
                [
                  "Comunicazioni di servizio (transazionali) e notifiche in-app essenziali",
                  "Email, dati di account",
                  "Art. 6(1)(b) — contratto"
                ],
                [
                  "Comunicazioni di marketing (newsletter, offerte, sondaggi)",
                  "Email, dati di account",
                  "Art. 6(1)(a) — consenso (revocabile in ogni momento)"
                ],
                [
                  "Cookie analitici e di marketing",
                  "Dati cookie/dispositivo",
                  "Consenso (v. Cookie Policy)"
                ],
                [
                  "Adempimento di obblighi di legge (fiscali, contabili, DSA, AI Act, richieste delle autorità)",
                  "Dati di account e pagamento",
                  "Art. 6(1)(c) — obbligo legale"
                ],
                [
                  "Difesa in giudizio ed esercizio di diritti",
                  "Dati necessari alla difesa",
                  "Art. 6(1)(f) / 9(2)(f) — legittimo interesse / esercizio di diritti in sede giudiziaria"
                ]
              ]
            },
            {
              type: "p",
              text: "**I dati relativi alla salute e al fitness sono trattati solo con il tuo consenso esplicito**, richiesto in fase di registrazione o all'attivazione delle relative funzionalità. Puoi revocare il consenso in qualsiasi momento dalle impostazioni dell'account o scrivendo a **[EMAIL PRIVACY]**; la revoca non pregiudica i trattamenti effettuati in precedenza, ma alcune funzionalità (es. piani di allenamento IA) non saranno più disponibili."
            }
          ]
        },
        {
          h: "3. Trattamenti tramite IA e decisioni automatizzate",
          blocks: [
            {
              type: "p",
              text: "Il Servizio utilizza modelli di IA per generare suggerimenti di allenamento e analisi a partire dai tuoi dati. Si tratta di una forma di profilazione limitata a finalità sportive/di fitness. **Nessuna decisione che produca effetti giuridici o incida in modo analogo significativo su di te è adottata unicamente mediante trattamento automatizzato** ai sensi dell'art. 22 GDPR: gli output dell'IA sono suggerimenti che tu (o il tuo allenatore) restate liberi di accettare, modificare o ignorare."
            },
            {
              type: "p",
              text: "Ove siano utilizzati fornitori terzi di IA (es. **[FORNITORE/I IA]**), questi agiscono come responsabili del trattamento ex art. 28 GDPR e **hanno il divieto contrattuale di utilizzare i tuoi dati per addestrare i propri modelli**; ove necessario i dati sono minimizzati o pseudonimizzati prima dell'invio. Puoi richiedere una revisione umana o contestare qualsiasi output che ti riguardi in modo significativo scrivendo a **[EMAIL PRIVACY]**."
            },
            {
              type: "p",
              text: "**AI Act (Regolamento (UE) 2024/1689).** Le funzionalità di IA del Servizio rientrano nel regime di trasparenza dell'art. 50 dell'AI Act, applicabile dal 2 agosto 2026: sei informato quando interagisci con un sistema di IA e i contenuti generati dall'IA sono identificati come tali all'interno del Servizio. Sulla base della nostra valutazione, il Servizio **non è un sistema di IA ad alto rischio** ai sensi dell'Allegato III dell'AI Act, non effettua riconoscimento delle emozioni né categorizzazione biometrica e non pone in essere alcuna pratica vietata dall'art. 5. Tale valutazione è documentata e viene riesaminata alla luce delle linee guida della Commissione Europea e delle modifiche successive (incluso il regolamento \"AI Digital Omnibus\" del 2026)."
            }
          ]
        },
        {
          h: "4. Destinatari e responsabili del trattamento",
          blocks: [
            {
              type: "p",
              text: "I dati possono essere comunicati a: (i) fornitori tecnici nominati responsabili del trattamento (hosting e infrastruttura cloud, es. **[FORNITORE HOSTING]**; invio email transazionali; pagamenti — Stripe; analytics; fornitori di modelli IA); (ii) allenatori o staff che decidi espressamente di collegare tramite il Servizio (in tal caso l'allenatore agisce come **contitolare o responsabile autonomo** a seconda del contesto, disciplinato da apposito accordo ex art. 26 o 28 GDPR); (iii) autorità competenti nei casi previsti dalla legge; (iv) consulenti professionali tenuti al segreto. L'**elenco aggiornato dei responsabili** è disponibile su richiesta a **[EMAIL PRIVACY]**. **Non vendiamo i tuoi dati personali** e non li scambiamo con broker pubblicitari."
            }
          ]
        },
        {
          h: "5. Trasferimenti extra-SEE",
          blocks: [
            {
              type: "p",
              text: "Alcuni fornitori possono essere stabiliti al di fuori dello Spazio Economico Europeo (es. Stati Uniti). In tali casi i trasferimenti avvengono sulla base di:"
            },
            {
              type: "ul",
              items: [
                "una **decisione di adeguatezza** della Commissione Europea (incluso l'EU-U.S. Data Privacy Framework, ove il destinatario sia certificato);",
                "**Clausole Contrattuali Standard (SCC)** ex art. 46 GDPR, con eventuali misure supplementari (cifratura, pseudonimizzazione, contratti rafforzati) individuate a seguito di una valutazione d'impatto sui trasferimenti (TIA);",
                "**deroghe** ex art. 49 GDPR nei limitati casi in cui siano applicabili."
              ]
            },
            {
              type: "p",
              text: "Copia delle garanzie è disponibile su richiesta a **[EMAIL PRIVACY]**."
            }
          ]
        },
        {
          h: "6. Conservazione",
          blocks: [
            {
              type: "ul",
              items: [
                "Dati di account e profilo: per tutta la durata dell'account, poi cancellati o anonimizzati entro **30 giorni** dalla cancellazione (fatti salvi obblighi di conservazione più lunghi).",
                "Dati salute e fitness: fino alla revoca del consenso o alla cancellazione dell'account, poi cancellati o anonimizzati in modo irreversibile.",
                "Contenuti IA (prompt e output): per la durata dell'account e comunque per un massimo di **24 mesi** ai fini di sicurezza, debug e miglioramento.",
                "Documentazione contabile e fiscale: **10 anni** (obbligo di legge).",
                "Log di sicurezza: fino a **12 mesi**.",
                "Consensi marketing e dati di contatto: fino alla revoca o dopo **24 mesi** di inattività.",
                "Backup: sovrascritti secondo un ciclo di rotazione non superiore a **90 giorni**."
              ]
            }
          ]
        },
        {
          h: "7. I tuoi diritti",
          blocks: [
            {
              type: "p",
              text: "Ai sensi degli artt. 15–22 GDPR hai diritto di: **accedere** ai tuoi dati; ottenerne la **rettifica** o la **cancellazione** (\"diritto all'oblio\"); **limitare** il trattamento; **opporti** ai trattamenti basati sul legittimo interesse; ricevere i tuoi dati in **formato portabile**; **revocare il consenso** in qualsiasi momento senza pregiudizio per i trattamenti precedenti. Per esercitare i diritti scrivi a **[EMAIL PRIVACY]** oppure utilizza gli strumenti self-service nelle impostazioni dell'account (esportazione ed eliminazione). Rispondiamo entro **un mese** (prorogabile di due mesi nei casi complessi)."
            },
            {
              type: "p",
              text: "Hai inoltre diritto di proporre **reclamo** al **Garante per la protezione dei dati personali** (www.garanteprivacy.it) o all'autorità di controllo del tuo luogo di residenza."
            }
          ]
        },
        {
          h: "8. Minori",
          blocks: [
            {
              type: "p",
              text: "Il Servizio è destinato a utenti di età pari o superiore a **14 anni**. In Italia, il minore che abbia compiuto 14 anni può esprimere validamente il consenso al trattamento dei propri dati personali in relazione ai servizi della società dell'informazione (art. 2-quinquies, D.lgs. 196/2003). Per gli utenti minori di 18 anni, il consenso al trattamento di dati salute/fitness e l'accettazione contrattuale richiedono il **modulo di consenso genitoriale** firmato dal genitore o tutore. Se venissimo a conoscenza di dati raccolti da un minore di 14 anni senza valido consenso dei genitori, provvederemo alla cancellazione senza indebito ritardo."
            }
          ]
        },
        {
          h: "9. Sicurezza",
          blocks: [
            {
              type: "p",
              text: "Adottiamo misure tecniche e organizzative adeguate al rischio (art. 32 GDPR), tra cui: cifratura in transito (TLS) e a riposo dei dati sensibili, hashing delle password (algoritmi resistenti), controlli di accesso basati su ruolo (RBAC), autenticazione a più fattori sui sistemi interni, backup cifrati con test di ripristino, segregazione degli ambienti, logging e monitoraggio, gestione delle vulnerabilità, formazione del personale, valutazioni d'impatto (DPIA). Nessun sistema è completamente sicuro; **in caso di violazione di dati personali** agiremo in conformità agli artt. 33–34 GDPR (notifica al Garante entro 72 ore e, se necessario, comunicazione agli interessati)."
            }
          ]
        },
        {
          h: "10. Modifiche",
          blocks: [
            {
              type: "p",
              text: "Potremo aggiornare la presente Informativa; le modifiche sostanziali saranno comunicate tramite il Servizio o via email con almeno 15 giorni di anticipo. La data in alto indica la versione più recente. Manteniamo uno storico delle versioni disponibile su richiesta."
            }
          ]
        },
        {
          h: "11. Contatti",
          blocks: [
            {
              type: "p",
              text: "Titolare: **[RAGIONE SOCIALE / NOME TITOLARE]** — **[SEDE LEGALE]** — **[EMAIL PRIVACY]**. DPO: **[EMAIL DPO se nominato]**."
            }
          ]
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      updated: "Last updated: 21 July 2026 · Version 2.0",
      tldr: {
        title: "At a glance (does not replace the full text)",
        items: [
          "We process your data to run TrainMind AI: account, workouts, AI analyses, payments, security.",
          "Health and fitness data are processed **only with your explicit consent** — you can withdraw it any time.",
          "Some providers (e.g. hosting, AI) may be outside the EU: we use legal safeguards (adequacy or SCC).",
          "You can access, rectify, delete, export your data and complain to the Garante.",
          "We do not sell your data and **we do not use it to train third-party AI models**."
        ]
      },
      intro: [
        {
          type: "p",
          text: "This Privacy Policy describes how **[COMPANY NAME / OWNER NAME]**, with registered office at **[REGISTERED ADDRESS]** (the \"**Controller**\", \"**we**\"), processes personal data of users of the TrainMind AI platform (the \"**Service**\"), in accordance with Regulation (EU) 2016/679 (\"**GDPR**\") and Italian Legislative Decree 196/2003 as amended. Privacy contact: **[PRIVACY CONTACT EMAIL]**. DPO: **[DPO EMAIL if appointed]**."
        },
        {
          type: "p",
          text: "The Italian version is the **controlling version** and prevails over any translation in case of discrepancy."
        }
      ],
      sections: [
        {
          h: "1. Data we process",
          blocks: [
            {
              type: "ul",
              items: [
                "**Account data**: name, email, password (hashed), date of birth, role (athlete/coach), sport, preferred language, profile information.",
                "**Health and fitness data** (special category, Art. 9 GDPR): training sessions, loads, performance, body metrics (e.g. weight, heart rate from wearables), perceived exertion (RPE), sleep quality, mood/wellness, injuries or physical limitations you choose to record, anthropometric notes.",
                "**Payment data**: subscription plan, transaction history, last 4 card digits, billing address. Full card details are processed by our payment provider (Stripe) and never stored by us.",
                "**Usage and device data**: logs, IP address, device/browser type, operating system, app interactions, cookies and similar technologies (see the Cookie Policy).",
                "**Communications**: support requests, correspondence, feedback.",
                "**AI content**: prompts sent to the AI assistant and outputs received, linked to your account."
              ]
            }
          ]
        },
        {
          h: "2. Purposes and legal bases",
          blocks: [
            {
              type: "table",
              head: [
                "Purpose",
                "Data",
                "Legal basis (GDPR)"
              ],
              rows: [
                [
                  "Providing the Service: account, training plans, tracking, sync, AI chat",
                  "Account and usage data, AI content",
                  "Art. 6(1)(b) — contract"
                ],
                [
                  "AI-based training suggestions and performance analysis using fitness/health data",
                  "Health & fitness data",
                  "Art. 9(2)(a) — explicit consent"
                ],
                [
                  "Billing and subscription management",
                  "Account, payment data",
                  "Art. 6(1)(b) contract; Art. 6(1)(c) legal obligations"
                ],
                [
                  "Service security, fraud/abuse prevention, resilience",
                  "Usage, device data",
                  "Art. 6(1)(f) — legitimate interest"
                ],
                [
                  "Product improvement and aggregate statistics",
                  "Usage data (aggregated/pseudonymised)",
                  "Art. 6(1)(f) — legitimate interest"
                ],
                [
                  "Service communications (transactional) and essential in-app notices",
                  "Email, account data",
                  "Art. 6(1)(b) — contract"
                ],
                [
                  "Marketing communications (newsletter, offers, surveys)",
                  "Email, account data",
                  "Art. 6(1)(a) — consent (revocable any time)"
                ],
                [
                  "Analytics and marketing cookies",
                  "Cookie/device data",
                  "Consent (see Cookie Policy)"
                ],
                [
                  "Legal obligations (tax, accounting, DSA, AI Act, authority requests)",
                  "Account, payment data",
                  "Art. 6(1)(c) — legal obligation"
                ],
                [
                  "Legal defence and enforcement of rights",
                  "Data needed for the defence",
                  "Art. 6(1)(f) / 9(2)(f)"
                ]
              ]
            },
            {
              type: "p",
              text: "**Health and fitness data are processed only with your explicit consent**, requested at registration or when you activate the relevant features. You may withdraw consent at any time from your account settings or by writing to **[PRIVACY CONTACT EMAIL]**; withdrawal does not affect processing carried out before withdrawal, but some features (e.g. AI training plans) will no longer be available."
            }
          ]
        },
        {
          h: "3. AI processing and automated decision-making",
          blocks: [
            {
              type: "p",
              text: "The Service uses AI models to generate training suggestions and analyses from your data. This constitutes profiling limited to sports/fitness purposes. **No decision producing legal effects or similarly significant effects on you is taken solely by automated means** under Art. 22 GDPR: AI outputs are suggestions that you (or your coach) remain free to accept, modify or ignore."
            },
            {
              type: "p",
              text: "Where third-party AI providers are used (e.g. **[AI PROVIDER(S)]**), they act as processors under Art. 28 GDPR and **are contractually prohibited from using your data to train their models**; where necessary, data is minimised or pseudonymised before submission. You may request human review of, or contest, any output that significantly affects you by writing to **[PRIVACY CONTACT EMAIL]**."
            },
            {
              type: "p",
              text: "**EU AI Act (Reg. (EU) 2024/1689).** The AI features of the Service fall within the transparency regime of Article 50 of the AI Act, applicable from 2 August 2026: you are informed when you interact with an AI system, and AI-generated content is identified as such. Based on our assessment, the Service is **not a high-risk AI system** under Annex III of the AI Act, does not perform emotion recognition or biometric categorisation, and does not engage in any practice prohibited under Article 5. This assessment is documented and reviewed in light of European Commission guidance and subsequent amendments (including the 2026 \"AI Digital Omnibus\" regulation)."
            }
          ]
        },
        {
          h: "4. Recipients and processors",
          blocks: [
            {
              type: "p",
              text: "Data may be shared with: (i) technical suppliers appointed as processors (hosting and cloud infrastructure, e.g. **[HOSTING PROVIDER]**; transactional email; payments — Stripe; analytics; AI model providers); (ii) coaches or team staff you explicitly connect through the Service (the coach then acts as **joint controller or independent controller** depending on context, governed by an Art. 26 or Art. 28 GDPR agreement); (iii) competent authorities where required by law; (iv) professional advisors bound by confidentiality. An **updated list of processors** is available on request at **[PRIVACY CONTACT EMAIL]**. **We do not sell your personal data** and do not trade it with advertising brokers."
            }
          ]
        },
        {
          h: "5. Transfers outside the EEA",
          blocks: [
            {
              type: "p",
              text: "Some suppliers may be established outside the European Economic Area (e.g. the United States). In such cases, transfers take place on the basis of:"
            },
            {
              type: "ul",
              items: [
                "a Commission **adequacy decision** (including the EU-U.S. Data Privacy Framework where the recipient is certified);",
                "**Standard Contractual Clauses (SCC)** under Art. 46 GDPR, with supplementary measures (encryption, pseudonymisation, strengthened contracts) identified through a transfer impact assessment (TIA);",
                "**derogations** under Art. 49 GDPR in the limited cases where they apply."
              ]
            },
            {
              type: "p",
              text: "Copies of the safeguards are available on request at **[PRIVACY CONTACT EMAIL]**."
            }
          ]
        },
        {
          h: "6. Retention",
          blocks: [
            {
              type: "ul",
              items: [
                "Account and profile data: for as long as the account is active, then deleted or anonymised within **30 days** of deletion (subject to longer legal retention obligations).",
                "Health and fitness data: until consent is withdrawn or the account is deleted, then irreversibly deleted or anonymised.",
                "AI content (prompts and outputs): for the account lifetime and up to **24 months** for security, debugging and improvement purposes.",
                "Billing and tax records: **10 years** (Italian legal obligation).",
                "Security logs: up to **12 months**.",
                "Marketing consents and contact data: until withdrawal or after **24 months** of inactivity.",
                "Backups: overwritten on a rotation cycle of no more than **90 days**."
              ]
            }
          ]
        },
        {
          h: "7. Your rights",
          blocks: [
            {
              type: "p",
              text: "Under Arts. 15–22 GDPR you have the right to: **access** your data; obtain **rectification** or **erasure** (\"right to be forgotten\"); **restrict** processing; **object** to processing based on legitimate interest; receive your data in **portable format**; **withdraw consent** any time without affecting prior processing. To exercise your rights, write to **[PRIVACY CONTACT EMAIL]** or use the self-service tools in account settings (export and deletion). We reply within **one month** (extendable by two months in complex cases)."
            },
            {
              type: "p",
              text: "You also have the right to lodge a **complaint** with the Italian supervisory authority, the **Garante per la protezione dei dati personali** (www.garanteprivacy.it), or with the supervisory authority of your place of residence."
            }
          ]
        },
        {
          h: "8. Minors",
          blocks: [
            {
              type: "p",
              text: "The Service is intended for users aged **14 or over**. In Italy, users aged 14 or over may validly consent to the processing of their personal data in relation to information society services (Art. 2-quinquies, Legislative Decree 196/2003). For users under 18, consent to processing of health/fitness data and contractual acceptance require the **parental consent form** signed by a parent or guardian. If we become aware of data collected from a child under 14 without valid parental consent, we will delete it without undue delay."
            }
          ]
        },
        {
          h: "9. Security",
          blocks: [
            {
              type: "p",
              text: "We apply appropriate technical and organisational measures for the risk (Art. 32 GDPR): encryption in transit (TLS) and at rest for sensitive data, password hashing (resistant algorithms), role-based access controls (RBAC), multi-factor authentication for internal systems, encrypted backups with recovery tests, environment segregation, logging and monitoring, vulnerability management, staff training, data protection impact assessments (DPIA). No system is completely secure; **in the event of a personal data breach** we will act in accordance with Arts. 33–34 GDPR (notification to the Garante within 72 hours and, where necessary, communication to data subjects)."
            }
          ]
        },
        {
          h: "10. Changes",
          blocks: [
            {
              type: "p",
              text: "We may update this Policy; material changes will be notified via the Service or by email at least 15 days in advance. The date at the top indicates the latest version. Version history is available on request."
            }
          ]
        },
        {
          h: "11. Contact",
          blocks: [
            {
              type: "p",
              text: "Controller: **[COMPANY NAME / OWNER NAME]** — **[REGISTERED ADDRESS]** — **[PRIVACY CONTACT EMAIL]**. DPO: **[DPO EMAIL if appointed]**."
            }
          ]
        }
      ]
    },
    es: {
      title: "Política de Privacidad (RGPD)",
      updated: "Última actualización: 21 de julio de 2026 · Versión 2.0",
      tldr: {
        title: "En resumen (no sustituye al texto íntegro)",
        items: [
          "Tratamos tus datos para que puedas usar TrainMind AI: cuenta, entrenamientos, análisis con IA, pagos, seguridad.",
          "Los datos de salud y fitness se tratan **solo con tu consentimiento explícito** — puedes revocarlo en cualquier momento.",
          "Algunos proveedores (p. ej. hosting, IA) pueden estar fuera de la UE: usamos garantías legales (adecuación o SCC).",
          "Puedes acceder, rectificar, suprimir, exportar tus datos y presentar una reclamación ante la autoridad.",
          "No vendemos tus datos y **no los usamos para entrenar modelos de IA de terceros**."
        ]
      },
      intro: [
        {
          type: "p",
          text: "La presente Política describe cómo **[RAZÓN SOCIAL / NOMBRE DEL TITULAR]**, con domicilio social en **[DOMICILIO SOCIAL]** (el \"**Responsable del tratamiento**\"), trata los datos personales de los usuarios de la plataforma TrainMind AI (el \"**Servicio**\"), de conformidad con el Reglamento (UE) 2016/679 (\"**RGPD**\") y el D.lgs. italiano 196/2003 y sus modificaciones. Contacto de privacidad: **[EMAIL DE PRIVACIDAD]**. DPO: **[EMAIL DEL DPO si designado]**."
        },
        {
          type: "p",
          text: "La versión italiana es la **versión oficial** y prevalece sobre cualquier traducción en caso de discrepancia."
        }
      ],
      sections: [
        {
          h: "1. Datos tratados",
          blocks: [
            {
              type: "ul",
              items: [
                "**Datos de cuenta**: nombre, email, contraseña (cifrada), fecha de nacimiento, rol (atleta/entrenador), deporte, idioma preferido, información de perfil.",
                "**Datos de salud y fitness** (categorías especiales, art. 9 RGPD): sesiones de entrenamiento, cargas, rendimiento, parámetros corporales (p. ej. peso, frecuencia cardíaca desde wearables), esfuerzo percibido (RPE), calidad del sueño, estado de ánimo/wellness, lesiones o limitaciones físicas que decidas registrar, notas antropométricas.",
                "**Datos de pago**: plan de suscripción, historial de transacciones, últimos 4 dígitos de la tarjeta, dirección de facturación. Los datos completos de la tarjeta son tratados por el proveedor de pagos (Stripe) y nunca son almacenados por nosotros.",
                "**Datos de uso y del dispositivo**: registros (logs), IP, tipo de dispositivo/navegador, sistema operativo, interacciones con la app, cookies y tecnologías similares (véase la Política de Cookies).",
                "**Comunicaciones**: solicitudes de asistencia, correspondencia, feedback.",
                "**Contenido de IA**: prompts enviados al asistente de IA y resultados recibidos, vinculados a tu cuenta."
              ]
            }
          ]
        },
        {
          h: "2. Finalidades y bases jurídicas",
          blocks: [
            {
              type: "table",
              head: [
                "Finalidad",
                "Datos",
                "Base jurídica (RGPD)"
              ],
              rows: [
                [
                  "Prestación del Servicio: cuenta, planes de entrenamiento, monitorización, sincronización, chat de IA",
                  "Datos de cuenta y uso, contenido de IA",
                  "Art. 6(1)(b) — contrato"
                ],
                [
                  "Sugerencias de entrenamiento basadas en IA y análisis de rendimiento con datos de salud/fitness",
                  "Datos de salud y fitness",
                  "Art. 9(2)(a) — consentimiento explícito"
                ],
                [
                  "Facturación y gestión de suscripciones",
                  "Datos de cuenta y pago",
                  "Art. 6(1)(b) contrato; art. 6(1)(c) obligaciones legales"
                ],
                [
                  "Seguridad del Servicio, prevención de fraudes/abusos, resiliencia",
                  "Datos de uso y dispositivo",
                  "Art. 6(1)(f) — interés legítimo"
                ],
                [
                  "Mejora del producto y estadísticas agregadas",
                  "Datos de uso (agregados/seudonimizados)",
                  "Art. 6(1)(f) — interés legítimo"
                ],
                [
                  "Comunicaciones de servicio (transaccionales) y avisos in-app esenciales",
                  "Email, datos de cuenta",
                  "Art. 6(1)(b) — contrato"
                ],
                [
                  "Comunicaciones de marketing (newsletter, ofertas, encuestas)",
                  "Email, datos de cuenta",
                  "Art. 6(1)(a) — consentimiento (revocable en cualquier momento)"
                ],
                [
                  "Cookies analíticas y de marketing",
                  "Datos de cookies/dispositivo",
                  "Consentimiento (véase la Política de Cookies)"
                ],
                [
                  "Cumplimiento de obligaciones legales (fiscales, contables, DSA, Reglamento de IA, requerimientos de autoridades)",
                  "Datos de cuenta y pago",
                  "Art. 6(1)(c) — obligación legal"
                ],
                [
                  "Defensa jurídica y ejercicio de derechos",
                  "Datos necesarios para la defensa",
                  "Art. 6(1)(f) / 9(2)(f)"
                ]
              ]
            },
            {
              type: "p",
              text: "**Los datos de salud y fitness se tratan únicamente con tu consentimiento explícito**, solicitado en el registro o al activar las funcionalidades correspondientes. Puedes revocar el consentimiento en cualquier momento desde la configuración de tu cuenta o escribiendo a **[EMAIL DE PRIVACIDAD]**; la revocación no afecta a los tratamientos realizados con anterioridad, pero algunas funcionalidades (p. ej. planes de entrenamiento con IA) dejarán de estar disponibles."
            }
          ]
        },
        {
          h: "3. Tratamientos mediante IA y decisiones automatizadas",
          blocks: [
            {
              type: "p",
              text: "El Servicio utiliza modelos de IA para generar sugerencias de entrenamiento y análisis a partir de tus datos. Se trata de una forma de elaboración de perfiles limitada a fines deportivos/de fitness. **Ninguna decisión que produzca efectos jurídicos o te afecte de modo significativo similar se adopta únicamente mediante tratamiento automatizado** en el sentido del art. 22 RGPD: los resultados de la IA son sugerencias que tú (o tu entrenador) sois libres de aceptar, modificar o ignorar."
            },
            {
              type: "p",
              text: "Cuando se utilicen proveedores externos de IA (p. ej. **[PROVEEDOR/ES DE IA]**), estos actúan como encargados del tratamiento conforme al art. 28 RGPD y **tienen prohibido contractualmente utilizar tus datos para entrenar sus modelos**; cuando sea necesario, los datos se minimizan o seudonimizan antes del envío. Puedes solicitar una revisión humana o impugnar cualquier resultado que te afecte de modo significativo escribiendo a **[EMAIL DE PRIVACIDAD]**."
            },
            {
              type: "p",
              text: "**Reglamento de IA de la UE (Reglamento (UE) 2024/1689).** Las funcionalidades de IA del Servicio están sujetas al régimen de transparencia del art. 50 del Reglamento de IA, aplicable desde el 2 de agosto de 2026: se te informa cuando interactúas con un sistema de IA y los contenidos generados por IA se identifican como tales dentro del Servicio. Según nuestra evaluación, el Servicio **no es un sistema de IA de alto riesgo** conforme al Anexo III del Reglamento de IA, no realiza reconocimiento de emociones ni categorización biométrica y no lleva a cabo ninguna práctica prohibida por el art. 5. Esta evaluación está documentada y se revisa a la luz de las directrices de la Comisión Europea y de las modificaciones posteriores (incluido el reglamento \"AI Digital Omnibus\" de 2026)."
            }
          ]
        },
        {
          h: "4. Destinatarios y encargados del tratamiento",
          blocks: [
            {
              type: "p",
              text: "Los datos pueden comunicarse a: (i) proveedores técnicos designados encargados del tratamiento (alojamiento e infraestructura cloud, p. ej. **[PROVEEDOR DE HOSTING]**; envío de emails transaccionales; pagos — Stripe; analítica; proveedores de modelos de IA); (ii) entrenadores o personal que decidas expresamente vincular a través del Servicio (el entrenador actúa entonces como **corresponsable o responsable autónomo**, según el contexto, regulado por un acuerdo conforme al art. 26 o art. 28 RGPD); (iii) autoridades competentes en los casos previstos por la ley; (iv) asesores profesionales sujetos a secreto. La **lista actualizada de encargados** está disponible previa solicitud en **[EMAIL DE PRIVACIDAD]**. **No vendemos tus datos personales** y no los intercambiamos con brokers publicitarios."
            }
          ]
        },
        {
          h: "5. Transferencias fuera del EEE",
          blocks: [
            {
              type: "p",
              text: "Algunos proveedores pueden estar establecidos fuera del Espacio Económico Europeo (p. ej. Estados Unidos). En tales casos, las transferencias se realizan sobre la base de:"
            },
            {
              type: "ul",
              items: [
                "una **decisión de adecuación** de la Comisión Europea (incluido el EU-U.S. Data Privacy Framework, cuando el destinatario esté certificado);",
                "**Cláusulas Contractuales Tipo (SCC)** conforme al art. 46 RGPD, con medidas complementarias (cifrado, seudonimización, contratos reforzados) identificadas mediante una evaluación de impacto sobre las transferencias (TIA);",
                "**excepciones** conforme al art. 49 RGPD en los limitados casos en que sean aplicables."
              ]
            },
            {
              type: "p",
              text: "Hay copia de las garantías disponible previa solicitud en **[EMAIL DE PRIVACIDAD]**."
            }
          ]
        },
        {
          h: "6. Conservación",
          blocks: [
            {
              type: "ul",
              items: [
                "Datos de cuenta y perfil: mientras la cuenta esté activa; después se eliminan o anonimizan en un plazo de **30 días** desde la cancelación (sin perjuicio de obligaciones legales de conservación más largas).",
                "Datos de salud y fitness: hasta la revocación del consentimiento o la eliminación de la cuenta; después se eliminan o anonimizan de forma irreversible.",
                "Contenido de IA (prompts y resultados): durante la vida de la cuenta y hasta **24 meses** por motivos de seguridad, depuración y mejora.",
                "Documentación contable y fiscal: **10 años** (obligación legal italiana).",
                "Registros de seguridad: hasta **12 meses**.",
                "Consentimientos de marketing y datos de contacto: hasta la revocación o tras **24 meses** de inactividad.",
                "Copias de seguridad: se sobrescriben en un ciclo de rotación no superior a **90 días**."
              ]
            }
          ]
        },
        {
          h: "7. Tus derechos",
          blocks: [
            {
              type: "p",
              text: "En virtud de los arts. 15–22 RGPD tienes derecho a: **acceder** a tus datos; obtener su **rectificación** o **supresión** (\"derecho al olvido\"); **limitar** el tratamiento; **oponerte** a los tratamientos basados en el interés legítimo; recibir tus datos en un **formato portable** (portabilidad); **revocar el consentimiento** en cualquier momento sin perjuicio de los tratamientos anteriores. Para ejercer tus derechos, escribe a **[EMAIL DE PRIVACIDAD]** o utiliza las herramientas self-service en la configuración de la cuenta (exportación y supresión). Respondemos en el plazo de **un mes** (prorrogable en dos meses en casos complejos)."
            },
            {
              type: "p",
              text: "También tienes derecho a presentar una **reclamación** ante la autoridad de control italiana, el **Garante per la protezione dei dati personali** (www.garanteprivacy.it), o ante la autoridad de control de tu lugar de residencia (en España, la Agencia Española de Protección de Datos — www.aepd.es)."
            }
          ]
        },
        {
          h: "8. Menores",
          blocks: [
            {
              type: "p",
              text: "El Servicio está destinado a usuarios de **14 años o más**. En Italia, el menor que haya cumplido 14 años puede prestar válidamente su consentimiento al tratamiento de sus datos personales en relación con los servicios de la sociedad de la información (art. 2-quinquies, D.lgs. 196/2003); en España el límite es igualmente de 14 años (art. 7, LO 3/2018). Para los usuarios menores de 18 años, el consentimiento al tratamiento de datos de salud/fitness y la aceptación contractual requieren el **formulario de consentimiento parental** firmado por un progenitor o tutor. Si tuviéramos conocimiento de datos recogidos de un menor de 14 años sin consentimiento parental válido, procederemos a su supresión sin demora indebida."
            }
          ]
        },
        {
          h: "9. Seguridad",
          blocks: [
            {
              type: "p",
              text: "Aplicamos medidas técnicas y organizativas adecuadas al riesgo (art. 32 RGPD): cifrado en tránsito (TLS) y en reposo para los datos sensibles, hashing de contraseñas (algoritmos resistentes), controles de acceso basados en roles (RBAC), autenticación multifactor en los sistemas internos, copias de seguridad cifradas con pruebas de restauración, segregación de entornos, registro y monitorización, gestión de vulnerabilidades, formación del personal, evaluaciones de impacto (DPIA). Ningún sistema es completamente seguro; **en caso de violación de datos personales** actuaremos conforme a los arts. 33–34 RGPD (notificación al Garante en el plazo de 72 horas y, cuando sea necesario, comunicación a los interesados)."
            }
          ]
        },
        {
          h: "10. Cambios",
          blocks: [
            {
              type: "p",
              text: "Podremos actualizar la presente Política; los cambios sustanciales se comunicarán a través del Servicio o por email con al menos 15 días de antelación. La fecha indicada al inicio corresponde a la versión más reciente. Mantenemos un historial de versiones disponible previa solicitud."
            }
          ]
        },
        {
          h: "11. Contacto",
          blocks: [
            {
              type: "p",
              text: "Responsable del tratamiento: **[RAZÓN SOCIAL / NOMBRE DEL TITULAR]** — **[DOMICILIO SOCIAL]** — **[EMAIL DE PRIVACIDAD]**. DPO: **[EMAIL DEL DPO si designado]**."
            }
          ]
        }
      ]
    }
  },
  cookies: {
    it: {
      title: "Cookie Policy",
      updated: "Ultimo aggiornamento: 21 luglio 2026 · Versione 2.0",
      tldr: {
        title: "In breve",
        items: [
          "Usiamo cookie tecnici (necessari) senza consenso, e cookie analitici/marketing solo se acconsenti.",
          "Puoi cambiare idea in ogni momento dal link \"Preferenze cookie\" nel footer.",
          "Registriamo le tue scelte come prova del consenso."
        ]
      },
      intro: [
        {
          type: "p",
          text: "La presente Cookie Policy illustra come **[RAGIONE SOCIALE / NOME TITOLARE]** (il \"**Titolare**\") utilizza cookie e tecnologie simili (local storage, pixel, SDK) sul sito web e sulle applicazioni TrainMind AI, in conformità al GDPR, all'art. 122 del D.lgs. 196/2003 e alle Linee guida del Garante per la protezione dei dati personali sui cookie del 10 giugno 2021."
        },
        {
          type: "p",
          text: "La versione italiana è la **versione ufficiale** e prevale su qualsiasi traduzione in caso di discrepanza."
        }
      ],
      sections: [
        {
          h: "1. Cosa sono i cookie",
          blocks: [
            {
              type: "p",
              text: "I cookie sono piccoli file di testo che i siti web memorizzano sul tuo dispositivo. Tecnologie simili (come localStorage o pixel di tracciamento) svolgono funzioni analoghe; la presente Policy le ricomprende tutte nel termine \"cookie\"."
            }
          ]
        },
        {
          h: "2. Categorie utilizzate",
          blocks: [
            {
              type: "table",
              head: [
                "Categoria",
                "Finalità",
                "Base giuridica"
              ],
              rows: [
                [
                  "Tecnici / strettamente necessari",
                  "Autenticazione, gestione della sessione, sicurezza, bilanciamento del carico, memorizzazione delle preferenze essenziali (es. lingua, scelte cookie). Senza di essi il Servizio non può funzionare.",
                  "Non richiedono consenso (art. 122 D.lgs. 196/2003)"
                ],
                [
                  "Analitici",
                  "Statistiche aggregate sull'uso del Servizio per migliorarne funzionalità e prestazioni (es. Google Analytics 4 o equivalenti). Se configurati con anonimizzazione dell'IP e senza incroci tra siti, possono essere assimilati ai cookie tecnici.",
                  "Consenso (salvo adeguata anonimizzazione)"
                ],
                [
                  "Marketing / profilazione",
                  "Creazione di profili utente e pubblicità personalizzata, retargeting e funzionalità social (es. Meta Pixel, Google Ads, embed social).",
                  "Consenso"
                ]
              ]
            },
            {
              type: "p",
              text: "L'elenco dettagliato e sempre aggiornato dei singoli cookie (nome, fornitore, durata, finalità) è disponibile nel banner/centro preferenze cookie del Servizio."
            }
          ]
        },
        {
          h: "3. Consenso",
          blocks: [
            {
              type: "p",
              text: "Alla prima visita, un banner ti consente di: **accettare tutti** i cookie; **rifiutare tutti** i cookie non tecnici; oppure **personalizzare** le scelte per categoria. Nessun cookie non tecnico viene installato prima del consenso. La tua scelta viene memorizzata e può essere modificata in qualsiasi momento tramite il link **\"Preferenze cookie\"** nel footer/nelle impostazioni dell'app. La chiusura del banner senza scelta (es. tramite la \"X\") equivale al mantenimento dei soli cookie tecnici."
            },
            {
              type: "p",
              text: "Le tue scelte di consenso sono **registrate a fini di prova del consenso** (art. 7(1) GDPR). In linea con le Linee guida del Garante, il banner non viene ripresentato per almeno **6 mesi** dalla scelta, salvo che mutino significativamente le condizioni del trattamento, sia impossibile sapere se una scelta è già stata espressa (es. cookie cancellati) o tu riapra autonomamente il centro preferenze."
            }
          ]
        },
        {
          h: "4. Cookie di terze parti",
          blocks: [
            {
              type: "p",
              text: "Alcuni cookie sono installati da terze parti che agiscono come titolari autonomi o responsabili del trattamento (es. Google, Meta). Non controlliamo i loro trattamenti; ti invitiamo a consultare le rispettive informative privacy. Ove le terze parti siano stabilite al di fuori del SEE, i trasferimenti avvengono con le garanzie descritte nella nostra Informativa Privacy (DPF, SCC)."
            }
          ]
        },
        {
          h: "5. Gestione dei cookie dal browser",
          blocks: [
            {
              type: "p",
              text: "Puoi inoltre bloccare o eliminare i cookie tramite le impostazioni del tuo browser (Chrome, Firefox, Safari, Edge). Il blocco dei cookie tecnici può compromettere il corretto funzionamento del Servizio. Le istruzioni sono disponibili nelle pagine di aiuto del browser."
            }
          ]
        },
        {
          h: "6. Aggiornamenti e contatti",
          blocks: [
            {
              type: "p",
              text: "Potremo aggiornare la presente Policy al variare dei cookie utilizzati. Per domande ed esercizio dei diritti (v. Informativa Privacy per l'elenco completo): **[EMAIL PRIVACY]**. Titolare: **[RAGIONE SOCIALE / NOME TITOLARE]** — **[SEDE LEGALE]**."
            }
          ]
        }
      ]
    },
    en: {
      title: "Cookie Policy",
      updated: "Last updated: 21 July 2026 · Version 2.0",
      tldr: {
        title: "At a glance",
        items: [
          "We use strictly necessary cookies without consent, and analytics/marketing cookies only if you consent.",
          "You can change your mind any time via the \"Cookie preferences\" link in the footer.",
          "We record your choices as proof of consent."
        ]
      },
      intro: [
        {
          type: "p",
          text: "This Cookie Policy explains how **[COMPANY NAME / OWNER NAME]** (the \"**Controller**\") uses cookies and similar technologies (local storage, pixels, SDKs) on the TrainMind AI website and applications, in accordance with the GDPR, Art. 122 of Italian Legislative Decree 196/2003 and the Italian DPA's Guidelines on cookies of 10 June 2021."
        },
        {
          type: "p",
          text: "The Italian version is the **controlling version** and prevails over any translation in case of discrepancy."
        }
      ],
      sections: [
        {
          h: "1. What cookies are",
          blocks: [
            {
              type: "p",
              text: "Cookies are small text files that websites place on your device. Similar technologies (such as localStorage or tracking pixels) serve comparable purposes; this Policy covers them all under the term \"cookies\"."
            }
          ]
        },
        {
          h: "2. Categories used",
          blocks: [
            {
              type: "table",
              head: [
                "Category",
                "Purpose",
                "Legal basis"
              ],
              rows: [
                [
                  "Strictly necessary",
                  "Authentication, session management, security, load balancing, saving essential preferences (e.g. language, cookie choices). The Service cannot function without them.",
                  "No consent required (Art. 122 D.lgs. 196/2003)"
                ],
                [
                  "Analytics",
                  "Aggregate statistics on Service usage to improve features and performance (e.g. Google Analytics 4 or equivalent). Where analytics cookies are configured with IP anonymisation and no cross-site combination, they may be assimilated to technical cookies.",
                  "Consent (unless duly anonymised)"
                ],
                [
                  "Marketing / profiling",
                  "Building user profiles and delivering personalised advertising, retargeting and social features (e.g. Meta Pixel, Google Ads, social embeds).",
                  "Consent"
                ]
              ]
            },
            {
              type: "p",
              text: "The detailed, always up-to-date list of individual cookies (name, provider, duration, purpose) is available in the cookie banner/preference centre of the Service."
            }
          ]
        },
        {
          h: "3. Consent",
          blocks: [
            {
              type: "p",
              text: "On your first visit, a banner lets you: **accept all** cookies; **reject all** non-technical cookies; or **customise** your choices by category. No non-technical cookie is set before consent. Your choice is stored and can be changed any time via the **\"Cookie preferences\"** link in the footer/app settings. Closing the banner without choosing (e.g. via the \"X\") is equivalent to keeping only technical cookies."
            },
            {
              type: "p",
              text: "Your consent choices are **recorded as proof of consent** (Art. 7(1) GDPR). In line with the Italian DPA's Guidelines, the banner is not shown again for at least **6 months** after your choice, unless the conditions of processing change significantly, it is impossible to know whether a choice was already made (e.g. cookies deleted), or you reopen the preference centre yourself."
            }
          ]
        },
        {
          h: "4. Third-party cookies",
          blocks: [
            {
              type: "p",
              text: "Some cookies are set by third parties acting as autonomous controllers or processors (e.g. Google, Meta). We do not control their processing; please refer to their privacy policies. Where third parties are established outside the EEA, transfers occur under the safeguards described in our Privacy Policy (DPF, SCC)."
            }
          ]
        },
        {
          h: "5. Managing cookies in your browser",
          blocks: [
            {
              type: "p",
              text: "You can also block or delete cookies through your browser settings (Chrome, Firefox, Safari, Edge). Blocking technical cookies may prevent the Service from working properly. Instructions are available in your browser's help pages."
            }
          ]
        },
        {
          h: "6. Updates and contact",
          blocks: [
            {
              type: "p",
              text: "We may update this Policy as the cookies we use change. Questions and rights requests (see the Privacy Policy for the full list of rights): **[PRIVACY CONTACT EMAIL]**. Controller: **[COMPANY NAME / OWNER NAME]** — **[REGISTERED ADDRESS]**."
            }
          ]
        }
      ]
    },
    es: {
      title: "Política de Cookies",
      updated: "Última actualización: 21 de julio de 2026 · Versión 2.0",
      tldr: {
        title: "En resumen",
        items: [
          "Usamos cookies estrictamente necesarias sin consentimiento y cookies analíticas/marketing solo si consientes.",
          "Puedes cambiar de opinión en cualquier momento desde el enlace \"Preferencias de cookies\" en el pie de página.",
          "Registramos tus elecciones como prueba del consentimiento."
        ]
      },
      intro: [
        {
          type: "p",
          text: "La presente Política de Cookies explica cómo **[RAZÓN SOCIAL / NOMBRE DEL TITULAR]** (el \"**Responsable del tratamiento**\") utiliza cookies y tecnologías similares (local storage, píxeles, SDK) en el sitio web y las aplicaciones de TrainMind AI, de conformidad con el RGPD, el art. 122 del D.lgs. italiano 196/2003 y las Directrices sobre cookies de la autoridad italiana de protección de datos (Garante) de 10 de junio de 2021."
        },
        {
          type: "p",
          text: "La versión italiana es la **versión oficial** y prevalece sobre cualquier traducción en caso de discrepancia."
        }
      ],
      sections: [
        {
          h: "1. Qué son las cookies",
          blocks: [
            {
              type: "p",
              text: "Las cookies son pequeños archivos de texto que los sitios web almacenan en tu dispositivo. Las tecnologías similares (como localStorage o los píxeles de seguimiento) cumplen funciones análogas; la presente Política las engloba todas bajo el término \"cookies\"."
            }
          ]
        },
        {
          h: "2. Categorías utilizadas",
          blocks: [
            {
              type: "table",
              head: [
                "Categoría",
                "Finalidad",
                "Base jurídica"
              ],
              rows: [
                [
                  "Estrictamente necesarias",
                  "Autenticación, gestión de la sesión, seguridad, balanceo de carga, almacenamiento de preferencias esenciales (p. ej. idioma, elecciones de cookies). Sin ellas el Servicio no puede funcionar.",
                  "No requieren consentimiento (art. 122 D.lgs. 196/2003)"
                ],
                [
                  "Analíticas",
                  "Estadísticas agregadas sobre el uso del Servicio para mejorar sus funcionalidades y rendimiento (p. ej. Google Analytics 4 o equivalentes). Si se configuran con anonimización de la IP y sin cruces entre sitios, pueden asimilarse a las cookies técnicas.",
                  "Consentimiento (salvo anonimización adecuada)"
                ],
                [
                  "Marketing / elaboración de perfiles",
                  "Creación de perfiles de usuario y publicidad personalizada, retargeting y funcionalidades sociales (p. ej. Meta Pixel, Google Ads, contenidos sociales incrustados).",
                  "Consentimiento"
                ]
              ]
            },
            {
              type: "p",
              text: "La lista detallada y siempre actualizada de las cookies individuales (nombre, proveedor, duración, finalidad) está disponible en el banner/centro de preferencias de cookies del Servicio."
            }
          ]
        },
        {
          h: "3. Consentimiento",
          blocks: [
            {
              type: "p",
              text: "En tu primera visita, un banner te permite: **aceptar todas** las cookies; **rechazar todas** las cookies no técnicas; o **personalizar** tus elecciones por categoría. Ninguna cookie no técnica se instala antes del consentimiento. Tu elección se memoriza y puede modificarse en cualquier momento mediante el enlace **\"Preferencias de cookies\"** en el pie de página/configuración de la app. Cerrar el banner sin elegir (p. ej. mediante la \"X\") equivale a mantener únicamente las cookies técnicas."
            },
            {
              type: "p",
              text: "Tus elecciones de consentimiento se **registran como prueba del consentimiento** (art. 7(1) RGPD). En línea con las Directrices del Garante, el banner no se vuelve a mostrar durante al menos **6 meses** desde tu elección, salvo que cambien significativamente las condiciones del tratamiento, sea imposible saber si ya se expresó una elección (p. ej. cookies eliminadas) o reabras tú mismo el centro de preferencias."
            }
          ]
        },
        {
          h: "4. Cookies de terceros",
          blocks: [
            {
              type: "p",
              text: "Algunas cookies son instaladas por terceros que actúan como responsables autónomos o encargados del tratamiento (p. ej. Google, Meta). No controlamos sus tratamientos; te invitamos a consultar sus respectivas políticas de privacidad. Cuando los terceros estén establecidos fuera del EEE, las transferencias se realizan con las garantías descritas en nuestra Política de Privacidad (DPF, SCC)."
            }
          ]
        },
        {
          h: "5. Gestión de cookies desde el navegador",
          blocks: [
            {
              type: "p",
              text: "También puedes bloquear o eliminar las cookies mediante la configuración de tu navegador (Chrome, Firefox, Safari, Edge). El bloqueo de las cookies técnicas puede comprometer el correcto funcionamiento del Servicio. Las instrucciones están disponibles en las páginas de ayuda de tu navegador."
            }
          ]
        },
        {
          h: "6. Actualizaciones y contacto",
          blocks: [
            {
              type: "p",
              text: "Podremos actualizar la presente Política a medida que cambien las cookies utilizadas. Para preguntas y ejercicio de derechos (véase la Política de Privacidad para la lista completa): **[EMAIL DE PRIVACIDAD]**. Responsable del tratamiento: **[RAZÓN SOCIAL / NOMBRE DEL TITULAR]** — **[DOMICILIO SOCIAL]**."
            }
          ]
        }
      ]
    }
  }
} as const;

/** Percorso pubblico di ciascun documento, per i link incrociati. */
export const LEGAL_PATHS: Record<LegalDocKey, string> = {
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
};
