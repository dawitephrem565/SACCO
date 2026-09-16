import { log } from '../lib/log.mjs';

/**
 * Enable the currencies FETAN transacts in.
 *
 * This must run before charges and products, because the currency of a product is
 * fixed when it is created. A stock tenant permits USD only, which would silently
 * produce a SACCO whose products are all denominated in dollars.
 */
export async function seedCurrencies(api, config) {
  const current = await api.get('/currencies');
  const selected = current.selectedCurrencyOptions.map((c) => c.code);
  const available = new Set(current.currencyOptions.map((c) => c.code));

  const unknown = config.enabled.filter((code) => !available.has(code) && !selected.includes(code));
  if (unknown.length) {
    log.error(`currency code(s) not recognised by Fineract: ${unknown.join(', ')}`);
    return selected;
  }

  const missing = config.enabled.filter((code) => !selected.includes(code));
  if (!missing.length) {
    log.skip(`Currencies — already enabled (${selected.join(', ')})`);
    return selected;
  }

  // The endpoint replaces the whole set rather than appending, so existing
  // selections must be included or they would be removed.
  const target = [...new Set([...selected, ...config.enabled])];
  await api.put('/currencies', { currencies: target });

  log.created(`Currencies — enabled ${missing.join(', ')} (now ${target.join(', ')})`);

  if (!target.includes(config.primary)) {
    log.warn(`primary currency ${config.primary} is not in the enabled list`);
  }
  return target;
}
