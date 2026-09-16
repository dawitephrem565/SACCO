/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Custom Modules */
import { SharedModule } from '../shared/shared.module';
import { FetanRoutingModule } from './fetan-routing.module';

/** Custom Components */
import { FetanDashboardComponent } from './dashboard/fetan-dashboard.component';
import { FetanContactsComponent } from './contacts/fetan-contacts.component';
import { FetanLoanQueueComponent } from './loans/fetan-loan-queue.component';
import { FetanLoanReceivableComponent } from './loans/fetan-loan-receivable.component';
import { FetanAddMemberComponent } from './members/fetan-add-member.component';
import { FetanRejectLoanDialogComponent } from './loans/fetan-reject-loan-dialog.component';

/**
 * FETAN Module
 *
 * Houses the FETAN-specific screens that do not exist in stock Mifos. Components are
 * standalone, so they are imported rather than declared.
 */
@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    FetanRoutingModule,
    FetanDashboardComponent,
    FetanContactsComponent,
    FetanLoanQueueComponent,
    FetanLoanReceivableComponent,
    FetanAddMemberComponent,
    FetanRejectLoanDialogComponent
  ]
})
export class FetanModule {}
