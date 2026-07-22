import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'admin',
      staBalance: 1000,
    },
  });

  const teamA = await prisma.team.upsert({
    where: { id: 'seed-team-a' },
    update: {},
    create: { id: 'seed-team-a', name: 'Kartallar' },
  });
  const teamB = await prisma.team.upsert({
    where: { id: 'seed-team-b' },
    update: {},
    create: { id: 'seed-team-b', name: 'Aslanlar' },
  });

  // NOTE: `skipDuplicates` is not supported by the SQLite connector (Prisma
  // Client omits it from the generated `createMany` args entirely for this
  // provider, regardless of Prisma version), so per-row upserts with
  // deterministic ids are used instead to keep this seed idempotent.
  const players = [
    { id: 'seed-player-1', teamId: teamA.id, name: 'Ahmet', number: 9 },
    { id: 'seed-player-2', teamId: teamA.id, name: 'Mehmet', number: 7 },
    { id: 'seed-player-3', teamId: teamB.id, name: 'Burak', number: 10 },
    { id: 'seed-player-4', teamId: teamB.id, name: 'Emre', number: 11 },
  ];
  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: {},
      create: player,
    });
  }

  console.log('Seed complete. Admin login: admin / admin123');
}

main().finally(() => prisma.$disconnect());
