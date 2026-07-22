import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true, odds: true },
  });
  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(match);
}
