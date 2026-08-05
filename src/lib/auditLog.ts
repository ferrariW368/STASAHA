import { prisma } from './prisma';

export type AdminAction = 'DELETE_USER' | 'EDIT_USER' | 'RESET_PASSWORD' | 'ADJUST_BALANCE';

export async function logAdminAction(
  adminUserId: string,
  targetUserId: string | null,
  action: AdminAction,
  detail?: string
): Promise<void> {
  await prisma.adminActionLog.create({
    data: { adminUserId, targetUserId, action, detail: detail ?? null },
  });
}
