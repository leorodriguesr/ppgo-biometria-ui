function envFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

/**
 * Quando ativa, cadastro, consulta e identificação usam somente o SQLite do aparelho.
 * A API Python continua sendo usada para validar fotos e gerar o embedding facial.
 */
export const USE_LOCAL_DATABASE = envFlag(
  process.env.EXPO_PUBLIC_USE_LOCAL_DATABASE
);

/**
 * true: embedding e validação de foto no uvicorn local.
 * false: API Python do ambiente (homo/prod no urlsConfig).
 */
export const USE_LOCAL_BIOMETRIA_API = envFlag(
  process.env.EXPO_PUBLIC_USE_LOCAL_BIOMETRIA_API
);

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Match principal e faixa mais ampla usada para apresentar possíveis duplicidades. */
export const LOCAL_FACE_MATCH_THRESHOLD = positiveNumber(
  process.env.EXPO_PUBLIC_LOCAL_FACE_MATCH_THRESHOLD,
  1.1
);
export const LOCAL_FACE_CANDIDATE_THRESHOLD = positiveNumber(
  process.env.EXPO_PUBLIC_LOCAL_FACE_CANDIDATE_THRESHOLD,
  1.3
);
