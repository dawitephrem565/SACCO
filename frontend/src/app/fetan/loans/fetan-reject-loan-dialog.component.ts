/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/** Custom Services */
import { Dates } from 'app/core/utils/dates';
import { SettingsService } from 'app/settings/settings.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

export interface FetanRejectLoanDialogData {
  loanId: number;
  clientName: string;
  accountNo: string;
}

export interface FetanRejectLoanDialogResult {
  rejectedOnDate: string;
  note: string;
  dateFormat: string;
  locale: string;
}

/**
 * Dialog to reject a loan from a FETAN queue with a required reason.
 */
@Component({
  selector: 'mifosx-fetan-reject-loan-dialog',
  templateUrl: './fetan-reject-loan-dialog.component.html',
  styleUrls: ['./fetan-reject-loan-dialog.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatDialogModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FetanRejectLoanDialogComponent {
  private formBuilder = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FetanRejectLoanDialogComponent, FetanRejectLoanDialogResult>);
  private settingsService = inject(SettingsService);
  private dateUtils = inject(Dates);
  data = inject<FetanRejectLoanDialogData>(MAT_DIALOG_DATA);

  form = this.formBuilder.group({
    rejectedOnDate: [
      new Date(),
      Validators.required
    ],
    note: [
      '',
      [
        Validators.required,
        Validators.minLength(3)
      ]
    ]
  });

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const locale = this.settingsService.language.code;
    const dateFormat = this.settingsService.dateFormat;
    const rejectedOnDate = this.dateUtils.formatDate(this.form.value.rejectedOnDate as Date, dateFormat);

    this.dialogRef.close({
      rejectedOnDate,
      note: (this.form.value.note || '').trim(),
      dateFormat,
      locale
    });
  }
}
