/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Maps stock Fineract loan status ids/codes to FETAN SRS labels. */
export type FetanLoanStatusLabel = 'Requested' | 'Pending' | 'Dispensed' | 'Failed' | string;

/**
 * FETAN loan status words (SRS §4):
 * - Requested  = submitted, awaiting committee
 * - Pending    = approved, awaiting disbursement
 * - Dispensed  = active / money out
 * - Failed     = rejected, withdrawn, written off, closed without success
 */
export function fetanLoanStatusLabel(status: {
  id?: number;
  code?: string;
  value?: string;
  pendingApproval?: boolean;
  waitingForDisbursal?: boolean;
  active?: boolean;
} | null | undefined): FetanLoanStatusLabel {
  if (!status) {
    return '';
  }
  const id = status.id;
  if (id === 100 || status.pendingApproval) {
    return 'Requested';
  }
  if (id === 200 || status.waitingForDisbursal) {
    return 'Pending';
  }
  if (id === 300 || status.active) {
    return 'Dispensed';
  }
  if (id === 400 || id === 500 || id === 600 || id === 601 || id === 602 || id === 700) {
    return 'Failed';
  }
  return status.value || '';
}

export function fetanLoanStatusClass(label: string): string {
  switch (label) {
    case 'Requested':
      return 'status-requested';
    case 'Pending':
      return 'status-pending';
    case 'Dispensed':
      return 'status-dispensed';
    case 'Failed':
      return 'status-failed';
    default:
      return '';
  }
}
