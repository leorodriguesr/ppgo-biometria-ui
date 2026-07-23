/**
 * URLs SSO / SIGU por ambiente.
 * Redirect usa a URL https do agenda (cadastrada no SSO).
 * O token é capturado no WebView ao redirecionar — o site do agenda não fica aberto.
 */
import { domainNameHomo, domainNameProd } from './sistemaConfig';

export type Ambiente = 'PROD' | 'HOMO';

export const ambiente: Ambiente = __DEV__ ? 'HOMO' : 'PROD';

const URLS_BY_ENV = {
  PROD: {
    SIGUWS: 'https://siguws.ssp.go.gov.br/',
    LEGADOWS: 'https://legadows.ssp.go.gov.br/',
    /** Gateway APIs GoiásPen / DGPP (Swagger GOIASPEN_OLD). */
    DGPPWS: 'https://dgppws.ssp.go.gov.br/',
    SSOWS: 'https://ssows.ssp.go.gov.br/',
  },
  HOMO: {
    SIGUWS: 'https://siguws-h.ssp.go.gov.br/',
    LEGADOWS: 'https://legadows-h.ssp.go.gov.br/',
    /** Gateway APIs GoiásPen / DGPP (Swagger GOIASPEN_OLD). */
    DGPPWS: 'https://dgppws-h.ssp.go.gov.br/',
    SSOWS: 'https://ssows-h.ssp.go.gov.br/',
  },
} as const;

export const urlsServices = URLS_BY_ENV[ambiente];

/** Redirect cadastrado no client SSO do agenda (web). */
export const SSO_REDIRECT_URI =
  ambiente === 'PROD' ? `https://${domainNameProd}/` : `https://${domainNameHomo}/`;

/** Sem validação no backend do agenda — só guardamos o token. */
export const AUTH_API_BASE_URL = '';
