/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

/** Routing Imports */
import { Route } from '../core/route/route.service';

/** Custom Components */
import { FetanDashboardComponent } from './dashboard/fetan-dashboard.component';
import { FetanContactsComponent } from './contacts/fetan-contacts.component';
import { FetanLoanQueueComponent } from './loans/fetan-loan-queue.component';
import { FetanLoanReceivableComponent } from './loans/fetan-loan-receivable.component';
import { FetanAddMemberComponent } from './members/fetan-add-member.component';
import { FetanMemberListComponent } from './members/fetan-member-list.component';
import { FetanSharesComponent } from './shares/fetan-shares.component';

/** Custom Resolvers */
import { OfficesResolver } from '../accounting/common-resolvers/offices.resolver';

/** FETAN Routes */
const routes: Routes = [
  Route.withShell([
    {
      path: '',
      data: { title: 'FETAN', breadcrumb: 'FETAN', routeParamBreadcrumb: false },
      children: [
        {
          path: '',
          redirectTo: 'dashboard',
          pathMatch: 'full'
        },
        {
          path: 'dashboard',
          component: FetanDashboardComponent,
          data: { title: 'FETAN Dashboard', breadcrumb: 'Dashboard', routeParamBreadcrumb: false },
          resolve: {
            offices: OfficesResolver
          }
        },
        {
          path: 'contacts',
          component: FetanContactsComponent,
          data: { title: 'Contact Directory', breadcrumb: 'Contact Directory', routeParamBreadcrumb: false },
          resolve: {
            offices: OfficesResolver
          }
        },
        {
          path: 'members',
          component: FetanMemberListComponent,
          data: {
            title: 'Members',
            breadcrumb: 'Members',
            routeParamBreadcrumb: false
          },
          resolve: {
            offices: OfficesResolver
          }
        },
        {
          path: 'members/create',
          component: FetanAddMemberComponent,
          data: {
            title: 'Add Member',
            breadcrumb: 'Add Member',
            routeParamBreadcrumb: false
          }
        },
        {
          path: 'shares',
          component: FetanSharesComponent,
          data: {
            title: 'Shares',
            breadcrumb: 'Shares',
            routeParamBreadcrumb: false
          },
          resolve: {
            offices: OfficesResolver
          }
        },
        {
          path: 'loans/requests',
          component: FetanLoanQueueComponent,
          data: {
            title: 'Loan Requests',
            breadcrumb: 'Loan Requests',
            routeParamBreadcrumb: false,
            queue: 'requests',
            titleKey: 'labels.heading.Loan Requests',
            emptyKey: 'labels.text.No loan requests awaiting review'
          }
        },
        {
          path: 'loans/approval-queue',
          component: FetanLoanQueueComponent,
          data: {
            title: 'Approval Queue',
            breadcrumb: 'Approval Queue',
            routeParamBreadcrumb: false,
            queue: 'approval',
            titleKey: 'labels.heading.Approval Queue',
            emptyKey: 'labels.text.No loans awaiting approval'
          }
        },
        {
          path: 'loans/disbursement-queue',
          component: FetanLoanQueueComponent,
          data: {
            title: 'Disbursement Queue',
            breadcrumb: 'Disbursement Queue',
            routeParamBreadcrumb: false,
            queue: 'disbursement',
            titleKey: 'labels.heading.Disbursement Queue',
            emptyKey: 'labels.text.No loans awaiting disbursement'
          }
        },
        {
          path: 'loans/receivable',
          component: FetanLoanReceivableComponent,
          data: {
            title: 'Loan Receivable',
            breadcrumb: 'Loan Receivable',
            routeParamBreadcrumb: false
          },
          resolve: {
            offices: OfficesResolver
          }
        }
      ]
    }
  ])
];

/**
 * FETAN Routing Module
 *
 * Routes for the FETAN-specific screens. Kept in its own module so that FETAN
 * additions stay separate from the upstream Mifos code and do not conflict when the
 * fork is updated.
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [OfficesResolver]
})
export class FetanRoutingModule {}
