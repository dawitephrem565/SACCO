/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

/** Material Imports */
import { MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
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

/** Custom Services */
import { FetanLoanQueue, FetanLoansService } from './fetan-loans.service';
import {
  FetanRejectLoanDialogComponent,
  FetanRejectLoanDialogResult
} from './fetan-reject-loan-dialog.component';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

/** Route data keys for each queue screen. */
interface QueueRouteData {
  queue: FetanLoanQueue;
  titleKey: string;
  emptyKey: string;
}

/**
 * Shared loan queue table for FETAN operational screens.
 *
 * Three routes reuse this component with different filters: submitted applications,
 * loans awaiting committee approval, and loans ready to disburse.
 */
@Component({
  selector: 'mifosx-fetan-loan-queue',
  templateUrl: './fetan-loan-queue.component.html',
  styleUrls: ['./fetan-loan-queue.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    RouterLink,
    MatCardHeader,
    MatCardTitle,
    MatProgressSpinner,
    MatIcon,
    MatButton,
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
export class FetanLoanQueueComponent implements OnInit {
  private loansService = inject(FetanLoansService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  queue: FetanLoanQueue = 'requests';
  titleKey = '';
  emptyKey = '';

  loans: any[] = [];
  isLoading = true;
  loadError = false;
  actionError = '';

  displayedColumns = [
    'client',
    'account',
    'product',
    'principal',
    'status',
    'action'
  ];

  ngOnInit(): void {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: QueueRouteData) => {
      this.queue = data.queue;
      this.titleKey = data.titleKey;
      this.emptyKey = data.emptyKey;
      this.load();
    });
  }

  /** Reject is only valid on submitted (pending approval) loans. */
  canReject(loan: any): boolean {
    return this.queue !== 'disbursement' && loan.status?.pendingApproval === true;
  }

  rejectLoan(loan: any): void {
    const ref = this.dialog.open(FetanRejectLoanDialogComponent, {
      width: '480px',
      data: {
        loanId: loan.id,
        clientName: loan.clientName,
        accountNo: loan.accountNo
      }
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result?: FetanRejectLoanDialogResult) => {
        if (!result) {
          return;
        }
        this.actionError = '';
        this.loansService
          .rejectLoan(loan.id, result)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.load(),
            error: (err) => {
              this.actionError =
                err?.error?.defaultUserMessage ||
                err?.error?.developerMessage ||
                'Unable to reject loan.';
              this.changeDetector.markForCheck();
            }
          });
      });
  }

  private load(): void {
    this.isLoading = true;
    this.loadError = false;
    this.changeDetector.markForCheck();

    this.loansService
      .getQueue(this.queue)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.loans = rows;
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

  clientLink(loan: any): string[] {
    const clientId = loan.clientId ?? loan.client?.id;
    return clientId
      ? [
          '/clients',
          clientId,
          'loans-accounts',
          loan.id,
          'general'
        ]
      : [];
  }
}
