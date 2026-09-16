import { ensure } from '../lib/idempotent.mjs';
import { log } from '../lib/log.mjs';

const DATE_FMT = { dateFormat: 'yyyy-MM-dd', locale: 'en' };

/**
 * Seed staff, tellers and cashiers, then optionally link staff to FETAN app users.
 *
 * Run after offices + roles so branch names and test users already exist.
 */
export async function seedStaffTellers(api, config, ctx) {
  const officeIdsByName = await resolveOffices(api, ctx);
  const staffIds = await seedStaff(api, config.staff ?? [], officeIdsByName);
  await seedTellers(api, config.tellers ?? [], officeIdsByName, staffIds);
  await linkUsersToStaff(api, config.staff ?? [], staffIds);
  return staffIds;
}

async function resolveOffices(api, ctx) {
  if (ctx?.officeIdsByName instanceof Map && ctx.officeIdsByName.size) {
    return ctx.officeIdsByName;
  }
  const offices = await api.get('/offices');
  return new Map(offices.map((o) => [o.name, o.id]));
}

async function seedStaff(api, staffList, officeIdsByName) {
  const existing = await api.get('/staff?status=all');
  const staff = Array.isArray(existing) ? existing : (existing.pageItems ?? []);
  const staffIds = new Map();

  for (const person of staffList) {
    const officeId = officeIdsByName.get(person.office);
    if (!officeId) {
      log.error(`staff ${person.firstname} ${person.lastname}: office "${person.office}" not found — skipped`);
      continue;
    }

    const result = await ensure({
      label: `Staff ${person.firstname} ${person.lastname}`,
      list: async () => staff,
      match: (s) =>
        s.firstname === person.firstname &&
        s.lastname === person.lastname &&
        (s.officeId === officeId || s.officeName === person.office),
      create: async () => {
        const created = await api.post('/staff', {
          officeId,
          firstname: person.firstname,
          lastname: person.lastname,
          isLoanOfficer: !!person.isLoanOfficer,
          mobileNo: person.mobileNo,
          joiningDate: person.joiningDate,
          ...DATE_FMT
        });
        const record = {
          id: created.resourceId,
          firstname: person.firstname,
          lastname: person.lastname,
          officeId
        };
        staff.push(record);
        return record;
      }
    });

    staffIds.set(`${person.firstname}|${person.lastname}`, result.id);
  }

  return staffIds;
}

async function seedTellers(api, tellers, officeIdsByName, staffIds) {
  const existing = await api.get('/tellers');
  const list = Array.isArray(existing) ? existing : (existing.pageItems ?? []);

  for (const teller of tellers) {
    const officeId = officeIdsByName.get(teller.office);
    if (!officeId) {
      log.error(`teller "${teller.name}": office "${teller.office}" not found — skipped`);
      continue;
    }

    const result = await ensure({
      label: `Teller "${teller.name}"`,
      list: async () => list,
      match: (t) => t.name === teller.name,
      create: async () => {
        const created = await api.post('/tellers', {
          officeId,
          name: teller.name,
          description: teller.description,
          startDate: teller.startDate,
          status: teller.status ?? 300,
          ...DATE_FMT
        });
        const record = { id: created.resourceId, name: teller.name };
        list.push(record);
        return record;
      }
    });

    if (teller.cashier) {
      await seedCashier(api, result.id, teller.cashier, staffIds);
    }
  }
}

async function seedCashier(api, tellerId, cashier, staffIds) {
  const staffKey = `${cashier.staffFirstname}|${cashier.staffLastname}`;
  const staffId = staffIds.get(staffKey);
  if (!staffId) {
    log.error(
      `cashier for teller ${tellerId}: staff ${cashier.staffFirstname} ${cashier.staffLastname} not found — skipped`
    );
    return;
  }

  const template = await api.get(`/tellers/${tellerId}/cashiers`);
  const cashiers = template?.cashiers ?? template?.pageItems ?? (Array.isArray(template) ? template : []);

  await ensure({
    label: `Cashier ${cashier.staffFirstname} ${cashier.staffLastname} on teller ${tellerId}`,
    list: async () => cashiers,
    match: (c) => c.staffId === staffId || c.staffName?.includes(cashier.staffLastname),
    create: async () => {
      const created = await api.post(`/tellers/${tellerId}/cashiers`, {
        staffId,
        description: cashier.description,
        startDate: cashier.startDate,
        endDate: cashier.endDate,
        isFullDay: cashier.isFullDay !== false,
        ...DATE_FMT
      });
      const record = { id: created.resourceId, staffId };
      cashiers.push(record);
      return record;
    }
  });
}

/**
 * Attach staffId on matching app users so teller/loan-officer screens show a name.
 */
async function linkUsersToStaff(api, staffList, staffIds) {
  const users = await api.get('/users');
  const list = Array.isArray(users) ? users : (users.pageItems ?? []);

  for (const person of staffList) {
    if (!person.linkUser) continue;
    const staffId = staffIds.get(`${person.firstname}|${person.lastname}`);
    const user = list.find((u) => u.username === person.linkUser);
    if (!staffId || !user) {
      log.skip(`link ${person.linkUser} → staff — user or staff missing`);
      continue;
    }
    if (user.staffId === staffId) {
      log.skip(`user "${person.linkUser}" already linked to staff ${staffId}`);
      continue;
    }

    try {
      const detail = await api.get(`/users/${user.id}`);
      await api.put(`/users/${user.id}`, {
        username: detail.username,
        firstname: detail.firstname,
        lastname: detail.lastname,
        email: detail.email,
        officeId: detail.officeId,
        staffId,
        roles: (detail.selectedRoles ?? detail.roles ?? []).map((r) => r.id ?? r)
      });
      log.created(`linked user "${person.linkUser}" to staff ${staffId}`);
    } catch (err) {
      log.warn(`could not link user "${person.linkUser}": ${err.message}`);
    }
  }
}
