/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { Injectable, inject } from '@angular/core';

/** rxjs Imports */
import { Observable } from 'rxjs';

/** Custom Services */
import { FetanReportService } from '../shared/fetan-report.service';

/** Report names, as defined in scripts/seed/config/reports.json. */
const REPORTS = {
  summary: 'FETAN Membership Summary',
  gender: 'FETAN Member Demographics by Gender',
  ageBand: 'FETAN Member Demographics by Age Band',
  savingsByGender: 'FETAN Total Savings by Gender',
  sharesByGender: 'FETAN Total Shares by Gender',
  loansByGender: 'FETAN Total Loans by Gender'
} as const;

/** One row of the headline summary report. */
export interface FetanSummary {
  'Active Members': number;
  'Pending Members': number;
  'Total Savings': number;
  'Total Share Value': number;
  'Loans Outstanding': number;
  'Loans Awaiting Approval': number;
}

/**
 * FETAN Dashboard Service.
 *
 * Reads the executive dashboard figures. Every figure comes from a report
 * definition rather than a bespoke endpoint, which is why this dashboard needed no
 * backend change: the reports are data, seeded with the rest of the tenant
 * configuration.
 */
@Injectable({
  providedIn: 'root'
})
export class FetanDashboardService {
  private reports = inject(FetanReportService);

  private runReport(reportName: string, officeId: number): Observable<any> {
    return this.reports.run(reportName, officeId);
  }

  /** Headline totals: members, savings, shares and loans. */
  getSummary(officeId: number): Observable<FetanSummary[]> {
    return this.runReport(REPORTS.summary, officeId);
  }

  /** Member counts by gender. */
  getMembersByGender(officeId: number): Observable<any[]> {
    return this.runReport(REPORTS.gender, officeId);
  }

  /** Member counts by age band (<18, 18-35, >35). */
  getMembersByAgeBand(officeId: number): Observable<any[]> {
    return this.runReport(REPORTS.ageBand, officeId);
  }

  /** Savings balances split by member gender. */
  getSavingsByGender(officeId: number): Observable<any[]> {
    return this.runReport(REPORTS.savingsByGender, officeId);
  }

  /** Share holdings and value split by member gender. */
  getSharesByGender(officeId: number): Observable<any[]> {
    return this.runReport(REPORTS.sharesByGender, officeId);
  }

  /** Outstanding loan principal split by member gender. */
  getLoansByGender(officeId: number): Observable<any[]> {
    return this.runReport(REPORTS.loansByGender, officeId);
  }
}
