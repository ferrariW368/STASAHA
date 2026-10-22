'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

function clampAttribute(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(99, Math.round(value)));
}

const VALID_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

export async function updatePlayerProfile(
  playerId: string,
  profile: {
    styleInspiration: string;
    position: string | null;
    pace: number | null;
    shooting: number | null;
    passing: number | null;
    dribbling: number | null;
    defending: number | null;
    physical: number | null;
    marketValue: number | null;
  }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.player.update({
    where: { id: playerId },
    data: {
      styleInspiration: profile.styleInspiration.trim() || null,
      position: profile.position && VALID_POSITIONS.includes(profile.position) ? profile.position : null,
      pace: clampAttribute(profile.pace),
      shooting: clampAttribute(profile.shooting),
      passing: clampAttribute(profile.passing),
      dribbling: clampAttribute(profile.dribbling),
      defending: clampAttribute(profile.defending),
      physical: clampAttribute(profile.physical),
      marketValue:
        profile.marketValue !== null && Number.isFinite(profile.marketValue)
          ? Math.max(0, Math.round(profile.marketValue))
          : null,
    },
  });

  revalidatePath('/admin/players');
  revalidatePath('/players');
  revalidatePath(`/players/${playerId}`);
  return {};
}

export async function transferPlayer(playerId: string, newTeamId: string | null) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.player.update({ where: { id: playerId }, data: { teamId: newTeamId } });

  revalidatePath('/admin/players');
  revalidatePath('/admin/teams');
  revalidatePath('/players');
  revalidatePath(`/players/${playerId}`);
  return {};
}

export async function deletePlayer(playerId: string): Promise<{ error?: string }> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const target = await prisma.player.findUnique({ where: { id: playerId } });
  if (!target) return { error: 'Oyuncu bulunamadı.' };

  // Same guard philosophy as deleteTeam: a player who has actually appeared
  // in a match carries real match history (goals, events, roster snapshots)
  // that would otherwise dangle or need silent destruction. Block instead of
  // cascading through match data.
  const appearanceCount = await prisma.matchAppearance.count({ where: { playerId } });
  if (appearanceCount > 0) {
    return { error: 'Bu oyuncu maçlarda oynadı, önce o maçları silmeden oyuncu silinemez.' };
  }

  await prisma.$transaction([
    // Pending/approved lineup slots and transfer-news mentions are just
    // squad-building/roster state, not settled match history — safe to
    // clear along with the player.
    prisma.lineupSlot.deleteMany({ where: { playerId } }),
    prisma.transferNews.deleteMany({ where: { playerId } }),
    prisma.player.delete({ where: { id: playerId } }),
  ]);

  revalidatePath('/admin/players');
  revalidatePath('/admin/teams');
  revalidatePath('/players');
  return {};
}
