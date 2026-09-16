import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

const TYPE_IDS = { ASSET: 1, LIABILITY: 2, EQUITY: 3, INCOME: 4, EXPENSE: 5 };
const USAGE_IDS = { DETAIL: 1, HEADER: 2 };

/**
 * Create the chart of accounts.
 *
 * Accounts are created in file order so that a HEADER always exists before the
 * DETAIL accounts that name it as a parent. Parents are resolved by glCode, which
 * is stable and human-readable, rather than by database id.
 */
export async function seedChartOfAccounts(api, config) {
  const existing = await api.get('/glaccounts');
  const idByGlCode = new Map(existing.map((a) => [a.glCode, a.id]));

  for (const account of config.accounts) {
    const typeId = TYPE_IDS[account.type];
    const usageId = USAGE_IDS[account.usage];

    if (!typeId || !usageId) {
      log.error(`account ${account.glCode} has an invalid type/usage — skipped`);
      continue;
    }

    let parentId;
    if (account.parent) {
      parentId = idByGlCode.get(account.parent);
      if (!parentId) {
        log.error(`parent glCode ${account.parent} not found for ${account.glCode} — skipped`);
        continue;
      }
    }

    const result = await ensure({
      label: `${account.glCode} ${account.name} [${account.usage}]`,
      list: async () => existing,
      match: (a) => a.glCode === account.glCode,
      create: async () => {
        const created = await api.post('/glaccounts', {
          name: account.name,
          glCode: account.glCode,
          type: typeId,
          usage: usageId,
          parentId,
          manualEntriesAllowed: true
        });
        const record = { id: created.resourceId, glCode: account.glCode, name: account.name };
        existing.push(record);
        return record;
      }
    });

    idByGlCode.set(account.glCode, result.id);
  }

  return idByGlCode;
}
