require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const db = new PrismaClient();
const file = path.resolve(__dirname, '../../mobile/.expo/device-fixture.json');
async function main() {
  try {
    if (process.argv.includes('--cleanup')) {
      if (!fs.existsSync(file)) return;
      const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
      await db.auditLog.deleteMany({ where: { actorId: { in: fixture.userIds } } });
      await db.gymMember.deleteMany({ where: { id: fixture.memberId } });
      await db.user.deleteMany({ where: { id: { in: fixture.userIds } } });
      fs.unlinkSync(file); console.log('Device fixture removed'); return;
    }
    if (fs.existsSync(file)) { console.log('Existing isolated device fixture reused'); return; }
    const tag = 'device-' + crypto.randomBytes(5).toString('hex'), password = 'Verify-' + crypto.randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({ data: { name: 'Phone Verification', email: tag + '@example.invalid', role: 'MEMBER', passwordHash } });
    const fixture = { identifier: user.email, password, userIds: [user.id], memberId: null };
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(fixture));
    const trainer = await db.user.create({ data: { name: 'Verification Coach', email: tag + '-coach@example.invalid', role: 'TRAINER', passwordHash } });
    fixture.userIds.push(trainer.id); fs.writeFileSync(file, JSON.stringify(fixture));
    const member = await db.gymMember.create({ data: { memberId: tag, fullName: 'Phone Verification', phone: '03000000000', email: user.email, userId: user.id } });
    fixture.memberId = member.id; fs.writeFileSync(file, JSON.stringify(fixture));
    await db.trainerAssignment.create({ data: { gymMemberId: member.id, trainerId: trainer.id, assignedById: trainer.id, consentMeasurements: true } });
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Karachi' }).format(new Date()).toUpperCase();
    await db.workoutPlan.create({ data: { title: 'Device strength plan', goal: 'Verification', status: 'PUBLISHED', gymMemberId: member.id, trainerId: trainer.id, workoutDays: { create: { title: 'Device training', dayOfWeek: weekday, exercises: { create: { name: 'Bodyweight squat', sets: 1, reps: '8', restSeconds: 30, instructions: 'Keep your back neutral.' } } } } } });
    await db.dietPlan.create({ data: { title: 'Device meal plan', goal: 'Verification', status: 'PUBLISHED', gymMemberId: member.id, trainerId: trainer.id, mealSlots: { create: { title: 'Breakfast', slotType: 'BREAKFAST', foodItems: 'Oats 50g' } } } });
    await db.progressMeasurement.create({ data: { gymMemberId: member.id, weightKg: 80, isBaseline: true } });
    console.log('Isolated device fixture ready; credentials stored only in ignored local file');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e.code || e.name); process.exitCode = 1; });
