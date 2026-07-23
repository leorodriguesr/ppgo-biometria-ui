/**
 * Temporário: reutiliza o client SSO do agenda até o biometria ter ambiente próprio.
 * Fonte: ppgo-agendaac4/src/configs/sistemaConfig.js
 */
export const sistemaNameSSO = 'ppgoagendaac4';

export const domainNameProd = 'ppgoagendaac4.ssp.go.gov.br';
export const domainNameHomo = 'ppgoagendaac4-homo.ssp.go.gov.br';
export const domainNameDesv = 'localhost';

export const perfisSistema = {
  ADM: 'ADM',
  ATENDENTE: 'ATENDENTE',
  SUPORTE: 'SUPORTE',
  BASICO: 'BASICO',
  ALL: 'QUALQUER_PERFIL',
} as const;
