import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/**
 * Create FETAN's report definitions.
 *
 * Reports are rows in stretchy_report, not code. Created through the admin UI they
 * exist in one database only — invisible to review and absent from every fresh
 * environment. Defining them here is what puts them under version control.
 *
 * Creating a report also creates a matching READ_<name> permission, which is how
 * report visibility is granted per role.
 */
export async function seedReports(api, config) {
  const existing = await api.get('/reports');
  const template = await api.get('/reports/template');
  const parameterIdsByName = new Map(
    (template.allowedParameters ?? []).map((p) => [p.parameterName, p.id])
  );

  const idsByName = new Map();

  for (const report of config.reports) {
    const parameters = resolveParameters(report.parameters, parameterIdsByName, report.reportName);
    if (parameters === null) continue;

    const result = await ensure({
      label: `Report "${report.reportName}"`,
      list: async () => existing,
      match: (r) => r.reportName === report.reportName,
      create: async () => {
        const created = await api.post('/reports', {
          reportName: report.reportName,
          reportType: report.reportType,
          reportCategory: report.reportCategory,
          reportSubType: report.reportSubType ?? undefined,
          description: report.description,
          reportSql: report.reportSql,
          useReport: true,
          reportParameters: parameters
        });
        const record = { id: created.resourceId, reportName: report.reportName };
        existing.push(record);
        return record;
      }
    });

    // Keep SQL in sync when the report already exists (idempotent re-seed after edits).
    // Do not resend reportParameters — Fineract tries to insert them again and hits
    // report_parameter_unique.
    if (!result.created && result.id) {
      try {
        await api.put(`/reports/${result.id}`, {
          reportName: report.reportName,
          reportType: report.reportType,
          reportCategory: report.reportCategory,
          reportSubType: report.reportSubType ?? undefined,
          description: report.description,
          reportSql: report.reportSql,
          useReport: true
        });
        log.info(`Report "${report.reportName}" — SQL refreshed (id ${result.id})`);
      } catch (err) {
        log.warn(`Report "${report.reportName}" — could not refresh SQL: ${err.message}`);
      }
    }

    idsByName.set(report.reportName, result.id);
  }

  return idsByName;
}

/**
 * Map parameter names to the ids Fineract expects. Returns null when a parameter is
 * unknown, so the report is skipped rather than created without its office filter.
 */
function resolveParameters(names = [], parameterIdsByName, reportName) {
  const resolved = [];

  for (const name of names) {
    const id = parameterIdsByName.get(name);
    if (!id) {
      log.error(`Report "${reportName}" — unknown parameter "${name}" — skipped`);
      return null;
    }
    resolved.push({ parameterId: id, reportParameterName: name });
  }
  return resolved;
}
