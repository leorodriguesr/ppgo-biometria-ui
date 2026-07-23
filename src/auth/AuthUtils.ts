import { sistemaNameSSO } from '@/src/configs/sistemaConfig';
import { urlsServices } from '@/src/configs/urlsConfig';

export type PerfilItem = {
  sistema?: { descricao?: string };
  descricao?: string;
};

export type ServidorInfo = {
  cpf?: string;
  nome?: string;
};

export type UserLogado = {
  token?: string;
  corporacao_id?: number;
  servidor?: ServidorInfo;
  perfis?: PerfilItem[];
  perfisSistemaAtual?: string[];
  semPerfilThisSistema?: boolean;
  icon?: string;
  /** Campos extras vindos do SSO validate */
  cpf?: string;
  nome?: string;
  [key: string]: unknown;
};

function utf8ToB64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const input = unescape(encodeURIComponent(str));
  while (i < input.length) {
    const chr1 = input.charCodeAt(i++);
    const chr2 = input.charCodeAt(i++);
    const chr3 = input.charCodeAt(i++);
    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;
    if (Number.isNaN(chr2)) {
      enc3 = 64;
      enc4 = 64;
    } else if (Number.isNaN(chr3)) {
      enc4 = 64;
    }
    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }
  return output;
}

function reverseString(str = ''): string {
  return str.split('').reverse().join('');
}

function getEncodeAvatarUsuario(cpf: string, size = '_80'): string {
  return reverseString(utf8ToB64(reverseString(utf8ToB64(`${cpf}_${Date.now()}${size}`))));
}

/** Normaliza resposta do SSO validate ou da API usuario-logado. */
export function normalizeUserPayload(data: unknown): UserLogado {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const raw = data as UserLogado;

  if (raw.servidor?.cpf) {
    return { ...raw };
  }

  const cpf = raw.cpf ?? (typeof raw.servidor === 'object' ? raw.servidor?.cpf : undefined);
  const nome = raw.nome ?? (typeof raw.servidor === 'object' ? raw.servidor?.nome : undefined);

  return {
    ...raw,
    servidor: {
      cpf: typeof cpf === 'string' ? cpf : undefined,
      nome: typeof nome === 'string' ? nome : undefined,
    },
  };
}

export function prepareDataUser(data: unknown): UserLogado {
  const dadosUsuario = normalizeUserPayload(data);
  const cpf = dadosUsuario.servidor?.cpf;

  if (cpf) {
    dadosUsuario.icon = `${urlsServices.SIGUWS}icon?u=${getEncodeAvatarUsuario(cpf)}`;
  }

  if (dadosUsuario.perfis && Array.isArray(dadosUsuario.perfis)) {
    const thisPerfis: string[] = [];
    for (const perfil of dadosUsuario.perfis) {
      const sistemaDesc = perfil.sistema?.descricao?.toUpperCase();
      const perfilDesc = perfil.descricao?.toUpperCase();
      if (sistemaDesc === sistemaNameSSO.toUpperCase() && perfilDesc) {
        if (!thisPerfis.includes(perfilDesc)) {
          thisPerfis.push(perfilDesc);
        }
      }
    }
    if (thisPerfis.length < 1) {
      dadosUsuario.semPerfilThisSistema = true;
    } else {
      dadosUsuario.perfisSistemaAtual = thisPerfis;
      dadosUsuario.semPerfilThisSistema = false;
    }
  }

  return dadosUsuario;
}
