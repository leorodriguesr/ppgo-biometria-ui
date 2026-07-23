import { getAuthHeaders } from '@/src/auth/AuthApi';
import { urlsServices } from '@/src/configs/urlsConfig';

/** Base alinhada ao Swagger GOIASPEN_OLD em dgppws(-h).ssp.go.gov.br */
const CADASTRO_BASE = `${urlsServices.DGPPWS}ppgo-url-apis/goiaspenold/app/cadastro`;

export type CadastroPessoaPayload = {
  nome: string;
  sexo: string;
  mae: string;
  pai: string;
  rg: string;
  cpf: string;
  reservista: string;
  email: string;
  cnh: string;
  nacionalidade: string;
  genero: string;
  gestante: boolean;
  lactante: boolean;
  status: boolean;
  data_nascimento: string;
  orgao_emissor: string;
  estado_civil: string;
  titulo_eleitor: string;
  categoria_cnh: string;
  pais_id: number;
  cidade_id: number;
  data_cadastro: string;
  responsavel_deficiente: boolean;
  nome_social: string;
  usuario_id: number;
};

export type CadastroReeducandoPayload = {
  prontuario: number;
  endereco: string;
  bairro: string;
  conjuge: string;
  email: string;
  telefone: string;
  celular1: string;
  celular2: string;
  contato: string;
  raca: string;
  peso: number;
  altura: number;
  tatuagens: string;
  tribo: string;
  dialeto: string;
  situacao: string;
  alcunha: string;
  artigos: string;
  profissao: string;
  rji: string;
  status: boolean;
  religiao: string;
  pessoa_id: number;
  cidade_endereco_id: number;
  telefone_contato: string;
  cor_da_pele: string;
  cor_dos_olhos: string;
  cor_dos_cabelos: string;
  tipo_dos_cabelos: string;
  autorizado_cobal: number;
  usuario_id: number;
  grau_de_instrucao: string;
  deficiencia_fisica: string;
  alertar_movimentacao: boolean;
  biometria_coletada: boolean;
  cartao_sus: string;
};

export type CadastroBiometriaPayload = {
  vetor_facial: number[];
  reeducando_id: number;
};

function asId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractId(data: unknown, preferredKeys: string[] = ['id']): number | null {
  const direct = asId(data);
  if (direct != null) return direct;

  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  for (const key of preferredKeys) {
    const id = asId(record[key]);
    if (id != null) return id;
  }

  for (const [key, value] of Object.entries(record)) {
    if (/id$/i.test(key) || key.toLowerCase() === 'id') {
      const id = asId(value);
      if (id != null) return id;
    }
  }

  if (record.data != null) return extractId(record.data, preferredKeys);
  if (record.result != null) return extractId(record.result, preferredKeys);
  return null;
}

function maskAuthHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = { ...headers };
  for (const key of Object.keys(masked)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization' || lower === 'token') {
      const value = masked[key];
      masked[key] =
        value.length <= 12 ? '***' : `${value.slice(0, 10)}...${value.slice(-4)} (len=${value.length})`;
    }
  }
  return masked;
}

function logCadastroEtapa(
  etapa: string,
  info: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
    status?: number;
    ok?: boolean;
    responseText?: string;
    responseData?: unknown;
    error?: unknown;
  }
) {
  const border = '='.repeat(72);
  console.log(`\n${border}`);
  console.log(`[CADASTRO] ${etapa}`);
  console.log(border);
  console.log('[CADASTRO] REQUEST');
  console.log('  method:', info.method);
  console.log('  url:', info.url);
  console.log('  headers:', JSON.stringify(maskAuthHeaders(info.headers), null, 2));
  console.log('  body:', JSON.stringify(info.body, null, 2));

  if (info.status != null) {
    console.log('[CADASTRO] RESPONSE');
    console.log('  status:', info.status, info.ok ? 'OK' : 'ERROR');
    console.log('  raw:', info.responseText ?? '');
    console.log('  json:', JSON.stringify(info.responseData, null, 2));
  }

  if (info.error != null) {
    console.log('[CADASTRO] ERROR');
    console.log(info.error);
  }
  console.log(`${border}\n`);
}

async function postJson(etapa: string, path: string, body: unknown): Promise<unknown> {
  const url = `${CADASTRO_BASE}${path}`;
  const headers = await getAuthHeaders({
    Accept: '*/*',
    'Content-Type': 'application/json',
  });

  logCadastroEtapa(`${etapa} — enviando`, {
    url,
    method: 'POST',
    headers,
    body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      const trimmed = text.trim();
      try {
        data = JSON.parse(trimmed);
      } catch {
        data = trimmed;
      }
    }

    logCadastroEtapa(`${etapa} — resposta`, {
      url,
      method: 'POST',
      headers,
      body,
      status: response.status,
      ok: response.ok,
      responseText: text,
      responseData: data,
    });

    if (!response.ok) {
      let message = `Erro HTTP ${response.status}`;
      if (typeof data === 'object' && data !== null) {
        const err = data as { detail?: unknown; message?: unknown; title?: unknown };
        if (typeof err.detail === 'string' && err.detail.trim()) message = err.detail;
        else if (typeof err.message === 'string' && err.message.trim()) message = err.message;
        else if (typeof err.title === 'string' && err.title.trim()) message = err.title;
      } else if (typeof data === 'string' && data.trim()) {
        message = data;
      }
      throw new Error(message);
    }

    return data;
  } catch (error) {
    logCadastroEtapa(`${etapa} — falha`, {
      url,
      method: 'POST',
      headers,
      body,
      error,
    });
    throw error;
  }
}

export async function cadastrarPessoa(payload: CadastroPessoaPayload): Promise<number> {
  console.log('[CADASTRO] Etapa 1/3 — Pessoa');
  const data = await postJson('1/3 Pessoa', '/pessoa/v1/', payload);
  const id = extractId(data, ['id', 'pessoa_id', 'pessoaId']);
  console.log('[CADASTRO] Etapa 1/3 — pessoa_id:', id);
  if (id == null) {
    throw new Error('Cadastro de pessoa ok, mas o ID não veio na resposta.');
  }
  return id;
}

export async function cadastrarReeducando(payload: CadastroReeducandoPayload): Promise<number> {
  console.log('[CADASTRO] Etapa 2/3 — Reeducando');
  const data = await postJson('2/3 Reeducando', '/reeducando/v1/', payload);
  const id = extractId(data, ['id', 'reeducando_id', 'reeducandoId']);
  console.log('[CADASTRO] Etapa 2/3 — reeducando_id:', id);
  if (id == null) {
    throw new Error('Cadastro do reeducando ok, mas o ID não veio na resposta.');
  }
  return id;
}

export async function cadastrarBiometriaReeducando(
  payload: CadastroBiometriaPayload
): Promise<void> {
  console.log('[CADASTRO] Etapa 3/3 — Biometria', {
    reeducando_id: payload.reeducando_id,
    vetor_facial_length: payload.vetor_facial?.length ?? 0,
  });
  await postJson('3/3 Biometria', '/biometria/reeducando/v1/', payload);
  console.log('[CADASTRO] Etapa 3/3 — biometria concluída');
}

export function toNumberOrZero(value: string): number {
  const n = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}
