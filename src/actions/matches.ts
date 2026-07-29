'use server';

import { prisma } from '@/lib/prisma';
import { computeMatchOdds } from '@/lib/odds';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { Player } from '@prisma/client';

// A player's starting position for this match should reflect the formation
// they were actually placed in when their squad was built via Kadro Planla
// (Kadro Planla lets any player fill any slot, so a player's own default
// Player.position can differ from the row they were drafted into) — not
// just their own default position. Falls back to Player.position only if
// they were never part of an approved lineup (e.g. added directly via the
// admin panel rather than through a submitted squad).
async function resolveAppearancePosition(player: Player): Promise<string | null> {
  const slot = await prisma.lineupSlot.findFirst({
    where: { playerId: player.id, lineup: { status: 'approved' } },
    orderBy: { lineup: { createdAt: 'desc' } },
  });
  return slot?.position ?? player.position;
}

export async function createMatch(
  homeTeamId: string,
  awayTeamId: string,
  kickoffTime: Date,
  ouLine: number,
  htOuLine: number
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (homeTeamId === awayTeamId) {
    return { error: 'Ev sahibi ve deplasman takımı aynı olamaz.' };
  }
  if (!Number.isFinite(ouLine) || ouLine <= 0) {
    return { error: 'Geçerli bir toplam gol çizgisi gir (örn. 9.5).' };
  }
  if (!Number.isFinite(htOuLine) || htOuLine <= 0) {
    return { error: 'Geçerli bir ilk yarı gol çizgisi gir (örn. 4.5).' };
  }

  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.player.findMany({ where: { teamId: homeTeamId } }),
    prisma.player.findMany({ where: { teamId: awayTeamId } }),
  ]);

  const match = await prisma.match.create({
    data: { homeTeamId, awayTeamId, kickoffTime, status: 'upcoming' },
  });

  const matchSeed = `${match.id}:${homeTeamId}:${awayTeamId}:${kickoffTime.toISOString()}`;
  const oddsRows = computeMatchOdds(
    homePlayers.map((p) => p.id),
    awayPlayers.map((p) => p.id),
    matchSeed,
    ouLine,
    htOuLine
  );

  await prisma.odds.createMany({
    data: oddsRows.map((o) => ({ matchId: match.id, market: o.market, selectionKey: o.selectionKey, oddsValue: o.oddsValue })),
  });

  const [homePositions, awayPositions] = await Promise.all([
    Promise.all(homePlayers.map(resolveAppearancePosition)),
    Promise.all(awayPlayers.map(resolveAppearancePosition)),
  ]);

  await prisma.matchAppearance.createMany({
    data: [
      ...homePlayers.map((p, i) => ({ matchId: match.id, playerId: p.id, teamId: homeTeamId, position: homePositions[i] })),
      ...awayPlayers.map((p, i) => ({ matchId: match.id, playerId: p.id, teamId: awayTeamId, position: awayPositions[i] })),
    ],
  });

  revalidatePath('/admin');
  revalidatePath('/');
  return { matchId: match.id };
}

export async function cancelMatch(matchId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: 'Maç bulunamadı.' };
  if (match.status === 'finished') return { error: 'Sonuçlandırılmış bir maç iptal edilemez.' };
  if (match.status === 'cancelled') return { error: 'Bu maç zaten iptal edilmiş.' };

  const bets = await prisma.bet.findMany({ where: { matchId, status: 'pending' } });

  await prisma.$transaction([
    prisma.match.update({ where: { id: matchId }, data: { status: 'cancelled' } }),
    ...bets.flatMap((bet) => [
      prisma.bet.update({ where: { id: bet.id }, data: { status: 'refunded' } }),
      prisma.user.update({ where: { id: bet.userId }, data: { staBalance: { increment: bet.stake } } }),
    ]),
  ]);

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/bets');
  return {};
}
