/**
 * URLs SSO / SIGU por ambiente.
 * Redirect usa a URL https do agenda (cadastrada no SSO).
 * O token é capturado no WebView ao redirecionar — o site do agenda não fica aberto.
 */
import { domainNameHomo, domainNameProd } from './sistemaConfig';

export type Ambiente = 'PROD' | 'HOMO';

function readAmbiente(): Ambiente {
  const raw = (process.env.EXPO_PUBLIC_AMBIENTE ?? '').trim().toUpperCase();
  if (raw === 'HOMO' || raw === 'PROD') return raw;
  return __DEV__ ? 'HOMO' : 'PROD';
}

export const ambiente: Ambiente = readAmbiente();

const URLS_BY_ENV = {
  PROD: {
    SIGUWS: 'https://siguws.ssp.go.gov.br/',
    SSOWS: 'https://ssows.ssp.go.gov.br/',
    /** API IntegracaoGoiasPenApp (/api/goiaspenApp). */
    GOIASPEN: 'https://goiaspen.ssp.go.gov.br/',
    /** API Python (embedding / qualidade de foto). Preencha com o HTTPS do gateway. */
    BIOMETRIA: 'https://ppgobiometriafacialapi.ssp.go.gov.br/',
  },
  HOMO: {
    SIGUWS: 'https://siguws-h.ssp.go.gov.br/',
    SSOWS: 'https://ssows-h.ssp.go.gov.br/',
    /** API IntegracaoGoiasPenApp (/api/goiaspenApp). */
    GOIASPEN: 'https://goiaspen-homo.ssp.go.gov.br/',
    /** API Python (embedding / qualidade de foto). */
    BIOMETRIA: 'https://ppgobiometriafacialapi-homo.ssp.go.gov.br/',
  },
} as const;

export const urlsServices = URLS_BY_ENV[ambiente];

/** Redirect cadastrado no client SSO do agenda (web). */
export const SSO_REDIRECT_URI =
  ambiente === 'PROD' ? `https://${domainNameProd}/` : `https://${domainNameHomo}/`;

/** Sem validação no backend do agenda — só guardamos o token. */
export const AUTH_API_BASE_URL = '';
