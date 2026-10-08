require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const db = new PrismaClient();
const base = process.env.GYM_VERIFY_URL || 'http://localhost:3003';
const tag = 'verify-mobile-' + crypto.randomBytes(6).toString('hex');
const password = 'Verify-' + crypto.randomBytes(12).toString('hex');
const ids = []; let passed = 0;
function check(name, valid) { if (!valid) throw new Error(name); passed++; console.log('PASS ' + name); }
async function api(path, options = {}) { const response = await fetch(base + path, { redirect: 'manual', ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(60000) }); const data = await response.json().catch(() => null); return { response, data }; }
async function main() {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const member = await db.user.create({ data: { name: tag, email: tag + '@example.invalid', role: 'MEMBER', passwordHash } }); ids.push(member.id);
    const owner = await db.user.create({ data: { name: tag, email: tag + '-owner@example.invalid', role: 'OWNER', passwordHash } }); ids.push(owner.id);
    await db.gymMember.create({ data: { fullName: tag, memberId: tag, phone: '03000000000', userId: member.id } });
    const body = JSON.stringify({ identifier: member.email, password, portal: 'member' });
    const native = await api('/api/auth/login', { method: 'POST', headers: { 'X-Gym-Client': 'mobile' }, body });
    check('mobile member login returns token', native.data?.success && native.data.user.role === 'MEMBER' && typeof native.data.token === 'string');
    const auth = { Authorization: 'Bearer ' + native.data.token };
    const web = await api('/api/auth/login', { method: 'POST', body });
    check('web member login still hides token', web.data?.success && web.data.token === undefined);
    const staff = await api('/api/auth/login', { method: 'POST', headers: { 'X-Gym-Client': 'mobile' }, body: JSON.stringify({ identifier: owner.email, password, portal: 'member' }) });
    check('staff blocked from mobile member login', staff.response.status === 403);
    check('bearer session restored', (await api('/api/auth/me', { headers: auth })).data?.user?.id === member.id);
    check('bearer dashboard uses own member', (await api('/api/v1/member/dashboard', { headers: auth })).data?.data?.member?.memberId === tag);
    check('member bearer cannot access admin', (await api('/api/v1/members', { headers: auth })).response.status === 403);
    const webCookie = web.response.headers.get('set-cookie')?.split(';')[0];
    check('malformed bearer cannot fall back to cookie', (await api('/api/auth/me', { headers: { Authorization: 'Bearer invalid', Cookie: webCookie } })).response.status === 401);
    const logout = await api('/api/auth/logout', { method: 'POST', headers: { ...auth, Cookie: webCookie }, body: '{}' });
    check('logout uses bearer instead of unrelated cookie session', logout.data?.success && (await api('/api/auth/me', { headers: auth })).response.status === 401 && (await api('/api/auth/me', { headers: { Cookie: webCookie } })).response.ok);
    const second = await api('/api/auth/login', { method: 'POST', headers: { 'X-Gym-Client': 'mobile' }, body });
    check('mobile second login succeeds', second.data?.success);
    await api('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + second.data.token }, body: JSON.stringify({ allDevices: true }) });
    check('mobile all-device logout revokes web session too', (await api('/api/auth/me', { headers: { Cookie: webCookie } })).response.status === 401);
    console.log(JSON.stringify({ check: 'mobile-auth-contract', passed, failed: 0 }));
  } catch (error) { console.log('FAIL ' + (error.code || error.message)); process.exitCode = 1; }
  finally { await db.auditLog.deleteMany({ where: { actorId: { in: ids } } }); await db.gymMember.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); }
}
main();
