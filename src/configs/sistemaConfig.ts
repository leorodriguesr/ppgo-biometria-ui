/**
 * Temporário: reutiliza o client SSO do agenda até o biometria ter ambiente próprio.
 * Fonte: ppgo-agendaac4/src/configs/sistemaConfig.js
 */
export const sistemaNameSSO = 'goiaspen';

export const domainNameProd = 'goiaspen.ssp.go.gov.br';
export const domainNameHomo = 'goiaspen-homo.ssp.go.gov.br';
export const domainNameDesv = 'localhost';

export const perfisSistema = {
  ADM: 'ADM',
  ATENDENTE: 'ATENDENTE',
  SUPORTE: 'SUPORTE',
  BASICO: 'BASICO',
  ALL: 'QUALQUER_PERFIL',
} as const;
