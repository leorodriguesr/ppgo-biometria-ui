import {
  ESTADO_CIVIL_API_OPTIONS,
  GRAU_INSTRUCAO_OPTIONS,
  NACIONALIDADE_OPTIONS,
  type SelectOption,
} from '@/src/configs/cadastroOptions';

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function mapOption(raw: string | undefined, options: SelectOption[]): string {
  if (!raw?.trim()) return '';
  const needle = fold(raw);
  const exact = options.find((opt) => fold(opt.value) === needle || fold(opt.label) === needle);
  if (exact) return exact.value;
  const partial = options.find(
    (opt) => fold(opt.label).includes(needle) || needle.includes(fold(opt.value)) || needle.includes(fold(opt.label))
  );
  return partial?.value ?? raw.trim();
}

export function mapSexoPrefill(raw?: string | null): string {
  if (!raw?.trim()) return '';
  const t = fold(raw);
  if (t === 'M' || t.startsWith('MASC')) return 'M';
  if (t === 'F' || t.startsWith('FEM')) return 'F';
  return raw.trim();
}

export function mapEstadoCivilPrefill(raw?: string | null): string {
  return mapOption(raw ?? undefined, ESTADO_CIVIL_API_OPTIONS);
}

export function mapEscolaridadePrefill(raw?: string | null): string {
  return mapOption(raw ?? undefined, GRAU_INSTRUCAO_OPTIONS);
}

export function mapNacionalidadePrefill(raw?: string | null): string {
  if (!raw?.trim()) return '';
  const t = fold(raw);
  if (t.includes('BRASIL') && t.includes('NAT')) return 'Brasileiro - Nato';
  if (t.includes('BRASIL') || t === 'BR') return 'Brasileiro - Nato';
  if (t.includes('NATURALIZ')) return 'Naturalizado(a)';
  if (t.includes('ESTRANG')) return 'Estrangeiro(a)';
  return mapOption(raw, NACIONALIDADE_OPTIONS);
}
