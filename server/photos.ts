import { prisma } from "./db";

export async function savePhoto(
  userId: string,
  h3Index: string,
  photoUrl: string,
): Promise<{ id: string; photo_url: string; h3_index: string }> {
  const photo = await prisma.photo.create({
    data: { user_id: userId, h3_index: h3Index, photo_url: photoUrl },
  });

  await prisma.userHexReveal.upsert({
    where: { user_id_h3_index: { user_id: userId, h3_index: h3Index } },
    create: { user_id: userId, h3_index: h3Index },
    update: {},
  });

  return { id: photo.id, photo_url: photo.photo_url, h3_index: photo.h3_index };
}
