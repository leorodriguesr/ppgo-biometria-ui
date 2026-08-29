import { getAuthHeaders } from '@/src/auth/AuthApi';
import { rejectIfUnauthorized } from '@/src/auth/unauthorizedSession';

// Python: geração de embedding 512 (face → vetor)
export const API_URL = 'http://192.168.1.4:8000';     // device físico / mesma Wi-Fi
// export const API_URL = 'http://localhost:8000';      // iOS Simulator
// export const API_URL = 'http://10.0.2.2:8000';       // Android Emulator

// Java: recebe embedding, compara no banco, retorna resultado
export const JAVA_API_URL = 'http://192.168.1.4:8080';
// export const JAVA_API_URL = 'http://localhost:8080';   // iOS Simulator
// export const JAVA_API_URL = 'http://10.0.2.2:8080';   // Android Emulator

/** Resposta de sucesso do endpoint /generate-embedding (API retorna também modelVersion, embeddingSize) */
export interface GenerateEmbeddingSuccess {
    embedding: number[];
}

/** Formato de erro da API: usa "code" (não "error") */
export interface GenerateEmbeddingErrorBody {
    code: string;
    message?: string;
    detail?: string;
}

function isErrorBody(r: unknown): r is GenerateEmbeddingErrorBody {
    return typeof r === 'object' && r !== null && 'code' in r && typeof (r as GenerateEmbeddingErrorBody).code === 'string';
}

export interface IdentifyResponse {
    match: boolean;
    preso_id?: string;
    distance?: number;
}

export interface ExtractedPrisonerDocumentData {
    name?: string;
    motherName?: string;
    dob?: string;
}

/**
 * Valida iluminação da imagem (sem exigir rosto). Legado — preferir validateDetaineePhotoApi.
 */
export const validatePhotoQuality = async (
    photoUri: string
): Promise<{ ok: true; brightness: number }> => {
    const formData = new FormData();
    formData.append('file', {
        uri: photoUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
    } as unknown as Blob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(`${API_URL}/validate-photo-quality`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        const errorPayload =
            data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)
                ? data.detail
                : data;

        if (!response.ok) {
            rejectIfUnauthorized(response.status, errorPayload);
            if (isErrorBody(errorPayload)) {
                throw new Error(errorPayload.code);
            }
            throw new Error(`Falha ao validar qualidade: ${response.status}`);
        }

        return { ok: true, brightness: Number(data.brightness) || 0 };
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Tempo limite excedido. Verifique a conexão e tente novamente.');
        }
        throw error;
    }
};

export type DetaineePhotoPose = 'front' | 'left_profile' | 'right_profile';

export type ValidateDetaineePhotoApiResult = {
    valid: boolean;
    errors: string[];
    metrics: {
        face_count: number;
        yaw?: number | null;
        brightness: number;
        blur: number;
        face_width_ratio?: number | null;
        face_confidence?: number | null;
        pose: string;
    };
};

/**
 * Valida foto de identificação (frente/perfil): luz, nitidez, 1 rosto, tamanho e pose (yaw).
 * Não gera embedding.
 */
export const validateDetaineePhotoApi = async (
    photoUri: string,
    pose: DetaineePhotoPose
): Promise<ValidateDetaineePhotoApiResult> => {
    const formData = new FormData();
    formData.append('file', {
        uri: photoUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
    } as unknown as Blob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const url = `${API_URL}/validate-detainee-photo?pose=${encodeURIComponent(pose)}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        const errorPayload =
            data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)
                ? data.detail
                : data;

        if (!response.ok) {
            rejectIfUnauthorized(response.status, errorPayload);
            if (isErrorBody(errorPayload)) {
                throw new Error(errorPayload.code);
            }
            throw new Error(`Falha ao validar foto: ${response.status}`);
        }

        return {
            valid: Boolean(data?.valid),
            errors: Array.isArray(data?.errors) ? data.errors.map(String) : [],
            metrics: {
                face_count: Number(data?.metrics?.face_count) || 0,
                yaw: data?.metrics?.yaw ?? null,
                brightness: Number(data?.metrics?.brightness) || 0,
                blur: Number(data?.metrics?.blur) || 0,
                face_width_ratio: data?.metrics?.face_width_ratio ?? null,
                face_confidence: data?.metrics?.face_confidence ?? null,
                pose: String(data?.metrics?.pose ?? pose),
            },
        };
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Tempo limite excedido. Verifique a conexão e tente novamente.');
        }
        throw error;
    }
};

/**
 * Envia a imagem da face para a API e retorna o embedding facial.
 * Em caso de erro (ex.: NO_FACE_DETECTED, ENCODING_FAILED), lança com message adequada.
 */
export const generateEmbedding = async (photoUri: string): Promise<number[]> => {
    const formData = new FormData();
    formData.append('file', {
        uri: photoUri,
        name: 'face.jpg',
        type: 'image/jpeg',
    } as unknown as Blob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s para processamento

    try {
        const response = await fetch(`${API_URL}/generate-embedding`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const raw = await response.text();
        let data: Record<string, unknown> = {};
        try {
            data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
            rejectIfUnauthorized(response.status, raw);
            throw new Error(
                response.ok
                    ? 'Resposta inválida da API: embedding não encontrado.'
                    : `Falha ao gerar embedding: ${response.status}`
            );
        }
        // FastAPI coloca o payload de erro dentro de "detail": { code, message, detail }
        const errorPayload =
            data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)
                ? data.detail
                : data;

        if (!response.ok) {
            rejectIfUnauthorized(response.status, errorPayload);
            if (isErrorBody(errorPayload)) {
                const code = errorPayload.code;
                if (
                    code === 'NO_FACE_DETECTED' ||
                    code === 'MULTIPLE_FACES' ||
                    code === 'LOW_FACE_CONFIDENCE' ||
                    code === 'FACE_TOO_SMALL' ||
                    code === 'TOO_DARK' ||
                    code === 'TOO_BRIGHT' ||
                    code === 'TOO_BLURRY' ||
                    code === 'WRONG_POSE' ||
                    code === 'ENCODING_FAILED' ||
                    code === 'INVALID_IMAGE' ||
                    code === 'INVALID_FILE'
                ) {
                    throw new Error(code);
                }
                const msg = typeof errorPayload.detail === 'string' ? errorPayload.detail : errorPayload.message || code;
                throw new Error(msg);
            }
            const fallback =
                typeof data?.detail === 'string'
                    ? data.detail
                    : (isErrorBody(errorPayload) && typeof errorPayload.detail === 'string'
                          ? errorPayload.detail
                          : null) ||
                      (errorPayload && typeof (errorPayload as { message?: string }).message === 'string'
                          ? (errorPayload as { message: string }).message
                          : null);
            throw new Error(fallback || `Falha ao gerar embedding: ${response.status}`);
        }

        if (isErrorBody(errorPayload)) {
            const msg = typeof errorPayload.detail === 'string' ? errorPayload.detail : errorPayload.message || errorPayload.code;
            throw new Error(msg);
        }

        if (Array.isArray(data?.embedding) && data.embedding.length === 512) {
            return data.embedding as number[];
        }
        throw new Error('Resposta inválida da API: embedding não encontrado.');
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Tempo limite excedido. Verifique a conexão e tente novamente.');
        }
        throw error;
    }
};

export const FACE_CAPTURE_ERROR_MESSAGES: Record<string, string> = {
    NO_FACE_DETECTED: 'Nenhum rosto detectado. Enquadre o rosto na oval e tente de novo.',
    MULTIPLE_FACES: 'Mais de um rosto no quadro. Deixe apenas o detento visível.',
    LOW_FACE_CONFIDENCE: 'Rosto pouco nítido. Melhore a luz e mantenha-se firme.',
    FACE_TOO_SMALL: 'Aproxime o rosto da câmera, mantendo-o dentro da oval.',
    TOO_DARK: 'Imagem muito escura. Melhore a iluminação.',
    TOO_BRIGHT: 'Imagem muito clara. Evite reflexo e luz forte.',
    TOO_BLURRY: 'Foto tremida. Segure o aparelho firme.',
    WRONG_POSE: 'Olhe de frente para a câmera.',
    INVALID_IMAGE: 'Imagem inválida. Repita a captura.',
    INVALID_FILE: 'Arquivo inválido ou grande demais. Use a câmera do app e tente de novo.',
};

/**
 * Envia o embedding (512 dimensões) para o backend Java.
 * Java compara no banco e retorna match, preso_id e distance.
 * Fluxo: React → Java (embedding) → Banco (compara) → Java → React (resultado).
 */
export const identifyByEmbedding = async (embedding: number[]): Promise<IdentifyResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        const response = await fetch(`${JAVA_API_URL}/identify`, {
            method: 'POST',
            headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ embedding }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Java API Error:', response.status, errorText);
            rejectIfUnauthorized(response.status, errorText);
            throw new Error(`Falha ao identificar no servidor Java: ${response.status} ${errorText}`);
        }

        return await response.json();
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Tempo limite de conexão excedido (15s). Verifique se o servidor Java está rodando.');
        }
        throw error;
    }
};

/**
 * Envia foto do documento para OCR/extração de campos.
 * Espera encontrar nome, data de nascimento e nome da mãe.
 */
export const extractPrisonerDataFromDocument = async (
    photoUri: string
): Promise<ExtractedPrisonerDocumentData> => {
    const formData = new FormData();
    formData.append('file', {
        uri: photoUri,
        name: 'document.jpg',
        type: 'image/jpeg',
    } as unknown as Blob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${API_URL}/extract-document-data`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            rejectIfUnauthorized(response.status, errorText);
            throw new Error(
                errorText || `Falha ao extrair dados do documento: ${response.status}`
            );
        }

        const data = (await response.json()) as ExtractedPrisonerDocumentData;
        return {
            name: data.name?.trim(),
            motherName: data.motherName?.trim(),
            dob: data.dob?.trim(),
        };
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Tempo limite excedido ao escanear documento.');
        }
        throw error;
    }
};
