#!/usr/bin/env node
/**
 * FETAN tenant seed runner.
 *
 * Turns an empty Apache Fineract tenant into a configured FETAN system. Safe to run
 * repeatedly: every step checks for an existing record before creating one, so a
 * re-run against a seeded tenant creates nothing and reports what it found.
 *
 * Usage:
 *   node scripts/seed/seed.mjs                      # run every step
 *   node scripts/seed/seed.mjs --only offices,codes # run selected steps
 *   node scripts/seed/seed.mjs --dry-run            # authenticate and report, change nothing
 *
 * Configuration comes from environment variables, falling back to local defaults:
 *   FINERACT_URL, FINERACT_TENANT, FINERACT_USER, FINERACT_PASSWORD
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { FineractClient } from './lib/api.mjs';
import { step } from './lib/idempotent.mjs';
import { log } from './lib/log.mjs';
import { seedOffices } from './steps/offices.mjs';
import { seedCodeValues } from './steps/code-values.mjs';
import { seedCurrencies } from './steps/currencies.mjs';
import { seedChartOfAccounts } from './steps/chart-of-accounts.mjs';
import { seedCharges } from './steps/charges.mjs';
import { seedProducts } from './steps/products.mjs';
import { seedReports } from './steps/reports.mjs';
import { seedContactDirectory } from './steps/contact-directory.mjs';
import { seedRoles } from './steps/roles.mjs';
import { seedStaffTellers } from './steps/staff-tellers.mjs';
import { seedMakerChecker } from './steps/maker-checker.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const SETTINGS = {
  baseUrl: process.env.FINERACT_URL ?? 'http://localhost:8080/fineract-provider/api/v1',
  tenant: process.env.FINERACT_TENANT ?? 'default',
  username: process.env.FINERACT_USER ?? 'mifos',
  password: process.env.FINERACT_PASSWORD ?? 'password'
};

/**
 * Ordered step registry. Order matters: later steps reference records created by
 * earlier ones (products need GL accounts and charges, users need offices and roles).
 *
 * Each step receives a shared `ctx` and may record ids on it under `provides`, so a
 * later step can look up what an earlier one created without re-querying the API.
 */
const STEPS = [
  { key: 'offices', title: 'Offices / branches', config: 'offices.json', run: seedOffices, provides: 'officeIdsByName' },
  { key: 'codes', title: 'Code values (form dropdowns)', config: 'code-values.json', run: seedCodeValues },
  { key: 'currencies', title: 'Currencies', config: 'currencies.json', run: seedCurrencies },
  { key: 'coa', title: 'Chart of accounts', config: 'chart-of-accounts.json', run: seedChartOfAccounts, provides: 'glAccountIdsByCode' },
  { key: 'charges', title: 'Charges (fees and penalties)', config: 'charges.json', run: seedCharges, provides: 'chargeIdsByName' },
  { key: 'products', title: 'Products (savings, shares, loans)', config: 'products.json', run: seedProducts },
  // Before roles: creating a report also creates its READ_<name> permission, which
  // roles then need to be able to grant.
  { key: 'reports', title: 'Report definitions', config: 'reports.json', run: seedReports, provides: 'reportIdsByName' },
  // Also before roles: registering a datatable creates its own CRUD permissions.
  { key: 'contacts', title: 'Contact directory', config: 'contact-directory.json', run: seedContactDirectory },
  { key: 'roles', title: 'Roles, permissions and test users', config: 'roles.json', run: seedRoles, provides: 'roleIdsByName' },
  // After roles so cashiers can be linked to FETAN app users (staffId on /users).
  { key: 'stafftellers', title: 'Staff, tellers and cashiers', config: 'staff-tellers.json', run: seedStaffTellers, provides: 'staffIdsByName' },
  // Last, because enabling maker-checker makes later configuration changes queue for
  // a second approver.
  { key: 'makerchecker', title: 'Maker-checker (two-person control)', config: 'maker-checker.json', run: seedMakerChecker }
];

async function loadConfig(filename) {
  const raw = await readFile(join(HERE, 'config', filename), 'utf8');
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const only = [];
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--only') only.push(...(argv[i + 1] ?? '').split(',').filter(Boolean));
    else if (arg.startsWith('--only=')) only.push(...arg.slice(7).split(',').filter(Boolean));
  }
  return { only, dryRun };
}

async function main() {
  const { only, dryRun } = parseArgs(process.argv.slice(2));

  console.log('FETAN tenant seed');
  log.info(`target   ${SETTINGS.baseUrl}`);
  log.info(`tenant   ${SETTINGS.tenant}`);
  log.info(`user     ${SETTINGS.username}`);
  if (dryRun) log.warn('dry run — no changes will be written');

  const api = new FineractClient(SETTINGS);

  await step('Authentication', async () => {
    const auth = await api.authenticate();
    log.info(`authenticated as ${auth.userId ? `${auth.username} (id ${auth.userId})` : auth.username}`);
  });

  const selected = only.length ? STEPS.filter((s) => only.includes(s.key)) : STEPS;

  if (only.length) {
    const unknown = only.filter((k) => !STEPS.some((s) => s.key === k));
    if (unknown.length) log.warn(`unknown step(s) ignored: ${unknown.join(', ')}`);
  }

  // Shared between steps. Pre-populated with the primary currency because charges and
  // products need it, and a step run in isolation via --only must still see it.
  const currencyConfig = await loadConfig('currencies.json');
  const ctx = { primaryCurrency: currencyConfig.primary };

  for (const s of selected) {
    const config = await loadConfig(s.config);
    if (dryRun) {
      log.section(s.title);
      log.info('skipped (dry run)');
      continue;
    }
    const result = await step(s.title, () => s.run(api, config, ctx));
    if (s.provides) ctx[s.provides] = result;
  }

  const counters = log.summary();
  process.exitCode = counters.failed > 0 ? 1 : 0;
}

main().catch((err) => {
  log.error(err.message);
  process.exitCode = 1;
});
