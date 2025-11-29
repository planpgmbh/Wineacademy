type SeatChange = {
  terminId: number;
  delta: number;
};

export async function updateTerminCapacity(strapi: any, change: SeatChange) {
  if (!Number.isFinite(change.terminId) || !Number.isFinite(change.delta)) {
    throw new Error('Ungültige Kapazitätsänderung');
  }

  const termin = await strapi.entityService.findOne('api::termin.termin', change.terminId, {
    fields: ['id', 'kapazitaet', 'planungsstatus', 'documentId', 'publishedAt'],
  });

  if (!termin) {
    throw new Error(`Termin ${change.terminId} nicht gefunden`);
  }

  const currentCap =
    termin.kapazitaet != null && Number.isFinite(Number(termin.kapazitaet))
      ? Number(termin.kapazitaet)
      : 0;
  const nextCap = currentCap + change.delta;

  const updateData: Record<string, unknown> = { kapazitaet: nextCap };

  // Planungsstatus nur anpassen, wenn nicht manuell abgesagt wurde.
  if (termin.planungsstatus !== 'abgesagt') {
    if (nextCap <= 0) {
      updateData.planungsstatus = 'ausgebucht';
    } else if (termin.planungsstatus === 'ausgebucht') {
      updateData.planungsstatus = 'geplant';
    }
  }

  const documentId = (termin as any).documentId;

  if (documentId) {
    // Draft zuerst aktualisieren, damit Admin-Draft und Live-Version synchron sind.
    await strapi.documents('api::termin.termin').update({
      documentId,
      data: updateData,
      status: 'draft',
    });
    // Danach veröffentlichte Version anpassen.
    await strapi.documents('api::termin.termin').update({
      documentId,
      data: updateData,
      status: 'published',
    });
  } else {
    // Fallback für alte Einträge ohne documentId.
    await strapi.entityService.update('api::termin.termin', change.terminId, { data: updateData });
  }
}

export async function buildSeatChangesFromPositions(
  positionen: any[] | null | undefined,
  factor: number,
  strapi?: any
): Promise<SeatChange[]> {
  if (!Array.isArray(positionen) || !positionen.length || !Number.isFinite(factor)) {
    return [];
  }

  const aggregated = new Map<number, number>();

  for (const pos of positionen) {
    if ((pos?.typ ?? '').toLowerCase() !== 'seminar') continue;
    let terminIdRaw = (pos as any)?.termin?.id ?? (pos as any)?.termin ?? null;

    if (!terminIdRaw && strapi && pos?.id) {
      try {
        const link = await strapi.db
          .connection('components_bestellung_positionen_termin_lnk')
          .where({ position_id: pos.id })
          .first();
        if (link?.termin_id) {
          terminIdRaw = link.termin_id;
        }
      } catch (err) {
        strapi?.log?.warn?.('[termin-capacity] Termin-Link konnte nicht geladen werden.', {
          positionId: pos?.id,
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    if (!terminIdRaw && pos?.terminSnapshot?.terminId) {
      terminIdRaw = pos.terminSnapshot.terminId;
    }

    const terminId = Number(terminIdRaw);
    const menge = Number((pos as any)?.menge ?? 1);
    if (!Number.isFinite(terminId) || terminId <= 0) continue;
    const validMenge = Number.isFinite(menge) && menge > 0 ? menge : 1;
    aggregated.set(terminId, (aggregated.get(terminId) ?? 0) + validMenge * factor);
  }

  return Array.from(aggregated.entries()).map(([terminId, delta]) => ({ terminId, delta }));
}
