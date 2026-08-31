import { prisma } from "./db";

const AUTO_UNLOCK_THRESHOLD = 0.87;

export type DistrictProgress = {
  districtId: string;
  revealedCount: number;
  totalAccessible: number;
  progress: number;
  canAutoUnlock: boolean;
};

/** Returns exploration progress for a user in a district (0..1). */
export async function getDistrictProgress(
  userId: string,
  districtId: string,
): Promise<DistrictProgress> {
  const district = await prisma.district.findUniqueOrThrow({
    where: { id: districtId },
    select: { total_accessible_hexes: true },
  });

  const revealedCount = await prisma.userHexReveal.count({
    where: {
      user_id: userId,
      hex: { district_id: districtId, is_accessible: true },
    },
  });

  const total = district.total_accessible_hexes || 1;
  const progress = revealedCount / total;
  const canAutoUnlock = progress >= AUTO_UNLOCK_THRESHOLD;

  await prisma.userDistrictProgress.upsert({
    where: { user_id_district_id: { user_id: userId, district_id: districtId } },
    create: { user_id: userId, district_id: districtId, can_auto_unlock: canAutoUnlock },
    update: { can_auto_unlock: canAutoUnlock },
  });

  return {
    districtId,
    revealedCount,
    totalAccessible: total,
    progress,
    canAutoUnlock,
  };
}

/** Opens all remaining inaccessible hexes in a district when progress >= 85-90%. */
export async function autoUnlockDistrict(userId: string, districtId: string): Promise<number> {
  const { canAutoUnlock } = await getDistrictProgress(userId, districtId);
  if (!canAutoUnlock) {
    throw new Error("District progress below auto-unlock threshold");
  }

  const inaccessible = await prisma.h3Hex.findMany({
    where: { district_id: districtId, is_accessible: false },
    select: { h3_index: true },
  });

  if (inaccessible.length === 0) return 0;

  await prisma.$transaction([
    prisma.h3Hex.updateMany({
      where: { district_id: districtId, is_accessible: false },
      data: { is_accessible: true },
    }),
    ...inaccessible.map((hex) =>
      prisma.userHexReveal.upsert({
        where: { user_id_h3_index: { user_id: userId, h3_index: hex.h3_index } },
        create: { user_id: userId, h3_index: hex.h3_index },
        update: {},
      }),
    ),
  ]);

  return inaccessible.length;
}
