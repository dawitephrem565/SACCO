/**
 * Insert translation keys into en-US.json without reformatting the file.
 *
 * JSON.parse followed by JSON.stringify would rewrite all ~4,600 lines and bury the
 * real change in an unreviewable diff, so keys are inserted textually straight after
 * the opening line of their section.
 *
 * Usage: node scripts/add-translations.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'frontend/src/assets/translations/en-US.json';

/** Keys the FETAN screens need, grouped by the section they belong in. */
const ADDITIONS = {
  heading: {
    'Add Member': 'Add Member',
    'Personal Information': 'Personal Information',
    'Initial Deposit': 'Initial Deposit',
    'Supporting Documents': 'Supporting Documents',
    Confirm: 'Confirm',
    'Reject Loan': 'Reject Loan',
    'Active Members': 'Active Members',
    'Total Savings': 'Total Savings',
    'Pending Members': 'Pending Members',
    'Total Share Value': 'Total Share Value',
    'Loans Outstanding': 'Loans Outstanding',
    'Loans Awaiting Approval': 'Loans Awaiting Approval',
    'Members by Gender': 'Members by Gender',
    'Members by Age Band': 'Members by Age Band',
    'Savings by Gender': 'Savings by Gender',
    'Shares by Gender': 'Shares by Gender',
    'Loans by Gender': 'Loans by Gender',
    Members: 'Members',
    Shares: 'Shares',
    Outstanding: 'Outstanding',
    'Shares Held': 'Shares Held',
    'Share Value': 'Share Value',
    Borrowers: 'Borrowers',
    Client: 'Client',
    'Account No': 'Account No.',
    Product: 'Product',
    Principal: 'Principal',
    Status: 'Status',
    'Loan Requests': 'Loan Requests',
    'Approval Queue': 'Approval Queue',
    'Disbursement Queue': 'Disbursement Queue',
    'Loan Receivable': 'Loan Receivable',
    'Active Loans': 'Active Loans',
    Collected: 'Collected',
    Uncollected: 'Uncollected',
    'Interest Collected': 'Interest Collected',
    'Receivable by Member': 'Receivable by Member',
    Member: 'Member',
    Disbursed: 'Disbursed',
    'Total Outstanding': 'Total Outstanding',
    'Last Activity': 'Last Activity',
    Sold: 'Sold',
    'Ready for Sale': 'Ready for Sale',
    Promised: 'Promised',
    'Sold Value': 'Sold Value',
    'Shares by Member': 'Shares by Member',
    'Approved Shares': 'Approved Shares',
    'Pending Shares': 'Pending Shares'
  },
  menus: {
    'Add Member': 'Add Member',
    Members: 'Members',
    Shares: 'Shares',
    'Manage Contacts': 'Manage Contacts',
    'Contact Directory': 'Contact Directory',
    'Loan Requests': 'Loan Requests',
    'Approval Queue': 'Approval Queue',
    'Disbursement Queue': 'Disbursement Queue',
    'Loan Receivable': 'Loan Receivable'
  },
  tooltips: {
    'Add Member': 'FETAN stepped member onboarding',
    Members: 'Member directory with active / dormant filters',
    Shares: 'Share inventory: Sold, Ready, Promised',
    'Manage Contacts': 'Add or edit contacts on an office',
    'Contact Directory': 'FETAN internal contact directory',
    'Loan Requests': 'Submitted loan applications',
    'Approval Queue': 'Loans awaiting committee approval',
    'Disbursement Queue': 'Approved loans ready to disburse',
    'Loan Receivable': 'Collected vs uncollected loan principal'
  },
  inputs: {
    Search: 'Search',
    Reason: 'Reason',
    'Select File': 'Select file',
    'Rejected On': 'Rejected On',
    All: 'All',
    Active: 'Active',
    Dormant: 'Dormant',
    Pending: 'Pending',
    Closed: 'Closed',
    Month: 'Month',
    Year: 'Year'
  },
  text: {
    'FETAN Dashboard': 'FETAN Dashboard',
    'Contact Directory': 'Contact Directory',
    'Add Member': 'Add Member',
    'Add Member stepped form hint':
      'One FETAN flow: personal details, optional initial deposit, and supporting documents.',
    'Open savings and take initial deposit': 'Open savings and take initial deposit',
    'Document upload is optional': 'Document upload is optional at onboarding.',
    'Unable to load add member form': 'Unable to load the add member form.',
    'Reject loan requires a reason': 'Committee rejection requires a written reason.',
    'Rejection reason is required': 'A rejection reason is required.',
    'No contacts have been added yet': 'No contacts have been added yet.',
    'No contacts match your search': 'No contacts match your search.',
    'Unable to load the contact directory':
      'Unable to load the contact directory. Check that the FETAN report definitions have been seeded.',
    FETAN: 'FETAN',
    Dashboard: 'Dashboard',
    Loading: 'Loading...',
    'No members yet': 'No members have been registered yet.',
    'No active loans': 'No active loans',
    'Unable to load dashboard reports':
      'Unable to load the dashboard reports. Check that the FETAN report definitions have been seeded.',
    'Loan queue opens the member loan for approval or disbursement':
      'Open a row to approve, check, or disburse on the member loan screen.',
    'Unable to load loan queue': 'Unable to load the loan queue.',
    'No loan requests awaiting review': 'No loan requests are awaiting review.',
    'No loans awaiting approval': 'No loans are awaiting approval.',
    'No loans awaiting disbursement': 'No loans are awaiting disbursement.',
    'Loan Requests': 'Loan Requests',
    'Approval Queue': 'Approval Queue',
    'Disbursement Queue': 'Disbursement Queue',
    'Loan Receivable': 'Loan Receivable',
    'Collected is principal repaid; Uncollected is principal still owed on active loans':
      'Collected = principal repaid. Uncollected = principal still owed on active loans.',
    'Unable to load loan receivable': 'Unable to load loan receivable figures.',
    'No active loans with receivable balances': 'No active loans with receivable balances.',
    'Member list filter hint':
      'Filter by branch, status (Active / Dormant), and the month / year the member was activated.',
    'Unable to load member list':
      'Unable to load the member list. Check that the FETAN Member List report has been seeded.',
    'No members match filters': 'No members match the selected filters.',
    'Share status definitions':
      'Sold = active holdings. Promised = pending applications. Ready = authorized shares still available.',
    'Unable to load share reports':
      'Unable to load share reports. Check that the FETAN share report definitions have been seeded.',
    'No share accounts yet': 'No share accounts have been opened yet.'
  },
  buttons: {
    Reject: 'Reject'
  }
};

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const raw = await readFile(FILE, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(eol);

let inserted = 0;
let skipped = 0;

for (const [section, entries] of Object.entries(ADDITIONS)) {
  // Sections sit at different depths: most are nested under "labels" at four spaces,
  // but "tooltips" is top level at two. Match on the name and read the depth back off
  // the line rather than assuming it.
  const start = lines.findIndex((l) => /^\s+"([^"]+)":\s*\{$/.test(l) && l.trim().startsWith(`"${section}":`));
  if (start === -1) {
    console.error(`section "${section}" not found — nothing inserted`);
    process.exitCode = 1;
    continue;
  }

  const headerIndent = lines[start].match(/^\s*/)[0];
  const entryIndent = headerIndent + '  ';
  const closing = `${headerIndent}}`;

  // Find the end of this section so existing keys are only looked for within it.
  let end = start + 1;
  while (end < lines.length && lines[end] !== `${closing},` && lines[end] !== closing) end += 1;
  const body = lines.slice(start + 1, end);

  const newLines = [];
  for (const [key, value] of Object.entries(entries)) {
    const exists = body.some((l) => l.trimStart().startsWith(`"${key}":`));
    if (exists) {
      skipped += 1;
      continue;
    }
    newLines.push(`${entryIndent}"${escape(key)}": "${escape(value)}",`);
    inserted += 1;
  }

  if (newLines.length) lines.splice(start + 1, 0, ...newLines);
}

await writeFile(FILE, lines.join(eol), 'utf8');

// Re-parse as a guard: a broken translations file breaks the whole application.
JSON.parse(await readFile(FILE, 'utf8'));

console.log(`${inserted} keys inserted, ${skipped} already present. JSON is valid.`);
