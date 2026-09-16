import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/**
 * Payment mode is not offered by /charges/template on a stock tenant, so the two
 * documented values are mapped here. 0 = cash/regular, 1 = account transfer.
 */
const PAYMENT_MODES = { Regular: 0, 'Account transfer': 1 };

/**
 * Create FETAN's fees and penalties.
 *
 * Option ids (charge time types, calculation types) differ between Fineract versions
 * and between the entities a charge applies to, so they are resolved by label from
 * the live /charges/template rather than hard-coded.
 */
export async function seedCharges(api, config, ctx) {
  const template = await api.get('/charges/template');
  const existing = await api.get('/charges');
  const currency = ctx?.primaryCurrency ?? 'USD';

  const appliesToByName = optionMap(template.chargeAppliesToOptions);
  const timeTypeByName = optionMap(template.chargeTimeTypeOptions);
  const calculationByName = optionMap(template.chargeCalculationTypeOptions);

  const byName = new Map();

  for (const charge of config.charges) {
    const appliesToId = appliesToByName.get(charge.appliesTo);
    const timeTypeId = timeTypeByName.get(charge.timeType);
    const calculationId = calculationByName.get(charge.calculation);

    const unresolved = [
      !appliesToId && `appliesTo "${charge.appliesTo}"`,
      !timeTypeId && `timeType "${charge.timeType}"`,
      !calculationId && `calculation "${charge.calculation}"`
    ].filter(Boolean);

    if (unresolved.length) {
      log.error(`Charge "${charge.name}" — unknown ${unresolved.join(', ')} — skipped`);
      continue;
    }

    const result = await ensure({
      label: `Charge "${charge.name}" (${charge.amount} ${charge.calculation === 'Flat' ? currency : '%'})`,
      list: async () => existing,
      match: (c) => c.name === charge.name,
      create: async () => {
        const payload = {
          name: charge.name,
          chargeAppliesTo: appliesToId,
          chargeTimeType: timeTypeId,
          chargeCalculationType: calculationId,
          currencyCode: currency,
          amount: charge.amount,
          penalty: charge.penalty,
          active: charge.active,
          locale: 'en',
          monthDayFormat: 'dd MMM'
        };

        // Only loan charges accept (and require) a payment mode.
        if (charge.appliesTo === 'Loan') {
          payload.chargePaymentMode = PAYMENT_MODES[charge.paymentMode ?? 'Regular'];
        }

        // Recurring fees need the date they fall due; monthly fees also need an interval.
        if (charge.feeOnMonthDay) payload.feeOnMonthDay = charge.feeOnMonthDay;
        if (charge.feeInterval) payload.feeInterval = charge.feeInterval;

        const created = await api.post('/charges', payload);
        const record = { id: created.resourceId, name: charge.name };
        existing.push(record);
        return record;
      }
    });

    byName.set(charge.name, result.id);
  }

  return byName;
}

function optionMap(options = []) {
  return new Map(options.map((o) => [o.value, o.id]));
}
