import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/db';
import { sendPushNotification } from '../src/lib/firebaseAdmin';
import { invalidateServerReads } from '../src/lib/readCacheRevision';

async function main() {
  const fixture = JSON.parse(fs.readFileSync(path.resolve('../mobile/.expo/device-fixture.json'), 'utf8'));
  const userId = fixture.userIds[0] as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email || user.email !== fixture.identifier || !user.email.endsWith('@example.invalid')) throw new Error('Isolated device fixture required');
  const devices = await prisma.devicePushToken.findMany({ where: { userId, platform: 'android' } });
  if (devices.length !== 1) throw new Error('Expected exactly one registered test Android device');
  const stage = process.argv[2] || 'background';
  if (!['background', 'foreground', 'cold-start'].includes(stage)) throw new Error('Invalid test stage');
  const title = `OXGEN device test: ${stage}`;
  const message = 'Notification delivery test on your connected phone.';
  const notification = await prisma.notification.create({ data: { userId, title, message, actionUrl: '/notifications' } });
  await invalidateServerReads();
  const result = await sendPushNotification([devices[0].token], { title, body: message, data: { actionUrl: '/notifications', verificationStage: stage } });
  console.log(JSON.stringify({ stage, registeredTestDevices: devices.length, success: result.success, successCount: result.successCount, failureCount: result.failureCount, error: result.error }));
  if (!result.success || result.successCount !== 1) throw new Error('FCM did not accept test notification');
  await prisma.notification.update({ where: { id: notification.id }, data: { deliveryStatus: 'ACCEPTED', pushStatus: 'ACCEPTED' } });
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Push test failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
