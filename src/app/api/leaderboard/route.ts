import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeUserScore } from '@/lib/score';

export async function GET() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    include: { bets: true },
  });

  const ranked = users
    .map((u) => {
      const total = u.bets.length;
      const won = u.bets.filter((b) => b.status === 'won').length;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      return { username: u.username, staBalance: u.staBalance, total, winRate, score: computeUserScore(u.bets) };
    })
    .sort((a, b) => b.score.net - a.score.net);

  return NextResponse.json(ranked);
}
