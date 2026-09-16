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

/** rxjs Imports */
import { forkJoin, startWith, switchMap } from 'rxjs';

/** Charting Imports */
import { Chart, registerables } from 'chart.js';

/** Custom Services */
import { FetanDashboardService, FetanSummary } from './fetan-dashboard.service';
import { ThemingService } from 'app/shared/theme-toggle/theming.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

Chart.register(...registerables);

/** A headline figure rendered as a card. */
interface SummaryTile {
  labelKey: string;
  value: number;
  icon: string;
  isCurrency: boolean;
}

/** Palette chosen to stay legible in both the light and dark themes. */
const GENDER_COLOURS = [
  '#1074B9',
  '#E4708A',
  '#7E9E45',
  '#B0752D'
];
const AGE_BAND_COLOUR = '#1074B9';

/**
 * FETAN Executive Dashboard.
 *
 * Implements FETAN SRS section 1.1: member demographics by gender and age band, and
 * savings, shares and loans aggregated by gender.
 *
 * Every figure is produced by a seeded report definition, so this screen adds no
 * backend endpoint. The reports live in scripts/seed/config/reports.json.
 */
@Component({
  selector: 'mifosx-fetan-dashboard',
  templateUrl: './fetan-dashboard.component.html',
  styleUrls: ['./fetan-dashboard.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCardHeader,
    MatCardTitle,
    MatProgressSpinner,
    MatIcon
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FetanDashboardComponent implements OnInit {
  private dashboardService = inject(FetanDashboardService);
  private themingService = inject(ThemingService);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  /** Office filter. Head Office includes every branch beneath it. */
  officeId = new FormControl<number>(1, { nonNullable: true });

  /** Offices for the filter, from the route resolver. */
  officeData: any[] = [];

  /** Headline figures. */
  summaryTiles: SummaryTile[] = [];

  /** Gender rows, also used for the financial breakdown table. */
  savingsByGender: any[] = [];
  sharesByGender: any[] = [];
  loansByGender: any[] = [];

  /** True until the first response arrives. */
  isLoading = true;

  /** Set when the reports cannot be read, usually because they are not seeded. */
  loadError = false;

  /** True when the tenant has no members yet, so charts would be empty. */
  isEmpty = false;

  // Typed as any to match the existing dashboard widgets: chart.js exports Chart as
  // a namespace as well as a value, so it cannot be used directly as a type here.
  private genderChart?: any;
  private ageChart?: any;
  private currentTheme = 'light-theme';

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: { offices: any }) => {
      this.officeData = data.offices ?? [];
    });
  }

  ngOnInit(): void {
    this.officeId.valueChanges
      .pipe(
        startWith(this.officeId.value),
        switchMap((officeId) => this.loadAll(officeId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => this.render(data),
        error: () => {
          this.isLoading = false;
          this.loadError = true;
          this.changeDetector.markForCheck();
        }
      });

    this.themingService.theme.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((theme) => {
      this.currentTheme = theme;
      this.applyChartColours();
    });
  }

  private loadAll(officeId: number) {
    this.isLoading = true;
    this.loadError = false;
    this.changeDetector.markForCheck();

    return forkJoin({
      summary: this.dashboardService.getSummary(officeId),
      gender: this.dashboardService.getMembersByGender(officeId),
      ageBand: this.dashboardService.getMembersByAgeBand(officeId),
      savings: this.dashboardService.getSavingsByGender(officeId),
      shares: this.dashboardService.getSharesByGender(officeId),
      loans: this.dashboardService.getLoansByGender(officeId)
    });
  }

  private render(data: any): void {
    // A report with no matching rows returns null rather than an empty array.
    const summary: FetanSummary | undefined = (data.summary ?? [])[0];

    this.summaryTiles = summary
      ? [
          {
            labelKey: 'labels.heading.Active Members',
            value: summary['Active Members'],
            icon: 'people',
            isCurrency: false
          },
          {
            labelKey: 'labels.heading.Total Savings',
            value: summary['Total Savings'],
            icon: 'savings',
            isCurrency: true
          },
          {
            labelKey: 'labels.heading.Total Share Value',
            value: summary['Total Share Value'],
            icon: 'pie_chart',
            isCurrency: true
          },
          {
            labelKey: 'labels.heading.Loans Outstanding',
            value: summary['Loans Outstanding'],
            icon: 'account_balance',
            isCurrency: true
          },
          {
            labelKey: 'labels.heading.Loans Awaiting Approval',
            value: summary['Loans Awaiting Approval'],
            icon: 'pending_actions',
            isCurrency: false
          },
          {
            labelKey: 'labels.heading.Pending Members',
            value: summary['Pending Members'],
            icon: 'person_add',
            isCurrency: false
          }
        ]
      : [];

    this.savingsByGender = data.savings ?? [];
    this.sharesByGender = data.shares ?? [];
    this.loansByGender = data.loans ?? [];

    const genderRows = data.gender ?? [];
    const ageRows = data.ageBand ?? [];

    this.isEmpty = genderRows.length === 0 && (summary?.['Active Members'] ?? 0) === 0;
    this.isLoading = false;
    this.changeDetector.markForCheck();

    // Charts draw against canvases that only exist once loading has finished.
    setTimeout(() => {
      this.drawGenderChart(genderRows);
      this.drawAgeChart(ageRows);
    });
  }

  private drawGenderChart(rows: any[]): void {
    const labels = rows.map((r) => r.Gender);
    const values = rows.map((r) => r.Members);

    this.genderChart?.destroy();
    const canvas = document.getElementById('fetan-gender-chart');
    if (!canvas) {
      return;
    }

    this.genderChart = new Chart('fetan-gender-chart', {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: GENDER_COLOURS.slice(0, Math.max(labels.length, 1))
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: this.legendColour } }
        }
      }
    });
  }

  private drawAgeChart(rows: any[]): void {
    const labels = rows.map((r) => r['Age Band']);
    const values = rows.map((r) => r.Members);

    this.ageChart?.destroy();
    const canvas = document.getElementById('fetan-age-chart');
    if (!canvas) {
      return;
    }

    this.ageChart = new Chart('fetan-age-chart', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Members',
            data: values,
            backgroundColor: AGE_BAND_COLOUR
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: this.legendColour, precision: 0 } },
          x: { ticks: { color: this.legendColour } }
        }
      }
    });
  }

  private get legendColour(): string {
    return this.currentTheme === 'dark-theme' ? 'white' : '#666';
  }

  private applyChartColours(): void {
    const colour = this.legendColour;

    if (this.genderChart?.options?.plugins?.legend?.labels) {
      this.genderChart.options.plugins.legend.labels.color = colour;
      this.genderChart.update();
    }
    if (this.ageChart?.options?.scales?.['y']) {
      (this.ageChart.options.scales['y'] as any).ticks.color = colour;
      (this.ageChart.options.scales['x'] as any).ticks.color = colour;
      this.ageChart.update();
    }
  }
}
