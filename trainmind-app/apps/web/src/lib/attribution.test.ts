import { afterEach, describe, expect, it } from 'vitest';
import { readAttribution, withForwarded } from './attribution';

/**
 * `readAttribution` legge da due sorgenti (parametri dell'indirizzo e
 * referrer del browser) con una precedenza che non e' ovvia, e sbagliarla
 * significa attribuire le iscrizioni al sito sbagliato senza accorgersene:
 * nessun errore, solo numeri credibili e falsi.
 *
 * L'ambiente e' finto a mano invece che con jsdom: servono solo due proprieta'
 * e non vale la pena portarsi dietro un DOM intero.
 */
const asGlobal = globalThis as unknown as {
  window?: { location: { hostname: string } };
  document?: { referrer: string };
};

function browser(referrer: string, hostname = 'trainmind-app.com') {
  asGlobal.window = { location: { hostname } };
  asGlobal.document = { referrer };
}

afterEach(() => {
  delete asGlobal.window;
  delete asGlobal.document;
});

describe('readAttribution', () => {
  it('non inventa un oggetto vuoto quando non c\'e\' niente da osservare', () => {
    browser('');
    expect(readAttribution(new URLSearchParams(''))).toBeUndefined();
  });

  it('non scambia per provenienza un parametro che non lo e\'', () => {
    browser('');
    expect(readAttribution(new URLSearchParams('plan=ultra'))).toBeUndefined();
  });

  it('legge i parametri di campagna', () => {
    browser('');
    const a = readAttribution(new URLSearchParams('utm_source=google&utm_medium=cpc&utm_campaign=lancio'));
    expect(a?.utmSource).toBe('google');
    expect(a?.utmMedium).toBe('cpc');
    expect(a?.utmCampaign).toBe('lancio');
  });

  it('ignora il referrer interno: una navigazione non e\' una provenienza', () => {
    browser('https://trainmind-app.com/');
    expect(readAttribution(new URLSearchParams(''))).toBeUndefined();
  });

  it('tiene il referrer quando viene da un altro sito', () => {
    browser('https://www.google.com/search?q=x');
    expect(readAttribution(new URLSearchParams(''))?.referrer).toBe('https://www.google.com/search?q=x');
  });

  it('preferisce il `ref` inoltrato dal sito vetrina al referrer del browser', () => {
    // Il caso reale: l'utente arriva da Facebook al sito vetrina e da li'
    // alla registrazione. Qui `document.referrer` siamo noi stessi, e la
    // provenienza vera la sa solo il parametro.
    browser('https://trainmind-app.com/');
    expect(
      readAttribution(new URLSearchParams('ref=https%3A%2F%2Ffacebook.com%2Fpost'))?.referrer,
    ).toBe('https://facebook.com/post');
  });

  it('non si rompe su un referrer malformato', () => {
    browser('non-un-url');
    expect(readAttribution(new URLSearchParams('utm_source=x'))?.utmSource).toBe('x');
  });

  it('taglia i valori troppo lunghi: arrivano da fuori', () => {
    browser('');
    const a = readAttribution(new URLSearchParams('utm_source=' + 'a'.repeat(300)));
    expect(a?.utmSource?.length).toBe(120);
  });

  it('tratta gli spazi come assenza di dato', () => {
    browser('');
    expect(readAttribution(new URLSearchParams('utm_source=%20%20'))).toBeUndefined();
  });
});

describe('withForwarded', () => {
  it('aggiunge i parametri a un indirizzo che non ne ha', () => {
    expect(withForwarded('/register', 'utm_source=x')).toBe('/register?utm_source=x');
  });

  it('li accoda a un indirizzo che ne ha gia\'', () => {
    expect(withForwarded('/register?plan=ultra', 'utm_source=x')).toBe('/register?plan=ultra&utm_source=x');
  });

  it('lascia l\'indirizzo intatto quando non c\'e\' niente da aggiungere', () => {
    expect(withForwarded('/register', '')).toBe('/register');
  });
});
