import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/**
 * Create FETAN's branch structure.
 *
 * Offices are created before everything else because staff, users, members and
 * teller drawers all attach to an office.
 */
export async function seedOffices(api, config) {
  const existing = await api.get('/offices');
  const byName = new Map(existing.map((o) => [o.name, o.id]));

  for (const office of config.offices) {
    const parentId = byName.get(office.parentName);
    if (!parentId) {
      log.error(`parent office "${office.parentName}" not found — skipping "${office.name}"`);
      continue;
    }

    const result = await ensure({
      label: `Office "${office.name}"`,
      list: () => api.get('/offices'),
      match: (o) => o.name === office.name,
      create: () =>
        api.post('/offices', {
          name: office.name,
          parentId,
          openingDate: office.openingDate,
          externalId: office.externalId,
          dateFormat: 'yyyy-MM-dd',
          locale: 'en'
        })
    });

    byName.set(office.name, result.id);
  }

  return byName;
}
