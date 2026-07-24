import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const players = await prisma.player.findMany({
    include: { team: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(
    players.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
      teamName: p.team?.name ?? null,
    }))
  );
}
