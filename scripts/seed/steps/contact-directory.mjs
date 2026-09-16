import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/**
 * Create the FETAN contact directory.
 *
 * Two things are created: a code holding the four departments, and a datatable
 * attached to m_office that stores the contacts themselves.
 *
 * A datatable is Fineract's user-defined table feature. Registering one gives us a
 * REST endpoint, admin UI screens and permissions for free, with no schema migration
 * and no backend code — which is what makes this requirement a configuration task
 * rather than a development one.
 */
export async function seedContactDirectory(api, config) {
  const codeId = await ensureDepartmentCode(api, config.departmentCode);
  await ensureDatatable(api, config.datatable);
  return { departmentCodeId: codeId };
}

/**
 * The department list is a code so the four values stay consistent across branches
 * rather than being retyped into a free-text field.
 */
async function ensureDepartmentCode(api, spec) {
  const codes = await api.get('/codes');

  const { id: codeId } = await ensure({
    label: `Code "${spec.name}"`,
    list: async () => codes,
    match: (c) => c.name === spec.name,
    create: async () => {
      const created = await api.post('/codes', { name: spec.name });
      const record = { id: created.resourceId, name: spec.name };
      codes.push(record);
      return record;
    }
  });

  const values = await api.get(`/codes/${codeId}/codevalues`);

  for (const [index, name] of spec.values.entries()) {
    await ensure({
      label: `  ${spec.name} / ${name}`,
      list: async () => values,
      match: (v) => v.name === name,
      create: async () => {
        const created = await api.post(`/codes/${codeId}/codevalues`, {
          name,
          position: index + 1,
          isActive: true
        });
        const record = { id: created.subResourceId ?? created.resourceId, name };
        values.push(record);
        return record;
      }
    });
  }

  return codeId;
}

async function ensureDatatable(api, spec) {
  const existing = await api.get('/datatables');

  await ensure({
    label: `Datatable "${spec.datatableName}" on ${spec.apptableName}`,
    list: async () => existing,
    match: (d) => d.registeredTableName === spec.datatableName,
    idOf: (d) => d.registeredTableName,
    create: async () => {
      await api.post('/datatables', {
        datatableName: spec.datatableName,
        apptableName: spec.apptableName,
        multiRow: spec.multiRow ?? false,
        columns: spec.columns.map(toColumn)
      });
      const record = { registeredTableName: spec.datatableName };
      existing.push(record);
      return record;
    }
  });
}

/**
 * Build a column definition. Length applies only to String columns; sending it for a
 * Text or Dropdown column is rejected.
 */
function toColumn(column) {
  const definition = {
    name: column.name,
    type: column.type,
    mandatory: column.mandatory ?? false
  };

  if (column.type === 'String') definition.length = column.length ?? 100;
  if (column.type === 'Dropdown') definition.code = column.code;

  return definition;
}
