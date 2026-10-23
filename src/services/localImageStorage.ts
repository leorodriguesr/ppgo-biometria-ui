import * as FileSystem from 'expo-file-system/legacy';

function extensionFromUri(uri: string): string {
  const clean = uri.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  return 'jpg';
}

function safeLabel(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

/** URI que o Image/expo-image consegue abrir (file://, http, data). */
export function toDisplayImageUri(uri: string | null | undefined): string | null {
  const value = uri?.trim();
  if (!value) return null;
  if (/^(file|https?|data|content|ph|assets-library):/i.test(value)) return value;
  if (value.startsWith('/')) return `file://${value}`;
  return value;
}

async function fileExists(uri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && !info.isDirectory) return info.uri || uri;
  } catch {
    // ignore
  }
  return null;
}

/** Recoloca um file:// antigo no diretório atual do preso, se o arquivo ainda existir. */
export async function resolveLocalPhotoUri(
  storedUri: string | null | undefined,
  prisonerId?: number,
  hint?: string
): Promise<string | null> {
  const raw = storedUri?.trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }

  const normalized = toDisplayImageUri(raw);
  const candidates = [raw, normalized].filter((item): item is string => Boolean(item));
  if (raw.startsWith('file://')) {
    candidates.push(decodeURI(raw.replace(/^file:\/\//, '')));
  }

  for (const candidate of candidates) {
    const found = await fileExists(candidate);
    if (found) return toDisplayImageUri(found) ?? found;
  }

  const root = FileSystem.documentDirectory;
  if (root && prisonerId != null && Number.isFinite(prisonerId)) {
    const directory = `${root}prisoner-images/${prisonerId}/`;
    try {
      const names = await FileSystem.readDirectoryAsync(directory);
      const preferred = hint
        ? names.find((name) => name.toLowerCase().includes(safeLabel(hint)))
        : undefined;
      const pick = preferred ?? names[0];
      if (pick) {
        const found = await fileExists(`${directory}${pick}`);
        if (found) return toDisplayImageUri(found) ?? found;
      }
    } catch {
      // pasta ainda não existe
    }
  }

  return normalized;
}

/** Copia a imagem para a área permanente do app e retorna a URI persistida. */
export async function persistLocalImage(
  sourceUri: string,
  prisonerId: number,
  label: string
): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Armazenamento permanente indisponível.');

  const directory = `${root}prisoner-images/${prisonerId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${safeLabel(label)}.${extensionFromUri(sourceUri)}`;

  if (sourceUri.startsWith('data:')) {
    const comma = sourceUri.indexOf(',');
    await FileSystem.writeAsStringAsync(
      destination,
      comma >= 0 ? sourceUri.slice(comma + 1) : sourceUri,
      { encoding: FileSystem.EncodingType.Base64 }
    );
    return toDisplayImageUri(destination) ?? destination;
  }

  if (sourceUri.startsWith('http://') || sourceUri.startsWith('https://')) {
    const result = await FileSystem.downloadAsync(sourceUri, destination);
    return toDisplayImageUri(result.uri) ?? result.uri;
  }

  const from = sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`;
  if (from !== destination) {
    const existing = await fileExists(destination);
    if (existing) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }
    await FileSystem.copyAsync({ from, to: destination });
  }
  return toDisplayImageUri(destination) ?? destination;
}

export async function clearPersistedLocalImages(): Promise<void> {
  const root = FileSystem.documentDirectory;
  if (!root) return;
  await FileSystem.deleteAsync(`${root}prisoner-images/`, { idempotent: true });
}
