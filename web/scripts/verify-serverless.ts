import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { deleteApp } from 'firebase-admin/app';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/db';
import { acquireJobLease, releaseJobLease } from '../src/lib/jobLease';
import { readCacheRevision, invalidateServerReads } from '../src/lib/readCacheRevision';
import { cachedServerRead } from '../src/lib/serverReadCache';
import { queueAnnouncementBatch, runScheduledWork } from '../src/lib/scheduledWork';
import { processNotificationOutbox } from '../src/lib/notifications';
import { initFirebaseAdmin } from '../src/lib/firebaseAdmin';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const loadModule = createRequire(import.meta.url);
  const tag = 'verify-serverless-' + randomUUID();
  const users: string[] = [], members: string[] = [], announcements: string[] = [];
  const second = new PrismaClient();
  let server: ChildProcess | undefined;
  let globalLease: string | null = null;
  let passed = 0;
  const check = (label: string, good: unknown) => { if (!good) throw new Error(label); passed++; console.log('PASS ' + label); };
  try {
    const { buildDeploymentEnv } = loadModule('./prepare-vercel-env.cjs');
    const key = 'verification-key\nsecond-line';
    const prepared = buildDeploymentEnv({ DATABASE_URL: 'postgres://example.invalid/db', SESSION_SECRET: 'verification-secret-at-least-32-characters', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'verification', client_email: 'test@example.invalid', private_key: key }) }, 'https://verification.example.invalid');
    const parsed = loadModule('dotenv').parse(prepared.content);
    check('Firebase JSON survives environment import including newline', JSON.parse(parsed.FIREBASE_SERVICE_ACCOUNT_JSON).private_key === key);
    check('deployment URLs use HTTPS and cron secret generated', parsed.APP_URL === 'https://verification.example.invalid' && parsed.CRON_SECRET.length >= 32);
    check('local service account path is excluded from deployment export', !parsed.FIREBASE_SERVICE_ACCOUNT_PATH);
    let insecureRejected = false;
    try { buildDeploymentEnv({}, 'http://example.invalid'); } catch { insecureRejected = true; }
    check('insecure deployment origin rejected', insecureRejected);
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const oldJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const oldPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const account = JSON.parse(oldJson || fs.readFileSync(path.resolve(oldPath!), 'utf8'));
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(account);
      delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      let app;
      try {
        app = initFirebaseAdmin();
        check('Firebase Admin initializes with JSON env and no credential file', app && app.options.projectId === account.project_id);
        const access = await app!.options.credential!.getAccessToken();
        check('Firebase env credential authentication succeeds without push send', !!access.access_token && access.expires_in > 0);
      } finally {
        if (app) await deleteApp(app);
        if (oldJson === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = oldJson;
        if (oldPath !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT_PATH = oldPath;
      }
    }

    const leaseKey = tag + ':lease-test';
    const leases = await Promise.all([acquireJobLease(leaseKey), acquireJobLease(leaseKey)]);
    const winner = leases.find(Boolean)!;
    check('overlapping job acquisition has one winner', leases.filter(Boolean).length === 1);
    await releaseJobLease(leaseKey, 'not-the-owner');
    check('non-owner cannot release active lease', !!await prisma.runtimeState.findUnique({ where: { key: leaseKey } }));
    await prisma.runtimeState.update({ where: { key: leaseKey }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const replacement = await acquireJobLease(leaseKey);
    check('expired job lease can be recovered', replacement && replacement !== winner);
    await releaseJobLease(leaseKey, winner);
    check('expired owner cannot delete replacement lease', (await prisma.runtimeState.findUniqueOrThrow({ where: { key: leaseKey } })).value === replacement);

    await invalidateServerReads();
    const revision = await readCacheRevision();
    check('shared cache revision is readable by another database client', revision && (await second.runtimeState.findUnique({ where: { key: 'read-cache-revision' } }))?.value === revision);
    let reads = 0;
    const read = async () => ++reads;
    await cachedServerRead(tag, read, tag, {});
    await cachedServerRead(tag, read, tag, {});
    check('server cache reuses reads with unchanged shared revision', reads === 1);
    await second.runtimeState.update({ where: { key: 'read-cache-revision' }, data: { value: randomUUID() } });
    check('cross-instance write invalidates cached read', await cachedServerRead(tag, read, tag, {}) === 2);

    const blocking = await acquireJobLease(tag + ':lease');
    check('scheduled runner skips overlapping execution', blocking && (await runScheduledWork({ namespace: tag, memberIds: [], announcementIds: [], eventIds: [] })).skipped);
    await releaseJobLease(tag + ':lease', blocking!);

    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({ data: { name: tag, role: 'MEMBER' } }); users.push(user.id);
      const member = await prisma.gymMember.create({ data: { fullName: tag, memberId: tag + '-' + i, phone: '03000000000', userId: user.id } }); members.push(member.id);
    }
    const author = await prisma.user.create({ data: { name: tag, role: 'OWNER' } }); users.push(author.id);
    const ann = await prisma.announcement.create({ data: { authorId: author.id, title: tag, content: 'Isolated in-app verification', audience: 'SELECTED_MEMBERS', targetMemberIds: users.slice(0, 3), channels: ['IN_APP'], publishAt: new Date(Date.now() - 1000) } }); announcements.push(ann.id);
    const first = await queueAnnouncementBatch(ann, 2);
    check('announcement queue is bounded to recipient page', first.queued === 2 && !first.complete);
    const last = await queueAnnouncementBatch(ann, 2);
    check('next announcement batch resumes remaining recipients', last.queued === 1 && last.complete);
    check('queued announcement recipient total is accurate', (await prisma.announcement.findUniqueOrThrow({ where: { id: ann.id } })).recipientCount === 3);
    check('completed announcement does not requeue', (await queueAnnouncementBatch(ann, 2)).queued === 0);
    const events = await prisma.notificationEvent.findMany({ where: { recipientUserId: { in: users }, entityId: ann.id }, select: { id: true } });
    check('recipient events are unique and isolated', events.length === 3);
    const run = await runScheduledWork({ namespace: tag, memberIds: members, announcementIds: [ann.id], eventIds: events.map(e => e.id), maxMillis: 60000, batchSize: 2 });
    check('serverless runner completes bounded scoped work', run.success && !run.skipped && run.results?.membersProcessed === 2);
    check('member cursor persists for next invocation', !!(await prisma.runtimeState.findUnique({ where: { key: tag + ':member-cursor' } }))?.value);
    check('outbox delivers only selected in-app fixture events', await prisma.notification.count({ where: { userId: { in: users }, announcementId: ann.id } }) === 3);
    check('outbox rerun is idempotent', (await processNotificationOutbox(10, events.map(e => e.id))).results.processedCount === 0);
    check('external notification channels are skipped', await prisma.notification.count({ where: { userId: { in: users }, OR: [{ emailStatus: 'ACCEPTED' }, { pushStatus: 'ACCEPTED' }] } }) === 0);
    const cancelled = await prisma.announcement.create({ data: { authorId: author.id, title: tag, content: 'Cancelled test announcement', audience: 'SELECTED_MEMBERS', targetMemberIds: [users[0]], channels: ['IN_APP'], publishAt: new Date(Date.now() - 1000) } }); announcements.push(cancelled.id);
    await queueAnnouncementBatch(cancelled, 2);
    await prisma.announcement.update({ where: { id: cancelled.id }, data: { isPublished: false } });
    const cancelledEvents = await prisma.notificationEvent.findMany({ where: { entityId: cancelled.id }, select: { id: true } });
    await processNotificationOutbox(10, cancelledEvents.map(e => e.id));
    check('cancelled announcement is not delivered from queued outbox', await prisma.notification.count({ where: { announcementId: cancelled.id } }) === 0);
    check('cancelled delivery events retire safely', await prisma.notificationEvent.count({ where: { entityId: cancelled.id, processed: false } }) === 0);
    const deadlineRun = await runScheduledWork({ namespace: tag + '-deadline', memberIds: members, announcementIds: [], eventIds: [], maxMillis: 0 });
    check('expired execution budget stops work without losing rows', deadlineRun.success && !deadlineRun.skipped && deadlineRun.results?.membersProcessed === 0);

    if (process.argv.includes('--http')) {
      const probe = createServer();
      await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
      const port = (probe.address() as { port: number }).port;
      await new Promise<void>(resolve => probe.close(() => resolve()));
      const secret = randomUUID() + randomUUID();
      server = spawn(process.execPath, [loadModule.resolve('next/dist/bin/next'), 'start', '-p', String(port)], { cwd: process.cwd(), env: { ...process.env, CRON_SECRET: secret }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      // Observe only this fixed scheduler marker; never print server logs/credentials.
      let backgroundSkipped = false;
      let schedulerOutput = '';
      server.stdout?.on('data', chunk => {
        schedulerOutput = (schedulerOutput + chunk.toString()).slice(-4096);
        backgroundSkipped ||= schedulerOutput.includes('SCHEDULER_BATCH_COMPLETE: {"success":true,"skipped":true');
      });
      server.stderr?.resume();
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 50; i++) {
        try { await fetch(base + '/api/auth/me', { signal: AbortSignal.timeout(2000) }); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
      }
      const unauthorized = await fetch(base + '/api/v1/scheduler/reminders');
      check('cron GET rejects missing secret', unauthorized.status === 403);
      const wrong = await fetch(base + '/api/v1/scheduler/reminders', { headers: { Authorization: 'Bearer wrong-secret' } });
      check('cron GET rejects wrong secret', wrong.status === 403);
      globalLease = await acquireJobLease('scheduler:lease');
      if (!globalLease) throw new Error('Cannot isolate HTTP cron test while scheduler is active');
      const triggerStart = Date.now();
      const correct = await fetch(base + '/api/v1/scheduler/reminders', { headers: { Authorization: 'Bearer ' + secret }, signal: AbortSignal.timeout(5000) });
      check('external cron GET quickly acknowledges authorized trigger without claiming completion', correct.status === 202 && (await correct.json()).accepted === true && Date.now() - triggerStart < 5000 && correct.headers.get('cache-control') === 'private, no-store');
      for (let i = 0; i < 75 && !backgroundSkipped; i++) await new Promise(resolve => setTimeout(resolve, 200));
      check('post-response background callback runs and safely skips overlapping work', backgroundSkipped);
      const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      await prisma.session.create({ data: { userId: users[0], token, expiresAt: new Date(Date.now() + 60000) } });
      const sync = await fetch(base + '/api/v1/cache-sync', { headers: { Authorization: 'Bearer ' + token } });
      check('cache-sync returns short authenticated JSON response', sync.ok && sync.headers.get('content-type')?.includes('application/json') && typeof (await sync.json()).revision === 'string');
      const memberPost = await fetch(base + '/api/v1/scheduler/reminders', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      check('member cannot manually run scheduler', memberPost.status === 403);
      const ownerToken = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      await prisma.session.create({ data: { userId: author.id, token: ownerToken, expiresAt: new Date(Date.now() + 120000) } });
      const ownerPost = await fetch(base + '/api/v1/scheduler/reminders', { method: 'POST', headers: { Authorization: 'Bearer ' + ownerToken } });
      check('owner POST still triggers authorized scheduler', ownerPost.ok && (await ownerPost.json()).skipped === true);
      const createdResponse = await fetch(base + '/api/v1/announcements', { method: 'POST', headers: { Authorization: 'Bearer ' + ownerToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: tag, content: 'HTTP verification only', audience: 'SELECTED_MEMBERS', targetMemberIds: users.slice(0, 3), channels: ['IN_APP'] }) });
      const created = await createdResponse.json();
      if (created.data?.id) announcements.push(created.data.id);
      check('announcement HTTP publish returns without synchronous broadcast', createdResponse.ok && created.data?.recipientCount === 0 && await prisma.notification.count({ where: { announcementId: created.data.id } }) === 0);
      const updateResponse = await fetch(base + '/api/v1/owner/announcements/' + ann.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + ownerToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: tag + ' updated', notifyUpdate: true }) });
      const updatedEvents = await prisma.notificationEvent.count({ where: { entityId: ann.id, eventType: 'ANNOUNCEMENT_UPDATED', processed: false } });
      check('notify-update HTTP queues one event per existing recipient', updateResponse.ok && updatedEvents === 3);
    }
    const config = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
    check('external scheduler configuration contains no Vercel cron plan restriction', !config.crons?.length);
    console.log(JSON.stringify({ check: 'serverless-deployment', passed, failed: 0, emailsSent: 0 }));
  } finally {
    server?.kill();
    if (globalLease) await releaseJobLease('scheduler:lease', globalLease);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: members } } });
    await prisma.gymMember.deleteMany({ where: { id: { in: members } } });
    await prisma.announcement.deleteMany({ where: { id: { in: announcements } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.runtimeState.deleteMany({ where: { OR: [{ key: { startsWith: tag } }, { key: { in: announcements.map(id => 'announcement:' + id) } }] } });
    await second.$disconnect(); await prisma.$disconnect();
    console.log('Serverless verification fixtures cleaned up');
  }
}
main().catch(error => { console.error('FAIL ' + (error instanceof Error ? error.message : 'serverless verification')); process.exitCode = 1; });
