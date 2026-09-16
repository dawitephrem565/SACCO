/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** rxjs Imports */
import { Observable, of, switchMap, map } from 'rxjs';

/** Payload for the FETAN add-member wizard. */
export interface FetanAddMemberRequest {
  client: Record<string, unknown>;
  deposit?: {
    productId: number;
    amount: number;
    paymentTypeId: number;
    transactionDate: string;
    dateFormat: string;
    locale: string;
  };
  document?: {
    name: string;
    description: string;
    file: File;
  };
}

/**
 * Orchestrates FETAN member onboarding over stock Fineract APIs.
 *
 * Sequence: create client → optional document → savings account + deposit.
 */
@Injectable({
  providedIn: 'root'
})
export class FetanMembersService {
  private http = inject(HttpClient);

  getClientTemplate(): Observable<any> {
    return this.http.get('/clients/template');
  }

  getSavingsProducts(): Observable<any[]> {
    return this.http.get<any[]>('/savingsproducts');
  }

  getPaymentTypes(): Observable<any[]> {
    return this.http.get<any[]>('/paymenttypes');
  }

  /**
   * Runs the full onboarding chain and returns the new client id.
   */
  addMember(request: FetanAddMemberRequest): Observable<number> {
    return this.http.post<any>('/clients', request.client).pipe(
      map((res) => res.clientId ?? res.resourceId),
      switchMap((clientId: number) => {
        const afterDoc$ = request.document
          ? this.uploadDocument(clientId, request.document).pipe(map(() => clientId))
          : of(clientId);

        return afterDoc$.pipe(
          switchMap((id) =>
            request.deposit && request.deposit.amount > 0
              ? this.openSavingsAndDeposit(id, request.deposit).pipe(map(() => id))
              : of(id)
          )
        );
      })
    );
  }

  private uploadDocument(
    clientId: number,
    doc: NonNullable<FetanAddMemberRequest['document']>
  ): Observable<any> {
    const formData = new FormData();
    formData.append('name', doc.name);
    formData.append('description', doc.description || doc.name);
    formData.append('file', doc.file);
    return this.http.post(`/clients/${clientId}/documents`, formData);
  }

  private openSavingsAndDeposit(
    clientId: number,
    deposit: NonNullable<FetanAddMemberRequest['deposit']>
  ): Observable<any> {
    const dates = {
      dateFormat: deposit.dateFormat,
      locale: deposit.locale
    };

    return this.http
      .post<any>('/savingsaccounts', {
        clientId,
        productId: deposit.productId,
        submittedOnDate: deposit.transactionDate,
        ...dates
      })
      .pipe(
        map((res) => res.savingsId ?? res.resourceId),
        switchMap((savingsId: number) =>
          this.http
            .post(`/savingsaccounts/${savingsId}?command=approve`, {
              approvedOnDate: deposit.transactionDate,
              ...dates
            })
            .pipe(map(() => savingsId))
        ),
        switchMap((savingsId: number) =>
          this.http
            .post(`/savingsaccounts/${savingsId}?command=activate`, {
              activatedOnDate: deposit.transactionDate,
              ...dates
            })
            .pipe(map(() => savingsId))
        ),
        switchMap((savingsId: number) =>
          this.http.post(`/savingsaccounts/${savingsId}/transactions?command=deposit`, {
            transactionDate: deposit.transactionDate,
            transactionAmount: deposit.amount,
            paymentTypeId: deposit.paymentTypeId,
            ...dates
          })
        )
      );
  }
}
