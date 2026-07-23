/** Mantém só dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Máscara CPF: 000.000.000-00 */
export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** Máscara data: DD/MM/YYYY */
export function maskDateBr(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Valida e normaliza para DD/MM/YYYY. Aceita também ISO e devolve BR. */
export function toDobBr(value: string): string {
  const trimmed = value.trim();
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new Error('Data de nascimento inválida.');
    }
    return `${br[1]}/${br[2]}/${br[3]}`;
  }

  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) {
    const day = String(iso.getUTCDate()).padStart(2, '0');
    const month = String(iso.getUTCMonth() + 1).padStart(2, '0');
    const year = String(iso.getUTCFullYear());
    return `${day}/${month}/${year}`;
  }

  throw new Error('Data de nascimento inválida. Use DD/MM/YYYY.');
}

/**
 * Converte DD/MM/YYYY (UI) para date-time ISO exigido pela API (format: date-time).
 * Ex.: 11/01/1989 → 1989-01-11T12:00:00.000Z
 */
export function dobBrToIsoDateTime(value: string): string {
  const br = toDobBr(value);
  const [dd, mm, yyyy] = br.split('/');
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0)).toISOString();
}
