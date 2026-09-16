/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Material Imports */
import { MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import {
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow
} from '@angular/material/table';

/** rxjs Imports */
import { forkJoin, startWith, switchMap } from 'rxjs';

/** Custom Services */
import { FetanReportService } from '../shared/fetan-report.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

const SUMMARY_REPORT = 'FETAN Loan Receivable Summary';
const BY_MEMBER_REPORT = 'FETAN Loan Receivable by Member';

interface ReceivableSummary {
  'Active Loans': number;
  'Principal Disbursed': number;
  Collected: number;
  Uncollected: number;
  'Interest Collected': number;
  'Total Outstanding': number;
}

interface ReceivableRow {
  Member: string;
  Account: string;
  Product: string;
  Disbursed: number;
  Collected: number;
  Uncollected: number;
  'Total Outstanding': number;
}

/**
 * FETAN Loan Receivable.
 *
 * Implements the detail-doc Loan Receivable section: collected (principal repaid)
 * vs uncollected (principal still owed) on active loans. Figures come from seeded
 * reports — no custom backend endpoint.
 */
@Component({
  selector: 'mifosx-fetan-loan-receivable',
  templateUrl: './fetan-loan-receivable.component.html',
  styleUrls: ['./fetan-loan-receivable.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCardHeader,
    MatCardTitle,
    MatProgressSpinner,
    MatIcon,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FetanLoanReceivableComponent implements OnInit {
  private reports = inject(FetanReportService);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  officeId = new FormControl<number>(1, { nonNullable: true });
  officeData: any[] = [];

  summary: ReceivableSummary | null = null;
  rows: ReceivableRow[] = [];

  isLoading = true;
  loadError = false;

  displayedColumns = [
    'member',
    'account',
    'product',
    'disbursed',
    'collected',
    'uncollected',
    'outstanding'
  ];

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: { offices: any }) => {
      this.officeData = data.offices ?? [];
    });
  }

  ngOnInit(): void {
    this.officeId.valueChanges
      .pipe(
        startWith(this.officeId.value),
        switchMap((officeId) => {
          this.isLoading = true;
          this.loadError = false;
          this.changeDetector.markForCheck();
          return forkJoin({
            summary: this.reports.run<ReceivableSummary>(SUMMARY_REPORT, officeId),
            byMember: this.reports.run<ReceivableRow>(BY_MEMBER_REPORT, officeId)
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.summary = (data.summary ?? [])[0] ?? null;
          this.rows = data.byMember ?? [];
          this.isLoading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.loadError = true;
          this.changeDetector.markForCheck();
        }
      });
  }

  get isEmpty(): boolean {
    return (this.summary?.['Active Loans'] ?? 0) === 0;
  }
}
