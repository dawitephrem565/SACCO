import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/**
 * Populate the dropdown values used by the member and loan forms.
 *
 * Fineract ships the code categories but leaves most of them empty, which is why a
 * stock install shows blank dropdowns for gender, ID type and so on.
 */
export async function seedCodeValues(api, config) {
  const codes = await api.get('/codes');
  const byName = new Map(codes.map((c) => [c.name, c.id]));

  for (const [codeName, values] of Object.entries(config.codeValues)) {
    const codeId = byName.get(codeName);
    if (!codeId) {
      log.warn(`code category "${codeName}" does not exist on this tenant — skipped`);
      continue;
    }

    // Fetched once per category so each value can be matched without re-querying.
    const current = await api.get(`/codes/${codeId}/codevalues`);

    for (const [index, value] of values.entries()) {
      await ensure({
        label: `${codeName} / "${value}"`,
        list: async () => current,
        match: (cv) => cv.name === value,
        create: async () => {
          const created = await api.post(`/codes/${codeId}/codevalues`, {
            name: value,
            position: index + 1,
            isActive: true
          });
          // Creating a sub-resource returns the parent code as resourceId and the new
          // code value as subResourceId, so the latter is the id we want.
          const record = { id: created.subResourceId ?? created.resourceId, name: value };
          // Keep the local cache in step so a repeated value inside one run is caught.
          current.push(record);
          return record;
        }
      });
    }
  }
}
