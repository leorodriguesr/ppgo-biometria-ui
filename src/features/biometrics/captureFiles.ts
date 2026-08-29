import { File } from 'expo-file-system';

export function toFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

export function deleteLocalFile(path: string | null | undefined): void {
  if (!path) return;
  try {
    const file = new File(toFileUri(path));
    if (file.exists) file.delete();
  } catch {
    // ignore missing/locked files
  }
}

export function deleteLocalFiles(paths: (string | null | undefined)[]): void {
  for (const path of paths) {
    deleteLocalFile(path);
  }
}
