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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Material Imports */
import { MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
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
import { combineLatest, startWith, switchMap } from 'rxjs';

/** Custom Services */
import { FetanReportService } from '../shared/fetan-report.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

const MEMBER_REPORT = 'FETAN Member List';

interface MemberRow {
  'Client Id': number;
  Member: string;
  Account: string;
  Branch: string;
  Status: string;
  Activated: string;
  Submitted: string;
  Month: number;
  Year: number;
  'Last Activity': string;
}

/**
 * FETAN member list with month / year / active / dormant filters.
 *
 * Dormant = Active client with no savings, loan, or share transaction in 90 days.
 */
@Component({
  selector: 'mifosx-fetan-member-list',
  templateUrl: './fetan-member-list.component.html',
  styleUrls: ['./fetan-member-list.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    RouterLink,
    MatCardHeader,
    MatCardTitle,
    MatProgressSpinner,
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
export class FetanMemberListComponent implements OnInit {
  private reports = inject(FetanReportService);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  officeId = new FormControl<number>(1, { nonNullable: true });
  statusFilter = new FormControl<string>('all', { nonNullable: true });
  monthFilter = new FormControl<number | 'all'>('all', { nonNullable: true });
  yearFilter = new FormControl<number | 'all'>('all', { nonNullable: true });

  officeData: any[] = [];
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  years: number[] = [];

  rows: MemberRow[] = [];
  filtered: MemberRow[] = [];
  isLoading = true;
  loadError = false;

  displayedColumns = [
    'member',
    'account',
    'branch',
    'status',
    'activated',
    'lastActivity',
    'action'
  ];

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: { offices: any }) => {
      this.officeData = data.offices ?? [];
    });
  }

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 8 }, (_, i) => currentYear - i);

    this.officeId.valueChanges
      .pipe(
        startWith(this.officeId.value),
        switchMap((officeId) => {
          this.isLoading = true;
          this.loadError = false;
          this.changeDetector.markForCheck();
          return this.reports.run<MemberRow>(MEMBER_REPORT, officeId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => {
          this.rows = rows ?? [];
          this.applyFilters();
          this.isLoading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.loadError = true;
          this.changeDetector.markForCheck();
        }
      });

    combineLatest([
      this.statusFilter.valueChanges.pipe(startWith(this.statusFilter.value)),
      this.monthFilter.valueChanges.pipe(startWith(this.monthFilter.value)),
      this.yearFilter.valueChanges.pipe(startWith(this.yearFilter.value))
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.applyFilters();
        this.changeDetector.markForCheck();
      });
  }

  private applyFilters(): void {
    const status = this.statusFilter.value;
    const month = this.monthFilter.value;
    const year = this.yearFilter.value;

    this.filtered = this.rows.filter((row) => {
      if (status !== 'all' && row.Status !== status) {
        return false;
      }
      if (month !== 'all' && Number(row.Month) !== Number(month)) {
        return false;
      }
      if (year !== 'all' && Number(row.Year) !== Number(year)) {
        return false;
      }
      return true;
    });
  }

  statusClass(status: string): string {
    return `member-${(status || 'other').toLowerCase()}`;
  }
}
