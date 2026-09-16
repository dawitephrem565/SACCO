import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

/**
 * Create FETAN's roles, grant their permissions, and optionally create one test user
 * per role.
 *
 * Roles are the mechanism for hiding unused Mifos modules: the frontend hides what
 * the signed-in user has no permission for, and the backend rejects the call anyway.
 * Nothing is deleted from the codebase, so upstream updates stay conflict-free.
 */
export async function seedRoles(api, config, ctx) {
  const allPermissions = await api.get('/permissions');
  const roleIdsByName = await seedRoleDefinitions(api, config, allPermissions);
  await seedTestUsers(api, config, ctx, roleIdsByName);
  return roleIdsByName;
}

async function seedRoleDefinitions(api, config, allPermissions) {
  const existingRoles = await api.get('/roles');
  const roleIdsByName = new Map(existingRoles.map((r) => [r.name, r.id]));

  for (const role of config.roles) {
    const result = await ensure({
      label: `Role "${role.name}"`,
      list: async () => existingRoles,
      match: (r) => r.name === role.name,
      create: async () => {
        const created = await api.post('/roles', {
          name: role.name,
          description: role.description
        });
        const record = { id: created.resourceId, name: role.name };
        existingRoles.push(record);
        return record;
      }
    });

    roleIdsByName.set(role.name, result.id);
    await grantPermissions(api, result.id, role, allPermissions);
  }

  return roleIdsByName;
}

/**
 * Apply a role's permission set.
 *
 * Permissions are always re-applied, even for a role that already existed, so that
 * editing roles.json and re-running the seed actually updates access. Only the
 * difference is sent, which keeps the audit trail meaningful and avoids a no-op
 * command being recorded on every run.
 */
async function grantPermissions(api, roleId, role, allPermissions) {
  const wanted = resolvePermissions(role.permissions, allPermissions, role.name);
  if (!wanted.size) return;

  const current = await api.get(`/roles/${roleId}/permissions`);
  const currentlyOn = new Set(
    (current.permissionUsageData ?? []).filter((p) => p.selected).map((p) => p.code)
  );

  const toAdd = [...wanted].filter((code) => !currentlyOn.has(code));
  const toRemove = [...currentlyOn].filter((code) => !wanted.has(code));

  if (!toAdd.length && !toRemove.length) {
    log.skip(`  permissions for "${role.name}" — already correct (${wanted.size})`);
    return;
  }

  const changes = {};
  for (const code of toAdd) changes[code] = true;
  for (const code of toRemove) changes[code] = false;

  await api.put(`/roles/${roleId}/permissions`, { permissions: changes });
  log.created(
    `  permissions for "${role.name}" — +${toAdd.length}` +
      (toRemove.length ? ` / -${toRemove.length}` : '') +
      ` (now ${wanted.size})`
  );
}

/**
 * Expand the config's permission patterns into concrete permission codes.
 * Supports exact codes, `PREFIX_*` wildcards, and `grouping:<name>`.
 */
function resolvePermissions(patterns = [], allPermissions, roleName) {
  const codes = new Set();

  for (const pattern of patterns) {
    if (pattern.startsWith('grouping:')) {
      const grouping = pattern.slice('grouping:'.length);
      const matched = allPermissions.filter((p) => p.grouping === grouping);
      if (!matched.length) log.warn(`role "${roleName}": no permissions in grouping "${grouping}"`);
      matched.forEach((p) => codes.add(p.code));
      continue;
    }

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      const matched = allPermissions.filter((p) => p.code.startsWith(prefix));
      if (!matched.length) log.warn(`role "${roleName}": no permissions match "${pattern}"`);
      matched.forEach((p) => codes.add(p.code));
      continue;
    }

    const exists = allPermissions.some((p) => p.code === pattern);
    if (!exists) {
      log.warn(`role "${roleName}": permission "${pattern}" does not exist — omitted`);
      continue;
    }
    codes.add(pattern);
  }

  return codes;
}

/**
 * Create one test user per role, used to walk the loan chain in Phase 2.
 *
 * Deliberately gated on SEED_USER_PASSWORD: without it no users are created, so
 * running this seed against a shared or production environment cannot silently
 * introduce accounts with known credentials.
 */
async function seedTestUsers(api, config, ctx, roleIdsByName) {
  const password = process.env.SEED_USER_PASSWORD;
  const users = config.testUsers ?? [];
  if (!users.length) return;

  if (!password) {
    log.warn(
      `test users skipped — set SEED_USER_PASSWORD to create ${users.length} development accounts`
    );
    return;
  }

  const existingUsers = await api.get('/users');
  const officeIdsByName = await resolveOffices(api, ctx);

  for (const user of users) {
    const officeId = officeIdsByName.get(user.office);
    if (!officeId) {
      log.error(`user "${user.username}": office "${user.office}" not found — skipped`);
      continue;
    }

    const roleIds = user.roles.map((name) => roleIdsByName.get(name)).filter(Boolean);
    if (roleIds.length !== user.roles.length) {
      log.error(`user "${user.username}": one or more roles missing — skipped`);
      continue;
    }

    await ensure({
      label: `User "${user.username}" (${user.roles.join(', ')})`,
      list: async () => existingUsers,
      match: (u) => u.username === user.username,
      create: async () => {
        const created = await api.post('/users', {
          username: user.username,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          officeId,
          roles: roleIds,
          sendPasswordToEmail: false,
          password,
          repeatPassword: password
        });
        const record = { id: created.resourceId, username: user.username };
        existingUsers.push(record);
        return record;
      }
    });
  }
}

async function resolveOffices(api, ctx) {
  if (ctx?.officeIdsByName?.size) return ctx.officeIdsByName;
  const offices = await api.get('/offices');
  return new Map(offices.map((o) => [o.name, o.id]));
}
