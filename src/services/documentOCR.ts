export interface ExtractedPrisonerDocumentData {
    name?: string;
    motherName?: string;
    dob?: string;
    cpf?: string;
    socialName?: string;
    nationality?: string;
    maritalStatus?: string;
    profession?: string;
    education?: string;
    age?: string;
    birthPlace?: string;
    filiation?: string;
    address?: string;
    phone?: string;
    email?: string;
}

/** Regex para data no formato DD/MM/AAAA ou DD-MM-AAAA */
const DATE_REGEX = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;

/** Palavras-chave que costumam preceder o nome em documentos (RG, etc.) */
const NAME_LABELS = /\b(NOME|NOME\s+COMPLETO|NOME\s+DO\s+INDICIADO|TITULAR)\s*[:.]?\s*/i;

/** Palavras-chave para nome da mãe */
const MOTHER_LABELS = /\b(NOME\s+DA\s+M[AÃ]E|FILIA[CÇ][AÃ]O|M[AÃ]E|NOME\s+DA\s+GENITORA)\s*[:.]?\s*/i;

/** Palavras-chave para data de nascimento */
const DOB_LABELS = /\b(NASCIMENTO|DATA\s+DE\s+NASCIMENTO|NATAL|NASC\.?|DT\.?\s*NASC)\s*[:.]?\s*/i;

/** CPF: 000.000.000-00 ou 00000000000 (11 dígitos) */
const CPF_REGEX = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;

/** Rótulos genéricos: texto após o rótulo até fim da linha ou próximo rótulo */
const LABELS: { key: keyof Omit<ExtractedPrisonerDocumentData, 'dob' | 'cpf'>; pattern: RegExp }[] = [
    { key: 'socialName', pattern: /\b(NOME\s+SOCIAL)\s*[:.]?\s*/i },
    { key: 'nationality', pattern: /\b(NACIONALIDADE)\s*[:.]?\s*/i },
    { key: 'maritalStatus', pattern: /\b(ESTADO\s+CIVIL|EST\.?\s*CIVIL)\s*[:.]?\s*/i },
    { key: 'profession', pattern: /\b(PROFISS[AÃ]O|OCUPA[CÇ][AÃ]O)\s*[:.]?\s*/i },
    { key: 'education', pattern: /\b(ESCOLARIDADE|GRAU\s+DE\s+INSTRU[CÇ][AÃ]O|INSTRU[CÇ][AÃ]O)\s*[:.]?\s*/i },
    { key: 'age', pattern: /\b(IDADE)\s*[:.]?\s*/i },
    { key: 'birthPlace', pattern: /\b(NATURALIDADE|NATURAL)\s*[:.]?\s*/i },
    { key: 'filiation', pattern: /\b(FILIA[CÇ][AÃ]O|PAI|NOME\s+DO\s+PAI)\s*[:.]?\s*/i },
    { key: 'address', pattern: /\b(ENDERE[CÇ]O|RESID[EÊ]NCIA|LOGRADOURO)\s*[:.]?\s*/i },
    { key: 'phone', pattern: /\b(TELEFONE|CELULAR|FONE|TEL\.?)\s*[:.]?\s*/i },
    { key: 'email', pattern: /\b(E-?MAIL|EMAIL)\s*[:.]?\s*/i },
];

function extractDate(text: string): string | undefined {
    const matches = text.match(DATE_REGEX);
    if (!matches || matches.length === 0) return undefined;
    for (const m of matches) {
        const parts = m.split(/[\/\-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year < 100) year += year < 50 ? 2000 : 1900;
        if (year >= 1900 && year <= 2010 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        }
    }
    return matches[0]!.replace(/-/g, '/');
}

function extractAfterLabel(fullText: string, labels: RegExp): string | undefined {
    const labelMatch = fullText.match(labels);
    if (!labelMatch) return undefined;
    const idx = fullText.indexOf(labelMatch[0]);
    const after = fullText.slice(idx + labelMatch[0].length);
    const nextLineOrLabel = after.split(/\n|(?=\d{3}\.\d{3}\.\d{3})/)[0]?.trim();
    if (!nextLineOrLabel) return undefined;
    const name = nextLineOrLabel.replace(/\s+/g, ' ').replace(/[^\p{L}\s\-']/gu, '').trim();
    return name.length >= 2 ? name : undefined;
}

/** Extrai texto após um rótulo genérico (até quebra de linha ou próximo rótulo). Para campos que aceitam números/símbolos. */
function extractAfterLabelGeneric(fullText: string, pattern: RegExp, maxLen = 120): string | undefined {
    const labelMatch = fullText.match(pattern);
    if (!labelMatch) return undefined;
    const idx = fullText.indexOf(labelMatch[0]);
    const after = fullText.slice(idx + labelMatch[0].length, idx + labelMatch[0].length + maxLen);
    const line = after.split(/\n/)[0]?.trim();
    if (!line) return undefined;
    const cleaned = line.replace(/\s+/g, ' ').trim();
    return cleaned.length >= 1 ? cleaned : undefined;
}

function extractNameHeuristic(lines: string[]): string | undefined {
    const fullText = lines.join('\n');
    const byLabel = extractAfterLabel(fullText, NAME_LABELS);
    if (byLabel) return byLabel;
    let best = '';
    for (const line of lines) {
        const cleaned = line.replace(/\d/g, '').trim();
        const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
        if (words.length >= 2 && words.length <= 6 && cleaned.length > best.length && /^[\p{L}\s\-']+$/u.test(cleaned)) {
            best = cleaned;
        }
    }
    return best.length >= 4 ? best : undefined;
}

function extractMotherNameHeuristic(lines: string[]): string | undefined {
    const fullText = lines.join('\n');
    return extractAfterLabel(fullText, MOTHER_LABELS);
}

function extractDobHeuristic(lines: string[]): string | undefined {
    const fullText = lines.join('\n');
    const date = extractDate(fullText);
    if (date) return date;
    const dobLabel = fullText.match(DOB_LABELS);
    if (dobLabel) {
        const idx = fullText.indexOf(dobLabel[0]);
        const after = fullText.slice(idx + dobLabel[0].length, idx + 80);
        const dateInAfter = after.match(DATE_REGEX);
        if (dateInAfter?.[0]) return dateInAfter[0].replace(/-/g, '/');
    }
    return undefined;
}

function normalizeCpf(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 11) return raw;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function extractCpfHeuristic(lines: string[]): string | undefined {
    const fullText = lines.join(' ');
    const matches = fullText.match(CPF_REGEX);
    if (!matches || matches.length === 0) return undefined;
    const first = matches[0]!;
    const digits = first.replace(/\D/g, '');
    if (digits.length !== 11) return undefined;
    return normalizeCpf(first);
}

/**
 * A partir das linhas de texto já extraídas (ex.: por OCR), identifica
 * nome, nome da mãe, data de nascimento, CPF e demais campos. Não usa módulo nativo.
 */
export function parseDocumentLines(lines: string[]): ExtractedPrisonerDocumentData {
    if (!lines || lines.length === 0) return {};

    const fullText = lines.join('\n');
    const name = extractNameHeuristic(lines);
    const motherName = extractMotherNameHeuristic(lines);
    const dob = extractDobHeuristic(lines);
    const cpf = extractCpfHeuristic(lines);

    const result: ExtractedPrisonerDocumentData = {
        ...(name && { name }),
        ...(motherName && { motherName }),
        ...(dob && { dob }),
        ...(cpf && { cpf }),
    };

    for (const { key, pattern } of LABELS) {
        const value = extractAfterLabelGeneric(fullText, pattern);
        if (value) (result as Record<string, string>)[key] = value;
    }

    return result;
}
