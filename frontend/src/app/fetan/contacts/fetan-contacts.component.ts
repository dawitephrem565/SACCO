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
import { combineLatest, startWith, switchMap } from 'rxjs';

/** Custom Services */
import { FetanReportService } from '../shared/fetan-report.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

/** Report name, as defined in scripts/seed/config/reports.json. */
const CONTACT_REPORT = 'FETAN Contact Directory';

/** One row of the contact directory report. */
interface ContactRow {
  Department: string;
  Contact: string;
  'Job Title': string;
  Branch: string;
  Phone: string;
  Email: string;
  Notes: string;
}

/** Contacts belonging to a single department. */
interface DepartmentGroup {
  department: string;
  contacts: ContactRow[];
}

/**
 * FETAN Contact Information Directory.
 *
 * Implements FETAN SRS section 2: a central internal directory with departmental
 * routing for Customer Service, Finance, Loan Department and Management.
 *
 * The contacts are stored in the fetan_contact_directory datatable, which means FETAN
 * can add and edit them through the stock Mifos office screens without a developer.
 * This page is the read view, grouped by department for routing.
 */
@Component({
  selector: 'mifosx-fetan-contacts',
  templateUrl: './fetan-contacts.component.html',
  styleUrls: ['./fetan-contacts.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCardHeader,
    MatCardTitle,
    MatProgressSpinner,
    MatIcon
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FetanContactsComponent implements OnInit {
  private reports = inject(FetanReportService);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  /** Office filter. Head Office includes every branch beneath it. */
  officeId = new FormControl<number>(1, { nonNullable: true });

  /** Free-text filter across name, job title, branch and department. */
  search = new FormControl<string>('', { nonNullable: true });

  /** Offices for the filter, from the route resolver. */
  officeData: any[] = [];

  /** Contacts grouped by department, which is how the SRS asks for routing. */
  groups: DepartmentGroup[] = [];

  isLoading = true;
  loadError = false;

  private allContacts: ContactRow[] = [];

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
          return this.reports.run<ContactRow>(CONTACT_REPORT, officeId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => {
          // A report with no matching rows returns null rather than an empty array.
          this.allContacts = rows ?? [];
          this.isLoading = false;
          this.applyFilter();
        },
        error: () => {
          this.isLoading = false;
          this.loadError = true;
          this.changeDetector.markForCheck();
        }
      });

    this.search.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilter());
  }

  /** True when there are no contacts at all, as opposed to none matching the search. */
  get isEmpty(): boolean {
    return this.allContacts.length === 0;
  }

  /** True when contacts exist but the current search excludes all of them. */
  get hasNoMatches(): boolean {
    return this.allContacts.length > 0 && this.groups.length === 0;
  }

  private applyFilter(): void {
    const term = this.search.value.trim().toLowerCase();

    const matching = term
      ? this.allContacts.filter((c) =>
          [
            c.Contact,
            c['Job Title'],
            c.Branch,
            c.Department,
            c.Phone,
            c.Email
          ]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(term))
        )
      : this.allContacts;

    this.groups = this.groupByDepartment(matching);
    this.changeDetector.markForCheck();
  }

  /** The report already orders by department, so insertion order is preserved. */
  private groupByDepartment(contacts: ContactRow[]): DepartmentGroup[] {
    const byDepartment = new Map<string, ContactRow[]>();

    for (const contact of contacts) {
      const department = contact.Department ?? '';
      if (!byDepartment.has(department)) {
        byDepartment.set(department, []);
      }
      byDepartment.get(department)!.push(contact);
    }

    return [...byDepartment].map(
      ([
        department,
        rows
      ]) => ({ department, contacts: rows })
    );
  }
}
