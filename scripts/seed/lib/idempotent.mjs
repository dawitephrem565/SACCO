/**
 * Idempotency helpers.
 *
 * The seed must be safe to run repeatedly against the same tenant: partway through
 * a failed run, after adding one new product, or on a fresh database. Fineract has
 * no "create or update" semantics, so every step looks for an existing record by a
 * natural key (usually name) before creating it.
 */

import { log } from './log.mjs';

/**
 * Ensure a single record exists.
 *
 * @param {object}   opts
 * @param {string}   opts.label      Human-readable name used in log output
 * @param {Function} opts.list       async () => array of existing records
 * @param {Function} opts.match      (record) => boolean
 * @param {Function} opts.create     async () => created record
 * @param {Function} [opts.idOf]     (record) => id, defaults to record.id
 * @returns {Promise<{id: number, created: boolean}>}
 */
export async function ensure({ label, list, match, create, idOf = (r) => r.id }) {
  const existing = (await list()) ?? [];
  const found = existing.find(match);

  if (found) {
    log.skip(`${label} — already exists (id ${idOf(found)})`);
    return { id: idOf(found), created: false, record: found };
  }

  const created = await create();
  const id = idOf(created) ?? created.resourceId;
  log.created(`${label} — created (id ${id})`);
  return { id, created: true, record: created };
}

/**
 * Run a step and convert an unexpected failure into a clear, attributable error.
 * A step that throws stops the run: a partially configured tenant is easier to
 * reason about than one where some steps silently failed.
 */
export async function step(name, fn) {
  log.section(name);
  try {
    const result = await fn();
    return result;
  } catch (err) {
    log.error(`step "${name}" failed: ${err.message}`);
    if (err.body) log.detail(JSON.stringify(err.body).slice(0, 600));
    throw err;
  }
}
