# -*- coding: utf-8 -*-
"""Chiavi mancanti della sotto-pagina Report programmati (stesso namespace reports)."""
import io
import json
import os

KEYS = {
    'it': [
        ('schedulesSubtitle', 'Report generati e inviati automaticamente'),
        ('newSchedule', 'Nuova programmazione'),
        ('createSchedule', 'Crea programmazione'),
        ('editSchedule', 'Modifica programmazione'),
        ('scheduleName', 'Nome'),
        ('scheduleNamePlaceholder', 'Es. Report settimanale staff'),
        ('format', 'Formato'),
        ('lastNDays', 'Ultimi {days} giorni'),
        ('cronMonday8', 'Ogni lunedì alle 8:00'),
        ('cronWeekdays8', 'Dal lunedì al venerdì alle 8:00'),
        ('cronFriday18', 'Ogni venerdì alle 18:00'),
        ('cronFirstOfMonth9', 'Il primo del mese alle 9:00'),
        ('cronCustom', 'Personalizzata'),
        ('colName', 'Nome'),
        ('colFrequency', 'Frequenza'),
        ('colRecipients', 'Destinatari'),
        ('colLastRun', 'Ultima esecuzione'),
        ('colNextRun', 'Prossima esecuzione'),
        ('colStatus', 'Stato'),
        ('colActions', 'Azioni'),
        ('neverRun', 'Mai eseguita'),
        ('statusOk', 'Completata'),
        ('statusFailed', 'Fallita'),
        ('statusSkipped', 'Saltata'),
        ('runNow', 'Esegui ora'),
        ('suspend', 'Sospendi'),
        ('reactivate', 'Riattiva'),
        ('editLabel', 'Modifica'),
        ('deleteLabel', 'Elimina'),
        ('cancelLabel', 'Annulla'),
        ('createLabel', 'Crea'),
        ('saveChanges', 'Salva modifiche'),
        ('noSchedules', 'Nessuna programmazione'),
        ('noSchedulesDesc', 'Crea una programmazione per ricevere i report via email in automatico.'),
        ('toastScheduleCreated', 'Programmazione creata'),
        ('toastScheduleUpdated', 'Programmazione aggiornata'),
        ('toastScheduleDeleted', 'Programmazione eliminata'),
        ('toastSchedulePaused', 'Programmazione sospesa'),
        ('toastScheduleReactivated', 'Programmazione riattivata'),
        ('toastReportSent', 'Report generato e inviato'),
        ('toastNameRequired', 'Inserisci un nome'),
        ('toastRecipientsRequired', 'Inserisci almeno un destinatario'),
        ('toastLoadError', 'Errore nel caricamento delle programmazioni'),
        ('toastSaveError', 'Errore nel salvataggio'),
        ('toastDeleteError', 'Errore nell’eliminazione'),
        ('toastToggleError', 'Errore nel cambio di stato'),
        ('toastManualRunFailed', 'Esecuzione manuale fallita'),
    ],
    'en': [
        ('schedulesSubtitle', 'Reports generated and sent automatically'),
        ('newSchedule', 'New schedule'),
        ('createSchedule', 'Create schedule'),
        ('editSchedule', 'Edit schedule'),
        ('scheduleName', 'Name'),
        ('scheduleNamePlaceholder', 'e.g. Weekly staff report'),
        ('format', 'Format'),
        ('lastNDays', 'Last {days} days'),
        ('cronMonday8', 'Every Monday at 8:00'),
        ('cronWeekdays8', 'Monday to Friday at 8:00'),
        ('cronFriday18', 'Every Friday at 18:00'),
        ('cronFirstOfMonth9', 'First day of the month at 9:00'),
        ('cronCustom', 'Custom'),
        ('colName', 'Name'),
        ('colFrequency', 'Frequency'),
        ('colRecipients', 'Recipients'),
        ('colLastRun', 'Last run'),
        ('colNextRun', 'Next run'),
        ('colStatus', 'Status'),
        ('colActions', 'Actions'),
        ('neverRun', 'Never run'),
        ('statusOk', 'Completed'),
        ('statusFailed', 'Failed'),
        ('statusSkipped', 'Skipped'),
        ('runNow', 'Run now'),
        ('suspend', 'Pause'),
        ('reactivate', 'Resume'),
        ('editLabel', 'Edit'),
        ('deleteLabel', 'Delete'),
        ('cancelLabel', 'Cancel'),
        ('createLabel', 'Create'),
        ('saveChanges', 'Save changes'),
        ('noSchedules', 'No schedules'),
        ('noSchedulesDesc', 'Create a schedule to receive reports by email automatically.'),
        ('toastScheduleCreated', 'Schedule created'),
        ('toastScheduleUpdated', 'Schedule updated'),
        ('toastScheduleDeleted', 'Schedule deleted'),
        ('toastSchedulePaused', 'Schedule paused'),
        ('toastScheduleReactivated', 'Schedule resumed'),
        ('toastReportSent', 'Report generated and sent'),
        ('toastNameRequired', 'Please enter a name'),
        ('toastRecipientsRequired', 'Please enter at least one recipient'),
        ('toastLoadError', 'Could not load schedules'),
        ('toastSaveError', 'Could not save'),
        ('toastDeleteError', 'Could not delete'),
        ('toastToggleError', 'Could not change status'),
        ('toastManualRunFailed', 'Manual run failed'),
    ],
    'es': [
        ('schedulesSubtitle', 'Informes generados y enviados automáticamente'),
        ('newSchedule', 'Nueva programación'),
        ('createSchedule', 'Crear programación'),
        ('editSchedule', 'Editar programación'),
        ('scheduleName', 'Nombre'),
        ('scheduleNamePlaceholder', 'Ej. Informe semanal del cuerpo técnico'),
        ('format', 'Formato'),
        ('lastNDays', 'Últimos {days} días'),
        ('cronMonday8', 'Cada lunes a las 8:00'),
        ('cronWeekdays8', 'De lunes a viernes a las 8:00'),
        ('cronFriday18', 'Cada viernes a las 18:00'),
        ('cronFirstOfMonth9', 'El primero del mes a las 9:00'),
        ('cronCustom', 'Personalizada'),
        ('colName', 'Nombre'),
        ('colFrequency', 'Frecuencia'),
        ('colRecipients', 'Destinatarios'),
        ('colLastRun', 'Última ejecución'),
        ('colNextRun', 'Próxima ejecución'),
        ('colStatus', 'Estado'),
        ('colActions', 'Acciones'),
        ('neverRun', 'Nunca ejecutada'),
        ('statusOk', 'Completada'),
        ('statusFailed', 'Fallida'),
        ('statusSkipped', 'Omitida'),
        ('runNow', 'Ejecutar ahora'),
        ('suspend', 'Pausar'),
        ('reactivate', 'Reanudar'),
        ('editLabel', 'Editar'),
        ('deleteLabel', 'Eliminar'),
        ('cancelLabel', 'Cancelar'),
        ('createLabel', 'Crear'),
        ('saveChanges', 'Guardar cambios'),
        ('noSchedules', 'Ninguna programación'),
        ('noSchedulesDesc', 'Crea una programación para recibir los informes por correo automáticamente.'),
        ('toastScheduleCreated', 'Programación creada'),
        ('toastScheduleUpdated', 'Programación actualizada'),
        ('toastScheduleDeleted', 'Programación eliminada'),
        ('toastSchedulePaused', 'Programación pausada'),
        ('toastScheduleReactivated', 'Programación reanudada'),
        ('toastReportSent', 'Informe generado y enviado'),
        ('toastNameRequired', 'Introduce un nombre'),
        ('toastRecipientsRequired', 'Introduce al menos un destinatario'),
        ('toastLoadError', 'Error al cargar las programaciones'),
        ('toastSaveError', 'Error al guardar'),
        ('toastDeleteError', 'Error al eliminar'),
        ('toastToggleError', 'Error al cambiar el estado'),
        ('toastManualRunFailed', 'Ejecución manual fallida'),
    ],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('reports')
        if ns is None:
            print('SKIP (no reports ns)', path)
            continue

        anchor = None
        for line in src.split(nl):
            if '"newReport"' in line:
                anchor = line
                break
        if anchor is None:
            print('SKIP (no anchor)', path)
            continue

        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('OK (already patched)', path)
            continue

        out = src.replace(anchor, anchor + nl + nl.join(added), 1)
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('patched %-2s %s (+%d)' % (loc, path, len(added)))
