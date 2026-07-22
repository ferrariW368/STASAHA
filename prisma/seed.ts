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

  await prisma.player.createMany({
    data: [
      { teamId: teamA.id, name: 'Ahmet', number: 9 },
      { teamId: teamA.id, name: 'Mehmet', number: 7 },
      { teamId: teamB.id, name: 'Burak', number: 10 },
      { teamId: teamB.id, name: 'Emre', number: 11 },
    ],
  });

  console.log('Seed complete. Admin login: admin / admin123');
}

main().finally(() => prisma.$disconnect());
