import { getAuthHeaders } from '@/src/auth/AuthApi';
import { getTokenSso } from '@/src/auth/tokenStorage';
import { notifyUnauthorized, rejectIfUnauthorized, UnauthorizedError } from '@/src/auth/unauthorizedSession';
import { urlsServices } from '@/src/configs/urlsConfig';

/** Base JAX-RS: /api/goiaspenApp (ex.: https://goiaspen-homo.ssp.go.gov.br/api/goiaspenApp) */
export const GOIASPEN_APP_BASE = `${urlsServices.GOIASPEN}api/goiaspenApp`;

/** Valores de `entidade.enunus.TipoPose` no GoiasPen. */
export type TipoPose = 'FRENTE' | 'PERFIL' | 'MEIO_PERFIL' | 'TRES_QUARTOS' | 'INDEFINIDO';

export type FileDTO = {
  id: string;
  dataUpload?: string;
  nomeOriginal?: string;
  tipoPermissao?: string;
  mimeType?: string;
  tamanho?: string;
  namespace?: string;
  identificadorStream?: string;
  s3?: boolean;
  linkUrl?: string;
  s3BucketName?: string;
};

export type ParteCorpoDTO = {
  id: number;
  descricao: string;
  regiao?: string;
  face?: string;
};

export type TipoSinalDTO = {
  id: number;
  descricao: string;
  definicao?: string;
};

export type PreCadastroFoto = {
  idFile: string;
  nomeOriginal: string;
  mimeType: string;
  tipoPose: TipoPose;
  principal: boolean;
};

export type PreCadastroSinalLesao = {
  sinal: string;
  parteDoCorpo: string;
  observacao: string;
  anexoFilewsId: string;
  anexoNomeOri: string;
  anexoTipo: string;
};

export type PreCadastroPayload = {
  nome: string;
  nomeSocial?: string;
  dataNascimento?: string;
  sexo?: string;
  mae?: string;
  pai?: string;
  rg?: string;
  orgaoEmissor?: string;
  cpf?: string;
  escolaridade?: string;
  profissao?: string;
  estadoCivil?: string;
  naturalidade?: string;
  endereco?: string;
  telefone?: string;
  vetorFacial?: number[];
  fotos?: PreCadastroFoto[];
  sinaisLesoes?: PreCadastroSinalLesao[];
};

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function logHttpError(label: string, info: {
  url: string;
  status: number;
  contentType?: string | null;
  response: unknown;
}) {
  console.error(`[GOIASPEN] ${label}`, {
    status: info.status,
    url: info.url,
    contentType: info.contentType ?? null,
    response: info.response,
  });
}

function errorMessage(status: number, data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const err = data as {
      detail?: unknown;
      message?: unknown;
      title?: unknown;
      erro?: unknown;
    };
    if (typeof err.erro === 'string' && err.erro.trim()) return err.erro;
    if (typeof err.detail === 'string' && err.detail.trim()) return err.detail;
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    if (typeof err.title === 'string' && err.title.trim()) return err.title;
  }
  if (typeof data === 'string' && data.trim()) {
    // Proxy HTML (404 Apache etc.) — não dumpa o XML inteiro na UI
    if (data.includes('<html') || data.includes('<!DOCTYPE')) {
      return status === 404
        ? 'Endpoint não encontrado (404). Verifique a URL base da API.'
        : `Erro HTTP ${status} (resposta HTML do servidor).`;
    }
    return data.length > 180 ? `${data.slice(0, 180)}…` : data;
  }
  if (status === 401) return 'Sessão expirada. Faça login novamente.';
  if (status === 400) return 'Dados inválidos. Verifique o formulário e tente de novo.';
  return `Erro HTTP ${status}`;
}

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${GOIASPEN_APP_BASE}${path}`;
  const headers = await getAuthHeaders({
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  });

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await parseResponseBody(response);
  if (!response.ok) {
    rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }
  return data as T;
}

/**
 * Anexa arquivo no FileWS.
 * Campo multipart obrigatório: arquivo
 */
export async function anexarArquivo(localUri: string, fileName?: string): Promise<FileDTO> {
  const url = `${GOIASPEN_APP_BASE}/arquivos/anexar`;
  const rawName = fileName || localUri.split('/').pop() || `foto-${Date.now()}.jpg`;
  const name = /\.(jpe?g|png|webp)$/i.test(rawName) ? rawName : `${rawName}.jpg`;
  const uri = localUri.startsWith('file://') ? localUri : `file://${localUri}`;

  const formData = new FormData();
  formData.append('arquivo', {
    uri,
    name,
    type: 'image/jpeg',
  } as unknown as Blob);

  // Multipart: só Bearer + Accept. Não setar Content-Type (boundary do RN)
  // nem o header extra `token` (pode atrapalhar proxy em upload).
  const token = await getTokenSso();
  if (!token) {
    notifyUnauthorized();
    throw new UnauthorizedError();
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await parseResponseBody(response);
  if (!response.ok) {
    logHttpError('anexarArquivo erro', {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      response: data,
    });
    rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }
  if (!data || typeof data !== 'object' || !('id' in data)) {
    throw new Error('Upload ok, mas o FileWS não retornou o id do arquivo.');
  }
  return data as FileDTO;
}

export async function listarPartesCorpo(): Promise<ParteCorpoDTO[]> {
  const data = await requestJson<ParteCorpoDTO[]>('GET', '/sinais-lesoes/partes-corpo');
  return Array.isArray(data) ? data : [];
}

export async function listarTiposSinal(): Promise<TipoSinalDTO[]> {
  const data = await requestJson<TipoSinalDTO[]>('GET', '/sinais-lesoes/tipos-sinal');
  return Array.isArray(data) ? data : [];
}

export type BuscaFacialMatch = {
  id: string;
  nome: string;
  nomeSocial?: string;
  mae?: string;
  pai?: string;
  dataNascimento?: string;
  cpf?: string;
  sexo?: string;
  rg?: string;
  orgaoEmissor?: string;
  escolaridade?: string;
  profissao?: string;
  estadoCivil?: string;
  naturalidade?: string;
  nacionalidade?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  fotoUrl?: string;
  distance?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function formatApiDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return value;
}

function parseBuscaFacialMatch(data: unknown): BuscaFacialMatch | null {
  if (data == null || data === '') return null;
  const root = asRecord(data);
  if (!root) return null;
  if (root.match === false) return null;

  const person =
    asRecord(root.reeducando) ??
    asRecord(root.preso) ??
    asRecord(root.pessoa) ??
    asRecord(root.detento) ??
    asRecord(root.resultado) ??
    root;

  const id = pickString(person, ['id', 'idReeducando', 'reeducandoId', 'presoId', 'codigo']);
  const nome = pickString(person, ['nome', 'nomeCompleto', 'name']);
  if (!id && !nome) return null;

  return {
    id: id ?? nome ?? 'match',
    nome: nome ?? 'Sem nome',
    nomeSocial: pickString(person, ['nomeSocial', 'socialName']),
    mae: pickString(person, ['mae', 'nomeMae', 'motherName']),
    pai: pickString(person, ['pai', 'nomePai', 'filiation']),
    dataNascimento: formatApiDate(pickString(person, ['dataNascimento', 'dtNascimento', 'dob'])),
    cpf: pickString(person, ['cpf']),
    sexo: pickString(person, ['sexo']),
    rg: pickString(person, ['rg']),
    orgaoEmissor: pickString(person, ['orgaoEmissor']),
    escolaridade: pickString(person, ['escolaridade']),
    profissao: pickString(person, ['profissao']),
    estadoCivil: pickString(person, ['estadoCivil']),
    naturalidade: pickString(person, ['naturalidade', 'birthPlace']),
    nacionalidade: pickString(person, ['nacionalidade']),
    endereco: pickString(person, ['endereco']),
    telefone: pickString(person, ['telefone']),
    email: pickString(person, ['email']),
    fotoUrl: pickString(person, ['fotoUrl', 'urlFoto', 'foto', 'linkUrl', 'photoUrl']),
    distance: pickNumber(root, ['distancia', 'distance', 'score', 'similaridade'])
      ?? pickNumber(person, ['distancia', 'distance', 'score', 'similaridade']),
  };
}

function parseBuscaFacialMatchList(data: unknown): BuscaFacialMatch[] {
  if (data == null || data === '') return [];
  let items: unknown[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else {
    const root = asRecord(data);
    if (!root) return [];
    for (const key of ['content', 'matches', 'resultados', 'results', 'data', 'itens', 'items']) {
      const value = root[key];
      if (Array.isArray(value)) {
        items = value;
        break;
      }
    }
  }

  const parsed: BuscaFacialMatch[] = [];
  items.forEach((item) => {
    const match = parseBuscaFacialMatch(item);
    if (match) parsed.push(match);
  });
  return parsed;
}

async function postBuscaFacial(path: string, embedding: number[], label: string): Promise<unknown> {
  const url = `${GOIASPEN_APP_BASE}${path}`;
  const headers = await getAuthHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const body = { embedding };

  console.log(`[GOIASPEN] ${label} request`, {
    method: 'POST',
    url,
    headers: {
      Accept: headers.Accept,
      'Content-Type': headers['Content-Type'],
      Authorization: headers.Authorization ? 'Bearer ***' : undefined,
    },
    embeddingSize: embedding.length,
    body,
  });
  console.log(`[GOIASPEN] ${label} body JSON`, JSON.stringify(body));

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await parseResponseBody(response);

  console.log(`[GOIASPEN] ${label} response`, {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
    body: data,
  });

  if (!response.ok) {
    logHttpError(`${label} erro`, {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      response: data,
    });
    rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }

  return data;
}

/**
 * Melhor match facial no GoiasPen.
 * 200 + corpo null = nenhum match dentro do threshold.
 */
export async function buscaFacialMelhorMatch(embedding: number[]): Promise<BuscaFacialMatch | null> {
  const data = await postBuscaFacial('/reeducandos/busca-facial', embedding, 'busca-facial');
  return parseBuscaFacialMatch(data);
}

/** Até 20 matches, do mais próximo ao mais distante. */
export async function buscaFacialMatches(embedding: number[]): Promise<BuscaFacialMatch[]> {
  const data = await postBuscaFacial('/reeducandos/busca-facial/matches', embedding, 'busca-facial/matches');
  return parseBuscaFacialMatchList(data);
}

/** Pré-cadastro — espera 201 Created sem corpo. */
export async function criarPreCadastro(payload: PreCadastroPayload): Promise<void> {
  const url = `${GOIASPEN_APP_BASE}/pre-cadastro`;
  const headers = await getAuthHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const body = JSON.stringify(payload);

  console.log('[GOIASPEN] criarPreCadastro request', {
    method: 'POST',
    url,
    headers: {
      Accept: headers.Accept,
      'Content-Type': headers['Content-Type'],
      Authorization: headers.Authorization ? 'Bearer ***' : undefined,
    },
    body: payload,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
  const data = await parseResponseBody(response);

  console.log('[GOIASPEN] criarPreCadastro response', {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
    body: data,
  });

  if (!response.ok && response.status !== 201) {
    logHttpError('criarPreCadastro erro', {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      response: data,
    });
    rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }
}
