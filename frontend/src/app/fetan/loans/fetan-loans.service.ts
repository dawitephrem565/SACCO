/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

/** rxjs Imports */
import { Observable, map } from 'rxjs';

/** Loan list filters for FETAN queue screens. */
export type FetanLoanQueue = 'requests' | 'approval' | 'disbursement';

/**
 * Loads loan lists for FETAN's operational queues.
 *
 * Uses the same /loans endpoint as the stock Checker Inbox tabs, but surfaces
 * them as dedicated FETAN screens rather than buried inside admin tasks.
 */
@Injectable({
  providedIn: 'root'
})
export class FetanLoansService {
  private http = inject(HttpClient);

  /** Loans matching a FETAN queue type. */
  getQueue(queue: FetanLoanQueue): Observable<any[]> {
    const params = new HttpParams().set('limit', '1000').set('sqlSearch', this.sqlFor(queue));
    return this.http.get('/loans', { params }).pipe(
      map((response: any) => {
        const items = response?.pageItems ?? [];
        return items.filter((loan: any) => this.matchesQueue(loan, queue));
      })
    );
  }

  private sqlFor(queue: FetanLoanQueue): string {
    switch (queue) {
      case 'requests':
        return 'l.loan_status_id = 100';
      case 'approval':
        return 'l.loan_status_id in (100,200)';
      case 'disbursement':
        return 'l.loan_status_id in (200)';
    }
  }

  private matchesQueue(loan: any, queue: FetanLoanQueue): boolean {
    switch (queue) {
      case 'requests':
        return loan.status?.pendingApproval === true;
      case 'approval':
        return loan.status?.pendingApproval === true;
      case 'disbursement':
        return loan.status?.waitingForDisbursal === true;
    }
  }

  /**
   * Reject a submitted loan with a required reason note.
   * Only valid while the loan is still pending approval (status 100).
   */
  rejectLoan(loanId: number, body: {
    rejectedOnDate: string;
    note: string;
    dateFormat: string;
    locale: string;
  }): Observable<any> {
    return this.http.post(`/loans/${loanId}?command=reject`, body);
  }
}
