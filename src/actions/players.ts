'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

function clampAttribute(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(99, Math.round(value)));
}

export async function updatePlayerProfile(
  playerId: string,
  profile: {
    styleInspiration: string;
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
