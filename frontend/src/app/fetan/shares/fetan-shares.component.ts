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

const INVENTORY_REPORT = 'FETAN Share Inventory';
const BY_MEMBER_REPORT = 'FETAN Shares by Member';

/**
 * FETAN share inventory: Sold / Ready / Promised plus per-member breakdown.
 */
@Component({
  selector: 'mifosx-fetan-shares',
  templateUrl: './fetan-shares.component.html',
  styleUrls: ['./fetan-shares.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
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
export class FetanSharesComponent implements OnInit {
  private reports = inject(FetanReportService);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  officeId = new FormControl<number>(1, { nonNullable: true });
  officeData: any[] = [];

  inventory: any = null;
  members: any[] = [];
  isLoading = true;
  loadError = false;

  memberColumns = ['member', 'account', 'status', 'approved', 'pending', 'value'];

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
            inventory: this.reports.run(INVENTORY_REPORT, officeId),
            members: this.reports.run(BY_MEMBER_REPORT, officeId)
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ inventory, members }) => {
          this.inventory = (inventory && inventory[0]) || null;
          this.members = members ?? [];
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

  statusClass(status: string): string {
    return `share-${(status || 'other').toLowerCase()}`;
  }
}
