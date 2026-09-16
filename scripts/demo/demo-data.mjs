#!/usr/bin/env node
/**
 * FETAN demo data.
 *
 * Creates sample members, savings accounts, share accounts and loans so that the
 * dashboard reports can be verified against known figures, and so there is
 * something to show in a walkthrough.
 *
 * This is deliberately NOT part of scripts/seed. The seed defines how FETAN is
 * configured and belongs in every environment; this creates fictional people and
 * belongs only in development.
 *
 * Usage:
 *   node scripts/demo/demo-data.mjs            # create the demo members
 *   node scripts/demo/demo-data.mjs --verify   # only re-check the report figures
 *
 * Safe to re-run: members are matched by external id and skipped if present.
 */

import { FineractClient } from '../seed/lib/api.mjs';
import { ensure, step } from '../seed/lib/idempotent.mjs';
import { log } from '../seed/lib/log.mjs';

const SETTINGS = {
  baseUrl: process.env.FINERACT_URL ?? 'http://localhost:8080/fineract-provider/api/v1',
  tenant: process.env.FINERACT_TENANT ?? 'default',
  username: process.env.FINERACT_USER ?? 'mifos',
  password: process.env.FINERACT_PASSWORD ?? 'password'
};

const DATE_FMT = { dateFormat: 'yyyy-MM-dd', locale: 'en' };

/**
 * Members are spread deliberately across both genders and all three SRS age bands
 * so the demographic reports can be checked against a known expected answer.
 *
 * `band` is the band each member is expected to fall into and is documentation only
 * — the report derives it from date_of_birth, so these drift as time passes.
 *
 * Note when checking savings totals by hand: the savings product has a required
 * opening balance of 50, which is deposited automatically on activation and is
 * additional to the `savings` figure below.
 */
const MEMBERS = [
  { ext: 'FETAN-DEMO-001', first: 'Abebe', last: 'Bekele', gender: 'Male', dob: '1975-03-12', band: 'Over 35', savings: 15000, shares: 50 },
  { ext: 'FETAN-DEMO-002', first: 'Almaz', last: 'Tesfaye', gender: 'Female', dob: '1992-07-04', band: '18 to 35', savings: 22000, shares: 120 },
  { ext: 'FETAN-DEMO-003', first: 'Kebede', last: 'Alemu', gender: 'Male', dob: '1998-11-23', band: '18 to 35', savings: 8000, shares: 30 },
  { ext: 'FETAN-DEMO-004', first: 'Hirut', last: 'Girma', gender: 'Female', dob: '1968-01-30', band: 'Over 35', savings: 45000, shares: 200 },
  { ext: 'FETAN-DEMO-005', first: 'Selam', last: 'Haile', gender: 'Female', dob: '2010-05-18', band: 'Under 18', savings: 1200, shares: 0 },
  { ext: 'FETAN-DEMO-006', first: 'Dawit', last: 'Mengistu', gender: 'Male', dob: '1988-09-09', band: 'Over 35', savings: 30000, shares: 80 }
];

async function main() {
  const verifyOnly = process.argv.includes('--verify');
  const api = new FineractClient(SETTINGS);

  console.log('FETAN demo data');
  log.info(`target ${SETTINGS.baseUrl}`);

  await step('Authentication', async () => {
    await api.authenticate();
  });

  const ctx = await step('Lookups', () => loadLookups(api));

  if (!verifyOnly) {
    await step('Members', () => createMembers(api, ctx));
    await step('Savings accounts', () => createSavings(api, ctx));
    await step('Share accounts', () => createShares(api, ctx));
    await step('Directory contacts', () => createContacts(api, ctx));
  }

  await step('Dashboard report figures', () => verifyReports(api));

  log.summary();
}

/** Resolve the ids the demo depends on, failing loudly if the seed has not been run. */
async function loadLookups(api) {
  const [
    offices,
    codes,
    savingsProducts,
    shareProductsPage
  ] = await Promise.all([
    api.get('/offices'),
    api.get('/codes'),
    api.get('/savingsproducts'),
    api.get('/products/share')
  ]);

  const genderCode = codes.find((c) => c.name === 'Gender');
  const genderValues = genderCode ? await api.get(`/codes/${genderCode.id}/codevalues`) : [];

  const ctx = {
    officeId: offices.find((o) => o.name === 'Addis Ababa Main Branch')?.id ?? offices[0].id,
    genderIdByName: new Map(genderValues.map((g) => [g.name, g.id])),
    savingsProductId: savingsProducts.find((p) => p.name === 'FETAN Voluntary Savings')?.id,
    shareProductId: (shareProductsPage.pageItems ?? []).find((p) => p.name === 'FETAN Member Shares')?.id
  };

  if (!ctx.savingsProductId || !ctx.shareProductId) {
    throw new Error('FETAN products not found — run scripts/seed/seed.mjs first');
  }

  log.info(`office ${ctx.officeId}, savings product ${ctx.savingsProductId}, share product ${ctx.shareProductId}`);
  return ctx;
}

async function createMembers(api, ctx) {
  const existing = await api.get('/clients?limit=200');
  const clients = existing.pageItems ?? [];
  ctx.clientIdByExt = new Map();

  for (const m of MEMBERS) {
    const result = await ensure({
      label: `Member ${m.first} ${m.last} (${m.gender}, ${m.band})`,
      list: async () => clients,
      match: (c) => c.externalId === m.ext,
      create: async () => {
        const created = await api.post('/clients', {
          officeId: ctx.officeId,
          legalFormId: 1, // person
          firstname: m.first,
          lastname: m.last,
          externalId: m.ext,
          dateOfBirth: m.dob,
          genderId: ctx.genderIdByName.get(m.gender),
          active: true,
          activationDate: '2024-01-01',
          submittedOnDate: '2024-01-01',
          ...DATE_FMT
        });
        const record = { id: created.clientId ?? created.resourceId, externalId: m.ext };
        clients.push(record);
        return record;
      }
    });

    ctx.clientIdByExt.set(m.ext, result.id);
  }
}

/**
 * Savings accounts are created, approved, activated and funded, because the reports
 * only count accounts in the active state (status_enum 300).
 */
async function createSavings(api, ctx) {
  for (const m of MEMBERS) {
    if (!m.savings) continue;
    const clientId = ctx.clientIdByExt.get(m.ext);

    const accounts = await api.get(`/clients/${clientId}/accounts`);
    const already = (accounts.savingsAccounts ?? []).some((a) => a.status?.active);
    if (already) {
      log.skip(`Savings for ${m.first} — already active`);
      continue;
    }

    const created = await api.post('/savingsaccounts', {
      clientId,
      productId: ctx.savingsProductId,
      submittedOnDate: '2024-01-15',
      ...DATE_FMT
    });
    const id = created.savingsId ?? created.resourceId;

    await api.post(`/savingsaccounts/${id}?command=approve`, { approvedOnDate: '2024-01-16', ...DATE_FMT });
    await api.post(`/savingsaccounts/${id}?command=activate`, { activatedOnDate: '2024-01-17', ...DATE_FMT });
    await api.post(`/savingsaccounts/${id}/transactions?command=deposit`, {
      transactionDate: '2024-02-01',
      transactionAmount: m.savings,
      paymentTypeId: 1,
      ...DATE_FMT
    });

    log.created(`Savings for ${m.first} — ${m.savings} deposited (account ${id})`);
  }
}

async function createShares(api, ctx) {
  for (const m of MEMBERS) {
    if (!m.shares) continue;
    const clientId = ctx.clientIdByExt.get(m.ext);

    const accounts = await api.get(`/clients/${clientId}/accounts`);
    const already = (accounts.shareAccounts ?? []).some((a) => a.status?.active);
    if (already) {
      log.skip(`Shares for ${m.first} — already active`);
      continue;
    }

    // A share account must be linked to a savings account, which is where dividend
    // payouts are credited.
    const linkedSavings = (accounts.savingsAccounts ?? []).find((a) => a.status?.active);
    if (!linkedSavings) {
      log.error(`Shares for ${m.first} — no active savings account to link — skipped`);
      continue;
    }

    const created = await api.post('/accounts/share', {
      clientId,
      productId: ctx.shareProductId,
      requestedShares: m.shares,
      submittedDate: '2024-01-15',
      applicationDate: '2024-01-15',
      savingsAccountId: linkedSavings.id,
      ...DATE_FMT
    });
    const id = created.resourceId;

    await api.post(`/accounts/share/${id}?command=approve`, { approvedDate: '2024-01-16', ...DATE_FMT });
    await api.post(`/accounts/share/${id}?command=activate`, { activatedDate: '2024-01-17', ...DATE_FMT });

    log.created(`Shares for ${m.first} — ${m.shares} shares (account ${id})`);
  }
}

/** Sample directory entries, one per department plus a branch-level contact. */
const CONTACTS = [
  { office: 'Head Office', department: 'Customer Service', name: 'Meseret Tadesse', title: 'Customer Service Lead', phone: '+251 11 555 0101', email: 'service@fetan.example' },
  { office: 'Head Office', department: 'Finance', name: 'Yonas Bekele', title: 'Finance Manager', phone: '+251 11 555 0102', email: 'finance@fetan.example' },
  { office: 'Head Office', department: 'Loan Department', name: 'Tigist Alemu', title: 'Head of Lending', phone: '+251 11 555 0103', email: 'loans@fetan.example' },
  { office: 'Head Office', department: 'Management', name: 'Solomon Desta', title: 'General Manager', phone: '+251 11 555 0100', email: 'gm@fetan.example' },
  { office: 'Addis Ababa Main Branch', department: 'Customer Service', name: 'Rahel Girma', title: 'Branch Service Officer', phone: '+251 11 555 0201', email: 'addis.service@fetan.example' },
  { office: 'Bole Branch', department: 'Loan Department', name: 'Bereket Haile', title: 'Branch Loan Officer', phone: '+251 11 555 0301', email: 'bole.loans@fetan.example' }
];

/**
 * Contacts live in the fetan_contact_directory datatable, attached to an office.
 *
 * The department column is named by Fineract's dropdown convention,
 * <codeName>_cd_<columnName>, and takes a code value id rather than a label.
 */
async function createContacts(api, ctx) {
  const offices = await api.get('/offices');
  const officeIdByName = new Map(offices.map((o) => [o.name, o.id]));

  const codes = await api.get('/codes');
  const departmentCode = codes.find((c) => c.name === 'FETANDepartment');
  if (!departmentCode) {
    log.error('FETANDepartment code not found — run the contacts seed step first');
    return;
  }
  const departmentValues = await api.get(`/codes/${departmentCode.id}/codevalues`);
  const departmentIdByName = new Map(departmentValues.map((v) => [v.name, v.id]));

  for (const contact of CONTACTS) {
    const officeId = officeIdByName.get(contact.office);
    const departmentId = departmentIdByName.get(contact.department);

    if (!officeId || !departmentId) {
      log.error(`Contact ${contact.name} — unknown office or department — skipped`);
      continue;
    }

    const rows = await api.get(`/datatables/fetan_contact_directory/${officeId}`);
    const already = (rows ?? []).some((r) => r['Contact Name'] === contact.name);
    if (already) {
      log.skip(`Contact ${contact.name} — already present`);
      continue;
    }

    await api.post(`/datatables/fetan_contact_directory/${officeId}`, {
      'FETANDepartment_cd_Department': departmentId,
      'Contact Name': contact.name,
      'Job Title': contact.title,
      Phone: contact.phone,
      Email: contact.email,
      locale: 'en',
      dateFormat: 'yyyy-MM-dd'
    });

    log.created(`Contact ${contact.name} — ${contact.department}, ${contact.office}`);
  }
}

/**
 * Run each dashboard report and print what it returns, so the figures can be checked
 * against the demo members above rather than merely confirming the SQL parses.
 */
async function verifyReports(api) {
  const reports = [
    'FETAN Membership Summary',
    'FETAN Member Demographics by Gender',
    'FETAN Member Demographics by Age Band',
    'FETAN Total Savings by Gender',
    'FETAN Total Shares by Gender',
    'FETAN Total Loans by Gender'
  ];

  for (const name of reports) {
    const path = `/runreports/${encodeURIComponent(name)}?R_officeId=1&genericResultSet=false`;
    try {
      const rows = await api.get(path);
      const summary = Array.isArray(rows)
        ? rows.map((r) => JSON.stringify(r)).join('  ') || '(no rows)'
        : JSON.stringify(rows);
      log.info(`${name}\n      ${summary}`);
    } catch (err) {
      log.error(`${name} — ${err.message}`);
    }
  }
}

main().catch((err) => {
  log.error(err.message);
  if (err.body) log.detail(JSON.stringify(err.body).slice(0, 500));
  process.exitCode = 1;
});
