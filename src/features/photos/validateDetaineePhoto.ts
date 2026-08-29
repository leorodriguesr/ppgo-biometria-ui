import { isUnauthorizedError } from '@/src/auth/unauthorizedSession';
import { validateDetaineePhotoApi } from '@/src/services/api';
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
  TOO_DARK: 'Foto muito escura. Melhore a iluminação e tire outra foto.',
  TOO_BRIGHT: 'Foto muito clara ou estourada. Reduza a luz/reflexo e tire outra foto.',
  TOO_BLURRY: 'Foto borrada ou fora de foco. Segure firme e tire outra foto.',
  INVALID_POSE: 'Pose de validação inválida. Reabra a captura e tente novamente.',
  INVALID_IMAGE: 'Imagem inválida ou corrompida. Tire outra foto.',
  INVALID_FILE: 'Formato de arquivo inválido. Use a câmera do app para capturar.',
};

const WRONG_POSE_MESSAGES: Record<BustPhotoKind, string> = {
  front:
    'Orientação incorreta: olhe de frente para a câmera. A cabeça não deve estar virada para o lado.',
  left_profile:
    'Orientação incorreta para perfil esquerdo: vire o rosto e mostre o lado esquerdo à câmera.',
  right_profile:
    'Orientação incorreta para perfil direito: vire o rosto e mostre o lado direito à câmera.',
};

function messageForCode(code: string, kind: BustPhotoKind): string {
  if (code === 'WRONG_POSE') return WRONG_POSE_MESSAGES[kind];
  return VALIDATION_MESSAGES[code] ?? code;
}

function messageForErrors(errors: string[], kind: BustPhotoKind): string {
  if (errors.length === 0) {
    return 'A foto não passou na validação. Tire outra.';
  }
  const messages = errors.map((code) => messageForCode(code, kind));
  const unique = [...new Set(messages)];
  if (unique.length === 1) return unique[0];
  return unique.map((m) => `• ${m}`).join('\n');
}

function mapValidationError(
  error: unknown,
  kind: BustPhotoKind
): DetaineePhotoValidationResult {
  const code = error instanceof Error ? error.message : '';
  if (code === 'WRONG_POSE') {
    return { ok: false, message: WRONG_POSE_MESSAGES[kind] };
  }
  if (code in VALIDATION_MESSAGES) {
    return { ok: false, message: VALIDATION_MESSAGES[code] };
  }
  if (error instanceof Error && error.message.trim()) {
    const lower = error.message.toLowerCase();
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
 * Fotos de identificação (frente / perfis): valida no Python sem gerar embedding.
 * Biometria continua em /generate-embedding.
 */
export async function validateDetaineePhoto(
  photoUri: string,
  kind: BustPhotoKind
): Promise<DetaineePhotoValidationResult> {
  try {
    const result = await validateDetaineePhotoApi(photoUri, kind);
    if (result.valid) {
      return { ok: true };
    }
    return { ok: false, message: messageForErrors(result.errors, kind) };
  } catch (error) {
    if (isUnauthorizedError(error)) throw error;
    return mapValidationError(error, kind);
  }
}
