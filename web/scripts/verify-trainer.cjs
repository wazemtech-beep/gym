require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const db = new PrismaClient();
const base = process.env.GYM_VERIFY_URL || 'http://localhost:3003';
const tag = 'verify-trainer-' + crypto.randomBytes(6).toString('hex');
const users = [], members = []; let passed = 0, failed = 0;
function check(label, ok) { console.log((ok ? 'PASS ' : 'FAIL ') + label); ok ? passed++ : failed++; }
async function api(path, cookie, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Cookie: cookie || '', 'Content-Type': 'application/json', 'X-Gym-Fresh': '1' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
  return { response, data: await response.json().catch(() => null) };
}
async function main() {
  try {
    const password = 'Verify-' + crypto.randomBytes(12).toString('hex'), passwordHash = await bcrypt.hash(password, 10);
    async function user(role, suffix) { const u = await db.user.create({ data: { name: tag, email: tag + suffix + '@example.invalid', role, passwordHash } }); users.push(u.id); return u; }
    const trainer = await user('TRAINER', 't'), outsider = await user('TRAINER', 'o'), memberUser = await user('MEMBER', 'm');
    const member = await db.gymMember.create({ data: { fullName: tag, memberId: tag, phone: '03000000000' } }); members.push(member.id);
    const foreign = await db.gymMember.create({ data: { fullName: tag, memberId: tag + 'foreign', phone: '03000000001' } }); members.push(foreign.id);
    async function login(u) { const r = await api('/api/auth/login', '', 'POST', { identifier: u.email, password, portal: u.role === 'MEMBER' ? 'member' : 'admin' }); check('login ' + u.role, r.data?.success); const cookie = r.response.headers.get('set-cookie')?.split(';')[0]; if (!cookie) throw Error('fixture login'); return cookie; }
    const cookie = await login(trainer), otherCookie = await login(outsider), memberCookie = await login(memberUser);
    const assignment = await db.trainerAssignment.create({ data: { gymMemberId: member.id, trainerId: trainer.id, assignedById: trainer.id, consentMeasurements: true } });
    const reading = await db.progressMeasurement.create({ data: { gymMemberId: member.id, weightKg: 80, isBaseline: true } });
    const foreignReading = await db.progressMeasurement.create({ data: { gymMemberId: foreign.id, weightKg: 70 } });
    const prefix = '/api/v1/trainer/members/' + member.id;
    check('assigned member plans readable', (await api(prefix + '/plans', cookie)).response.ok);
    check('unassigned trainer plans denied', (await api(prefix + '/plans', otherCookie)).response.status === 403);
    check('member cannot use trainer plans API', (await api(prefix + '/plans', memberCookie)).response.status === 403);
    check('assigned progress readable', (await api(prefix + '/progress', cookie)).data?.data?.consentGranted === true);
    check('unassigned progress feedback denied', (await api(prefix + '/progress', otherCookie, 'POST', { measurementId: reading.id, feedback: 'Denied' })).response.status === 403);
    check('foreign measurement feedback denied', (await api(prefix + '/progress', cookie, 'POST', { measurementId: foreignReading.id, feedback: 'Denied' })).response.status === 404);
    check('assigned progress feedback saved', (await api(prefix + '/progress', cookie, 'POST', { measurementId: reading.id, feedback: 'Good progress' })).data?.success);
    check('feedback does not alter measurement', (await db.progressMeasurement.findUnique({ where: { id: reading.id } })).weightKg === 80);
    const workout = await api(prefix + '/plans', cookie, 'POST', { title: tag, goal: 'Strength', workoutDays: [{ title: 'Full body', exercises: [{ name: 'Squat', sets: 3, reps: '8', restSeconds: 60 }] }] });
    check('workout draft with exercises saved', workout.data?.data?.status === 'DRAFT' && workout.data.data.workoutDays[0]?.exercises.length === 1);
    if (workout.data?.data?.id) {
      check('foreign trainer cannot publish workout', (await api('/api/v1/trainer/plans/' + workout.data.data.id + '/publish', otherCookie, 'POST', {})).response.status === 403);
      check('assigned trainer publishes workout', (await api('/api/v1/trainer/plans/' + workout.data.data.id + '/publish', cookie, 'POST', {})).data?.data?.status === 'PUBLISHED');
    }
    await db.memberDietPreference.create({ data: { gymMemberId: member.id, allergies: 'peanuts' } });
    check('diet allergy conflict blocked', (await api(prefix + '/diet', cookie, 'POST', { title: tag, goal: 'Fitness', mealSlots: [{ title: 'Breakfast', foodItems: 'peanuts' }] })).response.status === 400);
    const diet = await api(prefix + '/diet', cookie, 'POST', { title: tag, goal: 'Fitness', mealSlots: [{ title: 'Breakfast', foodItems: 'Oats 50g', slotType: 'BREAKFAST' }] });
    check('diet draft saved', diet.data?.data?.status === 'DRAFT');
    if (diet.data?.data?.id) check('assigned trainer publishes diet', (await api('/api/v1/trainer/diet/plans/' + diet.data.data.id + '/publish', cookie, 'POST', {})).data?.data?.status === 'PUBLISHED');
    await db.trainerAssignment.update({ where: { id: assignment.id }, data: { consentMeasurements: false } });
    check('revoked consent hides readings', (await api(prefix + '/progress', cookie)).data?.data?.measurements?.length === 0);
    check('revoked consent blocks feedback', (await api(prefix + '/progress', cookie, 'POST', { measurementId: reading.id, feedback: 'Denied' })).response.status === 403);
    await db.trainerAssignment.update({ where: { id: assignment.id }, data: { isActive: false } });
    check('inactive assignment blocks diet', (await api(prefix + '/diet', cookie)).response.status === 403);
    check('inactive assignment blocks plans', (await api(prefix + '/plans', cookie)).response.status === 403);
  } catch (e) { failed++; console.log('FAIL ' + (e.code || e.message)); }
  finally { await db.auditLog.deleteMany({ where: { actorId: { in: users } } }); await db.gymMember.deleteMany({ where: { id: { in: members } } }); await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); console.log('Fixture cleanup completed'); }
  console.log(JSON.stringify({ check: 'trainer-contract', passed, failed, emailsSent: 0 })); process.exitCode = failed ? 1 : 0;
}
main();
