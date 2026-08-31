import { prisma } from "./db";

const KING_WINDOW_DAYS = 30;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** One check-in per user per POI per calendar day. */
export async function checkInPOI(
  userId: string,
  poiId: string,
  photoUrl?: string,
): Promise<{ checkinId: string; kingUserId: string | null }> {
  const todayStart = startOfDay(new Date());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const existing = await prisma.pOICheckin.findFirst({
    where: {
      user_id: userId,
      poi_id: poiId,
      checked_at: { gte: todayStart, lt: tomorrowStart },
    },
  });

  if (existing) {
    throw new Error("Already checked in today");
  }

  const checkin = await prisma.pOICheckin.create({
    data: { user_id: userId, poi_id: poiId, photo_url: photoUrl },
  });

  const kingUserId = await recalculateKing(poiId);
  return { checkinId: checkin.id, kingUserId };
}

/** Recalculates king_user_id based on visits in the last 30 days. */
export async function recalculateKing(poiId: string): Promise<string | null> {
  const since = new Date();
  since.setDate(since.getDate() - KING_WINDOW_DAYS);

  const counts = await prisma.pOICheckin.groupBy({
    by: ["user_id"],
    where: { poi_id: poiId, checked_at: { gte: since } },
    _count: { user_id: true },
    orderBy: { _count: { user_id: "desc" } },
    take: 1,
  });

  const kingUserId = counts[0]?.user_id ?? null;

  await prisma.pOI.update({
    where: { id: poiId },
    data: { king_user_id: kingUserId },
  });

  return kingUserId;
}
