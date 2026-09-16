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
import { Observable } from 'rxjs';

/**
 * Runs FETAN report definitions.
 *
 * Every FETAN screen reads its data from a seeded report rather than a bespoke
 * endpoint, which is why these features need no backend changes. The report
 * definitions live in scripts/seed/config/reports.json.
 */
@Injectable({
  providedIn: 'root'
})
export class FetanReportService {
  private http = inject(HttpClient);

  /**
   * Runs a report for an office and returns its rows.
   *
   * `genericResultSet=false` asks Fineract for plain JSON rows rather than the
   * column-metadata envelope, matching what the existing dashboard widgets use.
   *
   * An office filter matches on hierarchy, so a parent office includes its branches.
   * A report with no matching rows returns null rather than an empty array.
   */
  run<T = any>(reportName: string, officeId: number): Observable<T[]> {
    const params = new HttpParams().set('R_officeId', officeId.toString()).set('genericResultSet', 'false');
    return this.http.get<T[]>(`/runreports/${encodeURIComponent(reportName)}`, { params });
  }
}
