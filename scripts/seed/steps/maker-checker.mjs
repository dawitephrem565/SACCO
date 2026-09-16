import { log } from '../lib/log.mjs';

/**
 * Configure two-person control on loan approval and disbursement.
 *
 * Fineract ships with dozens of permissions already flagged as maker-checkable.
 * Turning on the master switch activates ALL of them, which would queue routine
 * actions like member activation. This step enables maker-checker only on the
 * actions FETAN actually wants, and disables it on everything else.
 *
 * Order matters. Permissions are set BEFORE the master switch is enabled, because
 * once maker-checker is on, changing the permission set is itself a checkable action.
 */
export async function seedMakerChecker(api, config) {
  await syncMakerCheckerPermissions(api, config.makerCheckerPermissions ?? []);
  await applyGlobalConfiguration(api, config.globalConfiguration ?? {});
}

/**
 * Enable maker-checker on the wanted codes and disable it on every other
 * maker-checkable permission Fineract exposes.
 */
async function syncMakerCheckerPermissions(api, wanted) {
  const wantedSet = new Set(wanted);
  const checkable = await api.get('/permissions?makerCheckerable=true');
  const changes = {};

  for (const permission of checkable) {
    const shouldEnable = wantedSet.has(permission.code);
    if (permission.selected !== shouldEnable) {
      changes[permission.code] = shouldEnable;
    }
  }

  if (!Object.keys(changes).length) {
    log.skip('Maker-checker permissions — already scoped to FETAN loan actions only');
    return;
  }

  await api.put('/permissions', { permissions: changes });

  const enabled = Object.keys(changes).filter((code) => changes[code]);
  const disabled = Object.keys(changes).filter((code) => !changes[code]);

  if (enabled.length) {
    log.created(`Maker-checker enabled on ${enabled.join(', ')}`);
  }
  if (disabled.length) {
    log.created(`Maker-checker disabled on ${disabled.length} other actions`);
  }
}

async function applyGlobalConfiguration(api, settings) {
  const { globalConfiguration } = await api.get('/configurations');
  const byName = new Map(globalConfiguration.map((c) => [c.name, c]));

  for (const [name, enabled] of Object.entries(settings)) {
    const setting = byName.get(name);
    if (!setting) {
      log.error(`global configuration "${name}" not found — skipped`);
      continue;
    }

    if (setting.enabled === enabled) {
      log.skip(`Configuration ${name} — already ${enabled ? 'enabled' : 'disabled'}`);
      continue;
    }

    await api.put(`/configurations/${setting.id}`, { enabled });
    log.created(`Configuration ${name} — set to ${enabled}`);

    if (name === 'enable-same-maker-checker' && enabled) {
      log.warn('enable-same-maker-checker is ON — one user can approve their own work');
    }
  }
}
