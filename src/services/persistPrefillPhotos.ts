import type { BustPhotoKind } from '@/src/features/photos/types';
import { addPrisonerPhoto, getPrisonerPhotos } from '@/src/services/database';
import { persistLocalImage } from '@/src/services/localImageStorage';

export type PrefillBustPhoto = { kind: BustPhotoKind; uri: string };

export async function persistPrefillBustPhotos(
  prisonerId: number,
  photos: PrefillBustPhoto[]
): Promise<void> {
  if (!photos.length) return;
  const existing = await getPrisonerPhotos(prisonerId);
  for (const photo of photos) {
    if (existing.some((row) => row.photo_type === photo.kind)) continue;
    const fileUri = await persistLocalImage(photo.uri, prisonerId, `prefill-${photo.kind}`);
    await addPrisonerPhoto({
      prisonerId,
      photoType: photo.kind,
      photoUri: fileUri,
      qualityOk: true,
    });
  }
}
