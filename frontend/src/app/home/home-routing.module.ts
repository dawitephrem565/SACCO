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
import { HomeComponent } from './home.component';

/** Home Routes — stock Mifos dashboard redirects to FETAN dashboard */
const routes: Routes = [
  Route.withShell([
    {
      path: '',
      redirectTo: '/fetan/dashboard',
      pathMatch: 'full'
    },
    {
      path: 'home',
      component: HomeComponent,
      data: { title: 'Home' }
    },
    {
      path: 'dashboard',
      redirectTo: '/fetan/dashboard',
      pathMatch: 'full'
    }
  ])
];

/**
 * Home Routing Module
 *
 * Configures the home route and redirects the stock dashboard to FETAN.
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomeRoutingModule {}
