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

export type GoiaspenCallTarget = {
  /** Origem https do GoiásPen, com ou sem barra final. */
  origin: string;
  token: string;
};

export type BuscaFacialFotoKind = 'front' | 'right_profile' | 'left_profile';

export type BuscaFacialFoto = {
  uri: string;
  kind?: BuscaFacialFotoKind;
};

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
  fotos?: string[];
  fotosDetalhe?: BuscaFacialFoto[];
  prontuario?: string;
  distance?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asAbsoluteUrl(value: string, origin: string = urlsServices.GOIASPEN): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file:')
  ) {
    return trimmed;
  }
  if (trimmed.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && !trimmed.includes('://')) {
    const compact = trimmed.replace(/\s/g, '');
    const mime = compact.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${compact}`;
  }
  if (trimmed.startsWith('/')) {
    return `${origin.replace(/\/$/, '')}${trimmed}`;
  }
  return undefined;
}

function urlFromUnknown(
  value: unknown,
  depth = 0,
  origin: string = urlsServices.GOIASPEN
): string | undefined {
  if (value == null || depth > 4) return undefined;
  if (typeof value === 'string') return asAbsoluteUrl(value, origin);
  if (Array.isArray(value)) {
    const ranked = [...value].sort((a, b) => {
      const ra = asRecord(a);
      const rb = asRecord(b);
      const score = (rec: Record<string, unknown> | null) => {
        if (!rec) return 0;
        if (rec.principal === true || rec.principal === 'true') return 3;
        const pose = String(rec.tipoPose ?? rec.pose ?? '').toUpperCase();
        if (pose === 'FRENTE') return 2;
        return 1;
      };
      return score(rb) - score(ra);
    });
    for (const item of ranked) {
      const found = urlFromUnknown(item, depth + 1, origin);
      if (found) return found;
    }
    return undefined;
  }
  const rec = asRecord(value);
  if (!rec) return undefined;
  for (const key of [
    'linkUrl',
    'urlFoto',
    'fotoUrl',
    'photoUrl',
    'url',
    'foto',
    'imagem',
    'imagemUrl',
    'base64',
    'conteudoBase64',
    'arquivo',
    'file',
    'anexo',
  ]) {
    if (!(key in rec)) continue;
    const found = urlFromUnknown(rec[key], depth + 1, origin);
    if (found) return found;
  }
  return undefined;
}

function pickFotoUrl(
  person: Record<string, unknown> | null,
  root: Record<string, unknown> | null,
  origin: string = urlsServices.GOIASPEN
): string | undefined {
  for (const src of [person, root]) {
    if (!src) continue;
    const direct = pickString(src, [
      'fotoUrl',
      'urlFoto',
      'photoUrl',
      'linkUrl',
      'imagemUrl',
      'urlImagem',
    ]);
    if (direct) {
      const abs = asAbsoluteUrl(direct, origin);
      if (abs) return abs;
    }
    const nested = urlFromUnknown(
      src.foto ?? src.fotos ?? src.imagem ?? src.imagens ?? src.arquivoFoto ?? src.fotoPrincipal,
      0,
      origin
    );
    if (nested) return nested;
  }
  return undefined;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function poseToKind(pose?: string): BuscaFacialFotoKind | undefined {
  if (!pose) return undefined;
  const p = pose
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (p.includes('FRENTE') || p === 'FRONT' || p === 'FACE') return 'front';
  if (p.includes('DIREIT') || p.includes('RIGHT') || p === 'PD') return 'right_profile';
  if (p.includes('ESQUER') || p.includes('LEFT') || p === 'PE') return 'left_profile';
  return undefined;
}

function kindFromUnknown(value: unknown): BuscaFacialFotoKind | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  return poseToKind(pickString(rec, ['tipoPose', 'pose', 'tipo', 'tipoFoto', 'lado']));
}

function collectFotos(
  person: Record<string, unknown> | null,
  root: Record<string, unknown> | null,
  origin: string = urlsServices.GOIASPEN
): BuscaFacialFoto[] {
  const seen = new Set<string>();
  const items: BuscaFacialFoto[] = [];
  const push = (url?: string, kind?: BuscaFacialFotoKind) => {
    if (!url) return;
    const existing = items.find((item) => item.uri === url);
    if (existing) {
      if (!existing.kind && kind) existing.kind = kind;
      return;
    }
    if (seen.has(url)) return;
    seen.add(url);
    items.push({ uri: url, kind });
  };

  const fromValue = (value: unknown) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        push(urlFromUnknown(item, 0, origin), kindFromUnknown(item));
      }
      return;
    }
    push(urlFromUnknown(value, 0, origin), kindFromUnknown(value));
  };

  for (const src of [person, root]) {
    if (!src) continue;
    fromValue(src.fotos ?? src.imagens);
    fromValue(src.foto);
    fromValue(src.fotoPrincipal);
    fromValue(src.arquivoFoto);
    push(
      asAbsoluteUrl(
        pickString(src, ['fotoUrl', 'urlFoto', 'photoUrl', 'linkUrl', 'imagemUrl', 'urlImagem']) ?? '',
        origin
      )
    );
  }
  push(pickFotoUrl(person, root, origin));
  return items.slice(0, 4);
}

async function hydrateMatchPhotos(match: BuscaFacialMatch, token?: string): Promise<BuscaFacialMatch> {
  const detalhe: BuscaFacialFoto[] = match.fotosDetalhe?.length
    ? [...match.fotosDetalhe]
    : (match.fotos ?? []).map((uri) => ({ uri }));
  if (detalhe.length === 0 && match.fotoUrl) {
    detalhe.push({ uri: match.fotoUrl });
  }
  if (detalhe.length === 0) return match;
  const fotosDetalhe = await Promise.all(
    detalhe.map(async (item) => ({ ...item, uri: await hydrateFotoUrl(item.uri, token) }))
  );
  const fotos = fotosDetalhe.map((item) => item.uri);
  const front = fotosDetalhe.find((item) => item.kind === 'front')?.uri ?? fotos[0];
  return { ...match, fotosDetalhe, fotos, fotoUrl: front };
}

async function hydrateFotoUrl(url: string, token?: string): Promise<string> {
  if (url.startsWith('data:') || url.startsWith('file:')) return url;
  try {
    const headers = token
      ? { Accept: 'image/*', Authorization: `Bearer ${token}`, token }
      : await getAuthHeaders({ Accept: 'image/*' });
    const response = await fetch(url, { headers });
    if (!response.ok) return url;
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
    if (contentType && !contentType.startsWith('image/')) return url;
    const base64 = arrayBufferToBase64(await response.arrayBuffer());
    return `data:${contentType || 'image/jpeg'};base64,${base64}`;
  } catch (error) {
    console.warn('[GOIASPEN] falha ao baixar foto do match', error);
    return url;
  }
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

function parseBuscaFacialMatch(data: unknown, origin: string = urlsServices.GOIASPEN): BuscaFacialMatch | null {
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

  const fotosDetalhe = collectFotos(person, root, origin);
  const fotoUrl =
    fotosDetalhe.find((item) => item.kind === 'front')?.uri ??
    fotosDetalhe[0]?.uri ??
    pickFotoUrl(person, root);

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
    prontuario:
      pickString(person, ['prontuario', 'numeroProntuario', 'nrProntuario', 'numProntuario']) ??
      (pickNumber(person, ['prontuario', 'numeroProntuario', 'nrProntuario']) != null
        ? String(pickNumber(person, ['prontuario', 'numeroProntuario', 'nrProntuario']))
        : undefined),
    fotoUrl,
    fotos: fotosDetalhe.map((item) => item.uri),
    fotosDetalhe,
    distance: pickNumber(root, ['distancia', 'distance', 'score', 'similaridade'])
      ?? pickNumber(person, ['distancia', 'distance', 'score', 'similaridade']),
  };
}

function parseBuscaFacialMatchList(data: unknown, origin: string = urlsServices.GOIASPEN): BuscaFacialMatch[] {
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
    const match = parseBuscaFacialMatch(item, origin);
    if (match) parsed.push(match);
  });
  return parsed;
}

async function postBuscaFacial(
  path: string,
  embedding: number[],
  label: string,
  target?: GoiaspenCallTarget
): Promise<unknown> {
  const origin = (target?.origin ?? urlsServices.GOIASPEN).replace(/\/$/, '');
  const url = `${origin}/api/goiaspenApp${path}`;
  const headers = target
    ? {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.token}`,
        token: target.token,
      }
    : await getAuthHeaders({
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
    if (!target) rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }

  return data;
}

/**
 * Melhor match facial no GoiasPen.
 * 200 + corpo null = nenhum match dentro do threshold.
 */
export async function buscaFacialMelhorMatch(
  embedding: number[],
  target?: GoiaspenCallTarget
): Promise<BuscaFacialMatch | null> {
  const data = await postBuscaFacial('/reeducandos/busca-facial', embedding, 'busca-facial', target);
  const match = parseBuscaFacialMatch(data, target?.origin);
  if (!match) return null;
  return hydrateMatchPhotos(match, target?.token);
}

/** Até 20 matches, do mais próximo ao mais distante. */
export async function buscaFacialMatches(
  embedding: number[],
  target?: GoiaspenCallTarget
): Promise<BuscaFacialMatch[]> {
  const data = await postBuscaFacial(
    '/reeducandos/busca-facial/matches',
    embedding,
    'busca-facial/matches',
    target
  );
  const parsed = parseBuscaFacialMatchList(data, target?.origin);
  console.log(
    '[GOIASPEN] busca-facial/matches fotos',
    parsed.map((item) => ({
      id: item.id,
      nome: item.nome,
      qtdFotos: item.fotos?.length ?? (item.fotoUrl ? 1 : 0),
      foto: item.fotoUrl
        ? item.fotoUrl.startsWith('data:')
          ? `data-uri(${item.fotoUrl.length})`
          : item.fotoUrl.slice(0, 160)
        : null,
    }))
  );
  return Promise.all(parsed.map((item) => hydrateMatchPhotos(item, target?.token)));
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

export type PesquisarReeducandoBody = {
  prontuario?: number;
  nome?: string;
  mae?: string;
  cpf?: string;
};

/** Pesquisa reeducando por prontuário, nome, mãe e/ou CPF. */
export async function pesquisarReeducandos(filtro: PesquisarReeducandoBody): Promise<BuscaFacialMatch[]> {
  const url = `${GOIASPEN_APP_BASE}/reeducandos/pesquisar`;
  const headers = await getAuthHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  console.log('[GOIASPEN] pesquisarReeducandos request', {
    method: 'POST',
    url,
    body: filtro,
  });
  console.log('[GOIASPEN] pesquisarReeducandos body JSON', JSON.stringify(filtro));

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(filtro),
  });
  const data = await parseResponseBody(response);

  console.log('[GOIASPEN] pesquisarReeducandos response', {
    status: response.status,
    ok: response.ok,
    body: data,
  });

  if (!response.ok) {
    logHttpError('pesquisarReeducandos erro', {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      response: data,
    });
    rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }

  return Promise.all(parseBuscaFacialMatchList(data).map((item) => hydrateMatchPhotos(item)));
}

/** Atualiza só o vetor facial de um reeducando já existente. */
export async function atualizaBiometriaFacial(id: string, embedding: number[]): Promise<void> {
  const url = `${GOIASPEN_APP_BASE}/atualiza-biometria-facial`;
  const headers = await getAuthHeaders({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const payload = { idReeducando: id, embedding };

  console.log('[GOIASPEN] atualizaBiometriaFacial request', {
    method: 'POST',
    url,
    headers: {
      Accept: headers.Accept,
      'Content-Type': headers['Content-Type'],
      Authorization: headers.Authorization ? 'Bearer ***' : undefined,
    },
    idReeducando: id,
    embeddingSize: embedding.length,
    body: payload,
  });
  console.log('[GOIASPEN] atualizaBiometriaFacial body JSON', JSON.stringify(payload));

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponseBody(response);

  console.log('[GOIASPEN] atualizaBiometriaFacial response', {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
    body: data,
  });

  if (!response.ok) {
    logHttpError('atualizaBiometriaFacial erro', {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      response: data,
    });
    rejectIfUnauthorized(response.status, data);
    throw new Error(errorMessage(response.status, data));
  }
}
