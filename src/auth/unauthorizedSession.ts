export class UnauthorizedError extends Error {
  constructor(message = 'Sessão expirada') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

type UnauthorizedHandler = () => void;

let handler: UnauthorizedHandler | null = null;
let notifying = false;

export function setUnauthorizedHandler(next: UnauthorizedHandler | null) {
  handler = next;
}

export function notifyUnauthorized() {
  if (notifying) return;
  notifying = true;
  try {
    handler?.();
  } finally {
    setTimeout(() => {
      notifying = false;
    }, 500);
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof UnauthorizedError) return true;
  if (!(error instanceof Error)) return false;
  return isInvalidTokenMessage(error.message);
}

function collectText(value: unknown, depth = 0): string {
  if (value == null || depth > 4) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => collectText(item, depth + 1)).join(' ');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => collectText(item, depth + 1))
      .join(' ');
  }
  return '';
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isInvalidTokenMessage(text: string): boolean {
  const n = normalize(text);
  if (!n) return false;
  if (n.includes('x-api-key')) return false;
  if (n.includes('token invalido') || n.includes('token ausente')) return true;
  if (n.includes('acesso nao autorizado') && n.includes('token')) return true;
  return false;
}

export function isUnauthorizedResponse(status: number, data?: unknown): boolean {
  const text = collectText(data);
  if (isInvalidTokenMessage(text)) return true;
  if (status === 401 && !normalize(text).includes('x-api-key')) return true;
  return false;
}

export function rejectIfUnauthorized(status: number, data?: unknown): void {
  if (!isUnauthorizedResponse(status, data)) return;
  notifyUnauthorized();
  throw new UnauthorizedError();
}
