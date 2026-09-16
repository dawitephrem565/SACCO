#!/usr/bin/env node
/**
 * Prove FETAN's loan committee chain end to end.
 *
 * Employee submits → Maker approves (pending) → Checker confirms → Maker
 * disburses (pending) → Checker confirms → loan Active.
 *
 * Usage:
 *   node scripts/demo/loan-workflow.mjs
 *   node scripts/demo/loan-workflow.mjs --verify            # print current loan states
 *   node scripts/demo/loan-workflow.mjs --populate-queues   # leave one loan pending, one approved
 */

import { FineractClient } from '../seed/lib/api.mjs';
import { step } from '../seed/lib/idempotent.mjs';
import { log } from '../seed/lib/log.mjs';

const BASE = process.env.FINERACT_URL ?? 'http://localhost:8080/fineract-provider/api/v1';
const TENANT = process.env.FINERACT_TENANT ?? 'default';
const DATE_FMT = { dateFormat: 'yyyy-MM-dd', locale: 'en' };
const TODAY = '2024-03-01';

const USERS = {
  employee: { username: 'fetan.employee', password: process.env.SEED_USER_PASSWORD ?? 'FetanDev#2026x' },
  maker: { username: 'fetan.maker', password: process.env.SEED_USER_PASSWORD ?? 'FetanDev#2026x' },
  checker: { username: 'fetan.checker', password: process.env.SEED_USER_PASSWORD ?? 'FetanDev#2026x' }
};

async function clientFor(userKey) {
  const api = new FineractClient({ baseUrl: BASE, tenant: TENANT, ...USERS[userKey] });
  await api.authenticate();
  return api;
}

async function main() {
  const verifyOnly = process.argv.includes('--verify');

  console.log('FETAN loan workflow demo');
  log.info(`target ${BASE}`);

  if (verifyOnly) {
    const admin = await clientFor('employee');
    await printLoanSummary(admin);
    return;
  }

  if (process.argv.includes('--populate-queues')) {
    await populateQueues();
    log.summary();
    return;
  }

  const lookups = await step('Lookups', async () => loadLookups(await clientFor('employee')));

  let loanId = lookups.existingLoanId;
  if (!loanId) {
    loanId = await step('Employee submits loan', async () => submitLoan(await clientFor('employee'), lookups));
  } else {
    log.skip(`Loan ${loanId} already exists — continuing workflow`);
  }

  await step('Maker approves (queues for checker)', async () => makerApprove(await clientFor('maker'), loanId));
  await step('Checker confirms approval', async () => checkerApprovePending(await clientFor('checker'), { actionName: 'APPROVE', entityName: 'LOAN' }));
  await step('Maker disburses (queues for checker)', async () => makerDisburse(await clientFor('maker'), loanId));
  await step('Checker confirms disbursement', async () => checkerApprovePending(await clientFor('checker'), { actionName: 'DISBURSE', entityName: 'LOAN' }));

  const verifier = await clientFor('employee');
  await step('Final state', async () => printLoanState(verifier, loanId));

  log.summary();
}

async function loadLookups(api) {
  const clients = (await api.get('/clients?limit=50')).pageItems ?? [];
  const client = clients.find((c) => c.externalId === 'FETAN-DEMO-001') ?? clients[0];
  if (!client) throw new Error('No clients found — run scripts/demo/demo-data.mjs first');

  const products = await api.get('/loanproducts');
  const product = products.find((p) => p.name === 'FETAN Member Loan') ?? products[0];
  if (!product) throw new Error('No loan products — run scripts/seed/seed.mjs first');

  const accounts = await api.get(`/clients/${client.id}/accounts`);
  const pendingLoan = (accounts.loanAccounts ?? []).find((l) => l.status?.pendingApproval);
  const activeLoan = (accounts.loanAccounts ?? []).find((l) => l.status?.active);
  const approvedLoan = (accounts.loanAccounts ?? []).find((l) => l.status?.approved);

  const existingLoanId = activeLoan?.id ?? approvedLoan?.id ?? pendingLoan?.id;

  log.info(`client ${client.displayName} (id ${client.id}), product ${product.name} (id ${product.id})`);

  return { clientId: client.id, productId: product.id, existingLoanId };
}

async function submitLoan(api, { clientId, productId }) {
  const template = await api.get(`/loans/template?clientId=${clientId}&templateType=individual&productId=${productId}`);

  const created = await api.post('/loans', {
    clientId,
    productId,
    principal: template.principal ?? 10000,
    loanTermFrequency: template.termFrequency ?? 12,
    loanTermFrequencyType: template.termPeriodFrequencyType?.id ?? 2,
    numberOfRepayments: template.numberOfRepayments ?? 12,
    repaymentEvery: template.repaymentEvery ?? 1,
    repaymentFrequencyType: template.repaymentFrequencyType?.id ?? 2,
    interestRatePerPeriod: template.interestRatePerPeriod ?? 12,
    amortizationType: template.amortizationType?.id ?? 1,
    interestType: template.interestType?.id ?? 0,
    interestCalculationPeriodType: template.interestCalculationPeriodType?.id ?? 1,
    transactionProcessingStrategyCode: template.transactionProcessingStrategyCode ?? 'mifos-standard-strategy',
    expectedDisbursementDate: TODAY,
    submittedOnDate: TODAY,
    loanType: 'individual',
    ...DATE_FMT
  });

  const loanId = created.loanId ?? created.resourceId;
  log.created(`Loan application submitted (id ${loanId})`);
  return loanId;
}

async function makerApprove(api, loanId) {
  const loan = await api.get(`/loans/${loanId}`);
  if (loan.status?.approved || loan.status?.active) {
    log.skip(`Loan ${loanId} — already approved or active`);
    return;
  }
  if (!loan.status?.pendingApproval) {
    log.warn(`Loan ${loanId} — status is ${loan.status?.value}, expected pending approval`);
  }

  await api.post(`/loans/${loanId}?command=approve`, {
    approvedOnDate: TODAY,
    ...DATE_FMT
  });
  log.created(`Maker recorded approval for loan ${loanId} — pending checker`);
}

async function makerDisburse(api, loanId) {
  const loan = await api.get(`/loans/${loanId}`);
  if (loan.status?.active) {
    log.skip(`Loan ${loanId} — already active`);
    return;
  }
  if (!loan.status?.approved && !loan.status?.waitingForDisbursal) {
    log.warn(`Loan ${loanId} — status is ${loan.status?.value}, expected approved`);
  }

  await api.post(`/loans/${loanId}?command=disburse`, {
    actualDisbursementDate: TODAY,
    ...DATE_FMT
  });
  log.created(`Maker recorded disbursement for loan ${loanId} — pending checker`);
}

/**
 * Find the oldest unchecked command and approve it.
 * Maker-checker rows use short action names (APPROVE, DISBURSE) not permission codes.
 */
async function checkerApprovePending(api, { actionName, entityName }) {
  const pending = await api.get('/makercheckers');
  const rows = (pending ?? []).filter(
    (r) => r.actionName === actionName && r.entityName === entityName && !r.checked
  );

  if (!rows.length) {
    log.skip(`No pending ${actionName} ${entityName} commands in checker inbox`);
    return;
  }

  const row = rows[0];
  await api.post(`/makercheckers/${row.id}?command=approve`);
  log.created(`Checker approved ${actionName} ${entityName} (maker-checker id ${row.id})`);
}

async function printLoanState(api, loanId) {
  const loan = await api.get(`/loans/${loanId}`);
  log.info(`Loan ${loanId}: ${loan.status?.value} (id ${loan.status?.id})`);
  log.info(`  principal ${loan.principal} | outstanding ${loan.summary?.principalOutstanding ?? 'n/a'}`);

  const summary = await api.get('/runreports/FETAN Membership Summary?R_officeId=1&genericResultSet=false');
  const row = Array.isArray(summary) ? summary[0] : summary;
  if (row) {
    log.info(`Dashboard: Loans Outstanding=${row['Loans Outstanding']}, Awaiting Approval=${row['Loans Awaiting Approval']}`);
  }
}

/**
 * Put one loan in "submitted" and one in "approved, waiting disbursement"
 * so the FETAN queue screens have rows to show.
 */
async function populateQueues() {
  const employee = await clientFor('employee');
  const clients = (await employee.get('/clients?limit=50')).pageItems ?? [];
  const products = await employee.get('/loanproducts');
  const product = products.find((p) => p.name === 'FETAN Member Loan') ?? products[0];

  const pendingClient = clients.find((c) => c.externalId === 'FETAN-DEMO-002') ?? clients[1];
  const approvedClient = clients.find((c) => c.externalId === 'FETAN-DEMO-003') ?? clients[2];
  if (!pendingClient || !approvedClient || !product) {
    throw new Error('Need demo members and a loan product — run scripts/demo/demo-data.mjs first');
  }

  const pendingId = await step('Submit loan for Approval Queue', async () =>
    submitLoan(employee, { clientId: pendingClient.id, productId: product.id })
  );

  const approvedId = await step('Submit loan for Disbursement Queue', async () =>
    submitLoan(employee, { clientId: approvedClient.id, productId: product.id })
  );
  await step('Maker approves second loan', async () => makerApprove(await clientFor('maker'), approvedId));
  await step('Checker confirms second loan', async () =>
    checkerApprovePending(await clientFor('checker'), { actionName: 'APPROVE', entityName: 'LOAN' })
  );

  log.info(`${pendingClient.displayName} loan ${pendingId} → Loan Requests + Approval Queue`);
  log.info(`${approvedClient.displayName} loan ${approvedId} → Disbursement Queue`);
}

async function printLoanSummary(api) {
  const loans = (await api.get('/loans?limit=50')).pageItems ?? [];
  if (!loans.length) {
    log.info('No loans in the system');
    return;
  }
  for (const loan of loans) {
    log.info(`Loan ${loan.id} ${loan.accountNo}: ${loan.status?.value} — ${loan.clientName ?? ''} ${loan.principal ?? ''}`);
  }
}

main().catch((err) => {
  log.error(err.message);
  if (err.body) log.detail(JSON.stringify(err.body).slice(0, 600));
  process.exitCode = 1;
});
