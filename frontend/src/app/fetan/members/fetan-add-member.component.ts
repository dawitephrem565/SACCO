/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Material Imports */
import { MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatStepper, MatStep, MatStepLabel, MatStepperNext, MatStepperPrevious } from '@angular/material/stepper';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** Custom Services */
import { Dates } from 'app/core/utils/dates';
import { SettingsService } from 'app/settings/settings.service';
import { FetanMembersService } from './fetan-members.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

/**
 * FETAN Add Member — one stepped flow for personal details, initial deposit, and documents.
 *
 * Uses stock Fineract APIs only; does not fork the multi-screen stock client wizard.
 */
@Component({
  selector: 'mifosx-fetan-add-member',
  templateUrl: './fetan-add-member.component.html',
  styleUrls: ['./fetan-add-member.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCardHeader,
    MatCardTitle,
    MatStepper,
    MatStep,
    MatStepLabel,
    MatStepperNext,
    MatStepperPrevious,
    MatProgressSpinner
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FetanAddMemberComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private membersService = inject(FetanMembersService);
  private settingsService = inject(SettingsService);
  private dateUtils = inject(Dates);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  personalForm = this.formBuilder.group({
    officeId: [
      null as number | null,
      Validators.required
    ],
    firstname: [
      '',
      [
        Validators.required,
        Validators.pattern('(^[A-z]).*')
      ]
    ],
    lastname: [
      '',
      [
        Validators.required,
        Validators.pattern('(^[A-z]).*')
      ]
    ],
    mobileNo: [''],
    emailAddress: [
      '',
      Validators.email
    ],
    dateOfBirth: [null as Date | null],
    genderId: [null as number | null],
    externalId: [''],
    submittedOnDate: [
      new Date(),
      Validators.required
    ]
  });

  depositForm = this.formBuilder.group({
    openSavings: [true],
    productId: [null as number | null],
    amount: [
      1000,
      [
        Validators.required,
        Validators.min(1)
      ]
    ],
    paymentTypeId: [null as number | null]
  });

  documentForm = this.formBuilder.group({
    name: ['Membership document'],
    description: ['Supporting document uploaded at onboarding']
  });

  officeOptions: any[] = [];
  genderOptions: any[] = [];
  savingsProducts: any[] = [];
  paymentTypes: any[] = [];

  selectedFile: File | null = null;
  isLoading = true;
  isSubmitting = false;
  loadError = false;
  submitError = '';

  ngOnInit(): void {
    this.depositForm.controls.openSavings.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((open) => {
        const product = this.depositForm.controls.productId;
        const amount = this.depositForm.controls.amount;
        const payment = this.depositForm.controls.paymentTypeId;
        if (open) {
          product.setValidators(Validators.required);
          amount.setValidators([
            Validators.required,
            Validators.min(1)
          ]);
          payment.setValidators(Validators.required);
        } else {
          product.clearValidators();
          amount.clearValidators();
          payment.clearValidators();
        }
        product.updateValueAndValidity();
        amount.updateValueAndValidity();
        payment.updateValueAndValidity();
      });

    this.loadTemplates();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    if (this.selectedFile && !this.documentForm.value.name) {
      this.documentForm.patchValue({ name: this.selectedFile.name });
    }
    this.changeDetector.markForCheck();
  }

  submit(): void {
    if (this.personalForm.invalid) {
      this.personalForm.markAllAsTouched();
      return;
    }
    if (this.depositForm.value.openSavings && this.depositForm.invalid) {
      this.depositForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.changeDetector.markForCheck();

    const locale = this.settingsService.language.code;
    const dateFormat = this.settingsService.dateFormat;
    const submittedOnDate = this.formatDate(this.personalForm.value.submittedOnDate, dateFormat);
    const dateOfBirth = this.personalForm.value.dateOfBirth
      ? this.formatDate(this.personalForm.value.dateOfBirth, dateFormat)
      : undefined;

    const client: Record<string, unknown> = {
      officeId: this.personalForm.value.officeId,
      legalFormId: 1,
      firstname: this.personalForm.value.firstname,
      lastname: this.personalForm.value.lastname,
      mobileNo: this.personalForm.value.mobileNo || undefined,
      emailAddress: this.personalForm.value.emailAddress || undefined,
      genderId: this.personalForm.value.genderId || undefined,
      externalId: this.personalForm.value.externalId || undefined,
      dateOfBirth,
      active: true,
      activationDate: submittedOnDate,
      submittedOnDate,
      dateFormat,
      locale
    };

    const openSavings = !!this.depositForm.value.openSavings;
    const deposit = openSavings
      ? {
          productId: this.depositForm.value.productId as number,
          amount: Number(this.depositForm.value.amount),
          paymentTypeId: this.depositForm.value.paymentTypeId as number,
          transactionDate: submittedOnDate,
          dateFormat,
          locale
        }
      : undefined;

    const document =
      this.selectedFile != null
        ? {
            name: this.documentForm.value.name || this.selectedFile.name,
            description: this.documentForm.value.description || '',
            file: this.selectedFile
          }
        : undefined;

    this.membersService
      .addMember({ client, deposit, document })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clientId) => {
          this.router.navigate([
            '/clients',
            clientId,
            'general'
          ]);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError =
            err?.error?.defaultUserMessage ||
            err?.error?.developerMessage ||
            'Unable to create member. Check the form and try again.';
          this.changeDetector.markForCheck();
        }
      });
  }

  private loadTemplates(): void {
    this.isLoading = true;
    this.loadError = false;
    this.changeDetector.markForCheck();

    this.membersService
      .getClientTemplate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (template) => {
          this.officeOptions = template.officeOptions ?? [];
          this.genderOptions = template.genderOptions ?? [];
          if (this.officeOptions.length) {
            this.personalForm.patchValue({ officeId: this.officeOptions[0].id });
          }
          this.loadSavingsAndPayments();
        },
        error: () => {
          this.isLoading = false;
          this.loadError = true;
          this.changeDetector.markForCheck();
        }
      });
  }

  private loadSavingsAndPayments(): void {
    this.membersService
      .getSavingsProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.savingsProducts = products ?? [];
          const preferred =
            this.savingsProducts.find((p) => p.name === 'FETAN Voluntary Savings') ?? this.savingsProducts[0];
          if (preferred) {
            this.depositForm.patchValue({ productId: preferred.id });
          }
        }
      });

    this.membersService
      .getPaymentTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => {
          this.paymentTypes = types ?? [];
          if (this.paymentTypes.length) {
            this.depositForm.patchValue({ paymentTypeId: this.paymentTypes[0].id });
          }
          this.isLoading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  private formatDate(value: Date | string | null | undefined, dateFormat: string): string {
    if (!value) {
      return this.dateUtils.formatDate(new Date(), dateFormat);
    }
    if (value instanceof Date) {
      return this.dateUtils.formatDate(value, dateFormat);
    }
    return value;
  }
}
