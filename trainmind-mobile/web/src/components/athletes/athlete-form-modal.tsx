'use client';

/**
 * Creazione di un atleta — un solo posto
 * =======================================
 *
 * Prima esistevano due modali diversi: uno nella lista atleti (email, altezza,
 * peso) e uno nella scheda squadra (foto, squadra). Campi diversi, validazioni
 * diverse, gestione dell'errore diversa — e quello della squadra faceva due
 * chiamate in fila, creare e poi iscrivere, con lo stesso messaggio d'errore
 * per entrambe: se falliva la seconda, l'atleta esisteva ma non compariva in
 * rosa, e sembrava che la creazione non fosse andata.
 *
 * Adesso il form e' questo, e la squadra la decide chi apre il modale
 * (`teamId`), non un campo di testo. L'iscrizione avviene dentro la stessa
 * richiesta di creazione, in transazione: o l'atleta nasce in rosa, o non nasce.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { useToast } from '@/components/ui/toast';
import { POSITION_OPTIONS } from '@/lib/constants/positions';

const FORM_ID = 'athlete-create-form';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: '',
  position: 'PG',
  jerseyNumber: '',
  height: '',
  weight: '',
  photoUrl: null as string | null,
};

interface AthleteFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Chiamata dopo una creazione riuscita: la pagina ricarica cio' che mostra. */
  onCreated?: () => void;
  /** Se presente, l'atleta nasce gia' iscritto a questa squadra. */
  teamId?: string;
  /** Nome della squadra, solo per dirlo a chi compila. */
  teamName?: string;
}

export function AthleteFormModal({
  open,
  onClose,
  onCreated,
  teamId,
  teamName,
}: AthleteFormModalProps) {
  const t = useTranslations('athletes');
  const { toast } = useToast();
  const apiError = useApiError();

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  const missing = !form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || missing) return;

    setSaving(true);
    try {
      await apiFetch('/athletes', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          position: form.position,
          email: form.email || undefined,
          jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
          height: form.height ? Number(form.height) : undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          photoUrl: form.photoUrl || undefined,
          teamId: teamId || undefined,
        }),
      });

      toast('success', teamId ? t('athleteCreatedTeam') : t('athleteCreated'));
      onClose();
      onCreated?.();
    } catch (err) {
      // Il messaggio dell'API, non un generico "errore": se la data non va
      // bene o il numero di maglia e' occupato, si deve poterlo leggere.
      toast('error', apiError(err, t('createError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={teamName ? `${t('newAthlete')} — ${teamName}` : t('newAthlete')}
      size="lg"
      footer={
        <>
          {/* Un pulsante spento e muto e' indistinguibile da uno rotto: qui
              si dice cosa manca. */}
          {missing && (
            <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">
              {t('requiredFields')}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={saving || missing}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? t('creating') : t('createAthlete')}
          </button>
        </>
      }
    >
      {/* Il pulsante sta nel footer, fuori dal form: `form={FORM_ID}` li tiene
          insieme, cosi' c'e' un solo percorso di invio e funziona anche Invio
          da tastiera. */}
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <PhotoPicker
            value={form.photoUrl}
            onChange={(url) => setForm({ ...form, photoUrl: url })}
            label={t('photo')}
            size={96}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('firstName')}
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <Input
            label={t('lastName')}
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />

          <div className="col-span-2">
            <Input
              label={t('email')}
              type="email"
              value={form.email}
              placeholder={t('emailPlaceholder')}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <Input
            label={t('birthDate')}
            type="date"
            required
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
          <Select
            label={t('position')}
            options={POSITION_OPTIONS}
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />

          <Input
            label={t('jerseyNumber')}
            type="number"
            value={form.jerseyNumber}
            onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
          />
          <Input
            label={t('heightCm')}
            type="number"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
          />
          <Input
            label={t('weightKg')}
            type="number"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
