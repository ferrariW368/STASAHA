import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRace } from '@/lib/horseRaceEngine';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user?.name
    ? await prisma.user.findUnique({ where: { username: session.user.name }, select: { id: true } })
    : null;

  const race = await getCurrentRace(user?.id);
  return NextResponse.json(race);
}
