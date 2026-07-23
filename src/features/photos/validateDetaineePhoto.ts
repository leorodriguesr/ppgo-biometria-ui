import { generateEmbedding, validatePhotoQuality } from '@/src/services/api';
import type { BustPhotoKind } from '@/src/features/photos/types';

export type DetaineePhotoValidationResult =
  | { ok: true; faceConfidenceHint?: string }
  | { ok: false; message: string };

const VALIDATION_MESSAGES: Record<string, string> = {
  NO_FACE_DETECTED:
    'Nenhuma pessoa/rosto detectado. Enquadre a cabeça e o tórax, com boa iluminação, e tire outra foto.',
  MULTIPLE_FACES:
    'Foi detectada mais de uma pessoa. Deixe apenas o detento no quadro e tente novamente.',
  LOW_FACE_CONFIDENCE:
    'Qualidade insuficiente (rosto pouco nítido ou mal iluminado). Melhore a luz e a nitidez e tire outra foto.',
  FACE_TOO_SMALL:
    'A pessoa está muito longe ou pequena no quadro. Aproxime-se mantendo cabeça e tórax no enquadramento.',
  ENCODING_FAILED:
    'Não foi possível processar a imagem. Tente novamente com melhor iluminação e foco.',
  INVALID_IMAGE: 'Imagem inválida ou corrompida. Tire outra foto.',
  INVALID_FILE: 'Formato de arquivo inválido. Use a câmera do app para capturar.',
  TOO_DARK: 'Foto muito escura. Melhore a iluminação e tire outra foto.',
  TOO_BRIGHT: 'Foto muito clara ou estourada. Reduza a luz/reflexo e tire outra foto.',
};

function mapValidationError(error: unknown): DetaineePhotoValidationResult {
  const code = error instanceof Error ? error.message : '';
  if (code in VALIDATION_MESSAGES) {
    return { ok: false, message: VALIDATION_MESSAGES[code] };
  }
  if (error instanceof Error && error.message.trim()) {
    const lower = error.message.toLowerCase();
    if (lower.includes('escura') || lower.includes('dark') || lower.includes('too_dark')) {
      return { ok: false, message: VALIDATION_MESSAGES.TOO_DARK };
    }
    if (lower.includes('clara') || lower.includes('bright') || lower.includes('too_bright')) {
      return { ok: false, message: VALIDATION_MESSAGES.TOO_BRIGHT };
    }
    if (lower.includes('confiança') || lower.includes('confidence')) {
      return { ok: false, message: VALIDATION_MESSAGES.LOW_FACE_CONFIDENCE };
    }
    if (lower.includes('pequeno') || lower.includes('small')) {
      return { ok: false, message: VALIDATION_MESSAGES.FACE_TOO_SMALL };
    }
    if (lower.includes('rosto') || lower.includes('face') || lower.includes('pessoa')) {
      return { ok: false, message: VALIDATION_MESSAGES.NO_FACE_DETECTED };
    }
    if (lower.includes('tempo limite') || lower.includes('network') || lower.includes('failed')) {
      return {
        ok: false,
        message:
          'Não foi possível validar a foto (servidor de biometria). Verifique a conexão e tente de novo.',
      };
    }
    return { ok: false, message: error.message };
  }
  return { ok: false, message: 'Falha ao validar a foto. Tente novamente.' };
}

/**
 * Frente: valida rosto + iluminação (via generate-embedding).
 * Perfis: só iluminação (rostos de perfil costumam falhar na detecção).
 */
export async function validateDetaineePhoto(
  photoUri: string,
  kind: BustPhotoKind
): Promise<DetaineePhotoValidationResult> {
  const isProfile = kind === 'right_profile' || kind === 'left_profile';

  try {
    if (isProfile) {
      await validatePhotoQuality(photoUri);
      return { ok: true };
    }

    const embedding = await generateEmbedding(photoUri);
    if (!Array.isArray(embedding) || embedding.length < 128) {
      return {
        ok: false,
        message: 'A foto não passou na validação de qualidade. Tire outra.',
      };
    }
    return { ok: true };
  } catch (error) {
    return mapValidationError(error);
  }
}
