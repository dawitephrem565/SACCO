import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/** Fineract accounting rules. 2 = Cash — journal entries when money actually moves. */
const ACCOUNTING_CASH = 2;

/**
 * Enum values, taken from the live product templates. Savings and loans use
 * different scales for what reads as the same concept, so they are kept separate:
 * "monthly" is 4 for savings compounding but 2 for a loan repayment frequency.
 */
const SAVINGS = {
  COMPOUND_MONTHLY: 4,
  POST_ANNUALLY: 7,
  DAILY_BALANCE: 1,
  DAYS_365: 365
};

const LOAN = {
  FREQUENCY_MONTHLY: 2,
  RATE_PER_YEAR: 3,
  EQUAL_INSTALMENTS: 1,
  DECLINING_BALANCE: 0,
  CALC_DAILY: 1,
  DAYS_ACTUAL: 1
};

/**
 * Create FETAN's savings, share and loan products.
 *
 * Products are the point where the chart of accounts stops being a list and starts
 * being used: each product maps its movements onto real GL accounts, so a mistake
 * here shows up as mis-posted journal entries rather than an error message.
 */
export async function seedProducts(api, config, ctx) {
  const currency = ctx?.primaryCurrency ?? 'USD';
  const glByCode = await resolveGlAccounts(api, ctx);
  const chargeByName = await resolveCharges(api, ctx);

  await seedSavings(api, config.savingsProducts ?? [], { currency, glByCode, chargeByName });
  await seedShares(api, config.shareProducts ?? [], { currency, glByCode, chargeByName });
  await seedLoans(api, config.loanProducts ?? [], { currency, glByCode, chargeByName });
}

/* ------------------------------------------------------------------ savings */

async function seedSavings(api, products, { currency, glByCode, chargeByName }) {
  const existing = await api.get('/savingsproducts');

  for (const p of products) {
    const accounting = mapAccounting(p.accounting, glByCode, p.name);
    if (!accounting) continue;

    await ensure({
      label: `Savings product "${p.name}" (${p.nominalAnnualInterestRate}% ${currency})`,
      list: async () => existing,
      match: (x) => x.name === p.name,
      create: async () => {
        const created = await api.post('/savingsproducts', {
          name: p.name,
          shortName: p.shortName,
          description: p.description,
          currencyCode: currency,
          digitsAfterDecimal: 2,
          inMultiplesOf: 1,
          nominalAnnualInterestRate: p.nominalAnnualInterestRate,
          interestCompoundingPeriodType: SAVINGS.COMPOUND_MONTHLY,
          interestPostingPeriodType: SAVINGS.POST_ANNUALLY,
          interestCalculationType: SAVINGS.DAILY_BALANCE,
          interestCalculationDaysInYearType: SAVINGS.DAYS_365,
          minRequiredOpeningBalance: p.minRequiredOpeningBalance,
          withdrawalFeeForTransfers: false,
          allowOverdraft: false,
          enforceMinRequiredBalance: false,
          accountingRule: ACCOUNTING_CASH,
          charges: chargeRefs(p.charges, chargeByName, p.name),
          ...accounting,
          locale: 'en'
        });
        const record = { id: created.resourceId, name: p.name };
        existing.push(record);
        return record;
      }
    });
  }
}

/* ------------------------------------------------------------------- shares */

async function seedShares(api, products, { currency, glByCode, chargeByName }) {
  const page = await api.get('/products/share');
  const existing = page.pageItems ?? [];

  for (const p of products) {
    const accounting = mapAccounting(p.accounting, glByCode, p.name);
    if (!accounting) continue;

    await ensure({
      label: `Share product "${p.name}" (${p.unitPrice} ${currency}/share)`,
      list: async () => existing,
      match: (x) => x.name === p.name,
      create: async () => {
        const created = await api.post('/products/share', {
          name: p.name,
          shortName: p.shortName,
          description: p.description,
          currencyCode: currency,
          digitsAfterDecimal: 2,
          inMultiplesOf: 1,
          totalShares: p.totalShares,
          sharesIssued: p.sharesIssued,
          unitPrice: p.unitPrice,
          minimumShares: p.minimumShares,
          nominalShares: p.nominalShares,
          maximumShares: p.maximumShares,
          allowDividendCalculationForInactiveClients: false,
          accountingRule: ACCOUNTING_CASH,
          // Share products name this parameter differently to savings and loans
          // (ShareProductApiConstants.charges_paramname = "chargesSelected").
          chargesSelected: chargeRefs(p.charges, chargeByName, p.name),
          ...accounting,
          locale: 'en'
        });
        const record = { id: created.resourceId, name: p.name };
        existing.push(record);
        return record;
      }
    });
  }
}

/* -------------------------------------------------------------------- loans */

async function seedLoans(api, products, { currency, glByCode, chargeByName }) {
  const existing = await api.get('/loanproducts');

  for (const p of products) {
    const accounting = mapAccounting(p.accounting, glByCode, p.name);
    if (!accounting) continue;

    await ensure({
      label: `Loan product "${p.name}" (${p.interestRatePerPeriod}%/yr, ${p.numberOfRepayments} instalments)`,
      list: async () => existing,
      match: (x) => x.name === p.name,
      create: async () => {
        const created = await api.post('/loanproducts', {
          name: p.name,
          shortName: p.shortName,
          description: p.description,
          currencyCode: currency,
          digitsAfterDecimal: 2,
          inMultiplesOf: 1,
          principal: p.principal,
          minPrincipal: p.minPrincipal,
          maxPrincipal: p.maxPrincipal,
          numberOfRepayments: p.numberOfRepayments,
          minNumberOfRepayments: p.minNumberOfRepayments,
          maxNumberOfRepayments: p.maxNumberOfRepayments,
          repaymentEvery: 1,
          repaymentFrequencyType: LOAN.FREQUENCY_MONTHLY,
          interestRatePerPeriod: p.interestRatePerPeriod,
          minInterestRatePerPeriod: p.minInterestRatePerPeriod,
          maxInterestRatePerPeriod: p.maxInterestRatePerPeriod,
          interestRateFrequencyType: LOAN.RATE_PER_YEAR, // rates in config are per annum
          amortizationType: LOAN.EQUAL_INSTALMENTS,
          interestType: LOAN.DECLINING_BALANCE,
          interestCalculationPeriodType: LOAN.CALC_DAILY,
          transactionProcessingStrategyCode: 'mifos-standard-strategy',
          daysInYearType: LOAN.DAYS_ACTUAL,
          daysInMonthType: LOAN.DAYS_ACTUAL,
          // Interest recalculation and variable instalments add complexity FETAN has
          // not asked for; both are mandatory flags so they are set off explicitly.
          isInterestRecalculationEnabled: false,
          allowVariableInstallments: false,
          canDefineInstallmentAmount: false,
          accountingRule: ACCOUNTING_CASH,
          charges: chargeRefs(p.charges, chargeByName, p.name),
          ...accounting,
          locale: 'en',
          dateFormat: 'yyyy-MM-dd'
        });
        const record = { id: created.resourceId, name: p.name };
        existing.push(record);
        return record;
      }
    });
  }
}

/* ------------------------------------------------------------------ helpers */

/**
 * Translate the glCode-keyed accounting block into the account ids Fineract expects.
 * Returns null if any account is missing, so the product is skipped rather than
 * created with a silently wrong mapping.
 */
function mapAccounting(accounting, glByCode, productName) {
  if (!accounting) return {};
  const mapped = {};

  for (const [field, glCode] of Object.entries(accounting)) {
    const id = glByCode.get(glCode);
    if (!id) {
      log.error(`Product "${productName}" — GL account ${glCode} (${field}) not found — skipped`);
      return null;
    }
    mapped[field] = id;
  }
  return mapped;
}

function chargeRefs(names = [], chargeByName, productName) {
  return names
    .map((name) => {
      const id = chargeByName.get(name);
      if (!id) log.warn(`Product "${productName}" — charge "${name}" not found, omitted`);
      return id ? { id } : null;
    })
    .filter(Boolean);
}

/** Use ids from an earlier step when available, otherwise query so --only works. */
async function resolveGlAccounts(api, ctx) {
  if (ctx?.glAccountIdsByCode?.size) return ctx.glAccountIdsByCode;
  const accounts = await api.get('/glaccounts');
  return new Map(accounts.map((a) => [a.glCode, a.id]));
}

async function resolveCharges(api, ctx) {
  if (ctx?.chargeIdsByName?.size) return ctx.chargeIdsByName;
  const charges = await api.get('/charges');
  return new Map(charges.map((c) => [c.name, c.id]));
}
