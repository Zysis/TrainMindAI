/**
 * TrainMind — Seed dei protocolli RTP di sistema.
 *
 * Sul server i template arrivano con la migration SQL
 * (`20260901160000_rtp_templates`), che gira con psql. In locale `db push`
 * crea le tabelle ma non esegue le migration dei dati: la libreria resterebbe
 * vuota. Questo script fa lo stesso lavoro passando da Prisma.
 *
 * Idempotente: gli id sono deterministici (`sys_<code>`), quindi rilanciarlo
 * riallinea i template alla libreria senza spezzare i protocolli gia' avviati,
 * che puntano al template per id. Le righe di sistema non piu' previste dalla
 * libreria vengono rimosse, come fa il seed SQL.
 *
 * Run: pnpm --filter @trainmind/api exec tsx src/scripts/seed-rtp-templates.ts
 *
 * Sta nell'API e non in packages/db perche' e' li' che convivono gia' il
 * client Prisma e @trainmind/types: metterlo fra i seed avrebbe richiesto una
 * nuova dipendenza di workspace e quindi un lockfile rigenerato, che il build
 * di produzione (--frozen-lockfile) non perdona.
 */

// Per primo, come in server.ts: DATABASE_URL arriva dal .env del monorepo e
// va letto prima che @trainmind/db istanzi il client.
import '../lib/load-env.js';
import { prisma } from '@trainmind/db';
import { RTP_SYSTEM_TEMPLATES } from '@trainmind/types';

async function main() {
  const keepTemplates: string[] = [];
  const keepPhases: string[] = [];
  const keepCriteria: string[] = [];

  for (const tpl of RTP_SYSTEM_TEMPLATES) {
    const templateId = `sys_${tpl.code}`;
    keepTemplates.push(templateId);

    const fields = {
      code: tpl.code ?? null,
      name: tpl.name,
      description: tpl.description ?? null,
      bodyZone: tpl.bodyZone ?? null,
      bodyRegion: tpl.bodyRegion ?? null,
      injuryType: tpl.injuryType ?? null,
      severityMin: tpl.severityMin ?? null,
      severityMax: tpl.severityMax ?? null,
      isSystem: true,
      isActive: true,
      organizationId: null,
    };

    await prisma.rTPTemplate.upsert({
      where: { id: templateId },
      create: { id: templateId, ...fields },
      update: fields,
    });

    for (const phase of tpl.phases) {
      const phaseId = `${templateId}_p${phase.order}`;
      keepPhases.push(phaseId);

      const phaseFields = {
        templateId,
        order: phase.order,
        name: phase.name,
        goal: phase.goal ?? null,
        minDays: phase.minDays ?? null,
        typicalDays: phase.typicalDays ?? null,
      };
      await prisma.rTPTemplatePhase.upsert({
        where: { id: phaseId },
        create: { id: phaseId, ...phaseFields },
        update: phaseFields,
      });

      for (const criterion of phase.criteria) {
        const criterionId = `${phaseId}_c${criterion.order}`;
        keepCriteria.push(criterionId);

        const criterionFields = {
          phaseId,
          order: criterion.order,
          description: criterion.description,
          testCode: criterion.testCode ?? null,
          comparator: criterion.comparator ?? null,
          targetValue: criterion.targetValue ?? null,
          unit: criterion.unit ?? null,
          mandatory: criterion.mandatory,
        };
        await prisma.rTPTemplateCriterion.upsert({
          where: { id: criterionId },
          create: { id: criterionId, ...criterionFields },
          update: criterionFields,
        });
      }
    }
  }

  // Righe di sistema che la libreria non prevede piu': via, cosi' una
  // ri-esecuzione lascia esattamente i protocolli della libreria.
  const staleCriteria = await prisma.rTPTemplateCriterion.deleteMany({
    where: { id: { notIn: keepCriteria }, phase: { template: { isSystem: true } } },
  });
  const stalePhases = await prisma.rTPTemplatePhase.deleteMany({
    where: { id: { notIn: keepPhases }, template: { isSystem: true } },
  });
  const staleTemplates = await prisma.rTPTemplate.deleteMany({
    where: { id: { notIn: keepTemplates }, isSystem: true },
  });

  console.log(
    `Protocolli RTP di sistema: ${keepTemplates.length} template, ${keepPhases.length} fasi, ${keepCriteria.length} criteri.`,
  );
  if (staleTemplates.count || stalePhases.count || staleCriteria.count) {
    console.log(
      `Rimossi: ${staleTemplates.count} template, ${stalePhases.count} fasi, ${staleCriteria.count} criteri non piu' previsti.`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
