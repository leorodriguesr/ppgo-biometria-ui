import type { BustPhotoKind } from '@/src/features/photos/types';
import type { PrisonerPhotoRow, PrisonerRow } from '@/src/services/database';
import {
  anexarArquivo,
  criarPreCadastro,
  type PreCadastroFoto,
  type PreCadastroPayload,
  type PreCadastroSinalLesao,
  type TipoPose,
} from '@/src/services/goiaspenAppApi';
import { onlyDigits, toDobBr } from '@/src/utils/inputMasks';

/** A API não distingue lado: perfil esquerdo e direito usam PERFIL. */
const BUST_TO_POSE: Record<BustPhotoKind, TipoPose> = {
  front: 'FRENTE',
  right_profile: 'PERFIL',
  left_profile: 'PERFIL',
};

/** DD/MM/YYYY → 1990-05-10T00:00:00 (formato do contrato). */
export function dobBrToApiDateTime(value: string): string {
  const br = toDobBr(value);
  const [dd, mm, yyyy] = br.split('/');
  return `${yyyy}-${mm}-${dd}T00:00:00`;
}

export function mapSexoToApi(sexo: string | null | undefined): string | undefined {
  if (!sexo) return undefined;
  const normalized = sexo.trim().toUpperCase();
  if (normalized === 'M' || normalized === 'MASCULINO') return 'M';
  if (normalized === 'F' || normalized === 'FEMININO') return 'F';
  return normalized.slice(0, 1);
}

function parseEmbedding(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : typeof parsed === 'string' ? JSON.parse(parsed) : null;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (!arr.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return arr;
  } catch {
    return null;
  }
}

function fileNameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  if (last && last.includes('.')) return last;
  return fallback;
}

/**
 * Monta e envia o pré-cadastro:
 * 1) valida rascunho local
 * 2) anexa fotos no FileWS
 * 3) POST /pre-cadastro
 */
export async function submitPreCadastroFromLocal(input: {
  prisoner: PrisonerRow;
  photos: PrisonerPhotoRow[];
  onProgress?: (message: string) => void;
}): Promise<void> {
  const { prisoner, photos, onProgress } = input;

  const nome = prisoner.name?.trim();
  if (!nome) throw new Error('Nome é obrigatório.');

  const mae = prisoner.mother_name?.trim();
  if (!mae) throw new Error('Nome da mãe é obrigatório.');

  const cpf = onlyDigits(prisoner.cpf ?? '');
  if (cpf.length !== 11) throw new Error('CPF inválido.');

  const sexo = mapSexoToApi(prisoner.sexo);
  if (!sexo) throw new Error('Sexo é obrigatório.');

  let dataNascimento: string | undefined;
  if (prisoner.dob?.trim()) {
    dataNascimento = dobBrToApiDateTime(prisoner.dob);
  } else {
    throw new Error('Data de nascimento é obrigatória.');
  }

  const vetorFacial = parseEmbedding(prisoner.face_embedding);
  if (!vetorFacial) {
    throw new Error('Biometria facial ausente. Capture o rosto antes de concluir.');
  }

  const bustKinds: BustPhotoKind[] = ['front', 'right_profile', 'left_profile'];
  const bustPhotos = bustKinds.map((kind) => {
    const row = photos.find((p) => p.photo_type === kind);
    return row ? { kind, row } : null;
  });

  if (bustPhotos.some((p) => p == null)) {
    throw new Error('Capture frente, perfil direito e perfil esquerdo antes de concluir.');
  }

  const markPhotos = photos.filter(
    (p) => p.photo_type === 'mark' || p.photo_type === 'tattoo'
  );
  for (const mark of markPhotos) {
    if (!mark.sinal || !mark.parte_corpo) {
      throw new Error(
        'Há marca/tatuagem sem tipo de sinal ou parte do corpo. Remova e recapture.'
      );
    }
    const obs = (mark.observacao ?? '').trim();
    if (obs.length > 70) {
      throw new Error('Observação do sinal/lesão deve ter no máximo 70 caracteres.');
    }
  }

  const fotos: PreCadastroFoto[] = [];
  for (const item of bustPhotos) {
    if (!item) continue;
    onProgress?.(`Enviando foto ${BUST_TO_POSE[item.kind]}...`);
    const file = await anexarArquivo(
      item.row.photo_uri,
      fileNameFromUri(item.row.photo_uri, `${item.kind}.jpg`)
    );
    fotos.push({
      idFile: file.id,
      nomeOriginal: file.nomeOriginal || fileNameFromUri(item.row.photo_uri, `${item.kind}.jpg`),
      mimeType: file.mimeType || 'image/jpeg',
      tipoPose: BUST_TO_POSE[item.kind],
      principal: item.kind === 'front',
    });
  }

  const sinaisLesoes: PreCadastroSinalLesao[] = [];
  for (let i = 0; i < markPhotos.length; i++) {
    const mark = markPhotos[i];
    onProgress?.(`Enviando sinal/lesão ${i + 1}/${markPhotos.length}...`);
    const file = await anexarArquivo(
      mark.photo_uri,
      fileNameFromUri(mark.photo_uri, `sinal-${i + 1}.jpg`)
    );
    const obs =
      (mark.observacao ?? '').trim().slice(0, 70) ||
      (mark.photo_type === 'tattoo' ? 'TATUAGEM' : 'SINAL');
    sinaisLesoes.push({
      sinal: String(mark.sinal),
      parteDoCorpo: String(mark.parte_corpo),
      observacao: obs,
      anexoFilewsId: file.id,
      anexoNomeOri: file.nomeOriginal || fileNameFromUri(mark.photo_uri, `sinal-${i + 1}.jpg`),
      anexoTipo: file.mimeType || 'image/jpeg',
    });
  }

  const payload: PreCadastroPayload = {
    nome,
    nomeSocial: prisoner.social_name?.trim() || undefined,
    dataNascimento,
    sexo,
    mae,
    pai: prisoner.filiation?.trim() || undefined,
    rg: prisoner.rg?.trim() || undefined,
    orgaoEmissor: prisoner.orgao_emissor?.trim() || undefined,
    cpf,
    escolaridade: prisoner.education?.trim() || undefined,
    profissao: prisoner.profession?.trim() || undefined,
    estadoCivil: prisoner.marital_status?.trim() || undefined,
    naturalidade: prisoner.birth_place?.trim() || undefined,
    endereco: prisoner.address?.trim() || undefined,
    telefone: onlyDigits(prisoner.phone ?? '') || undefined,
    vetorFacial,
    fotos,
    ...(sinaisLesoes.length > 0 ? { sinaisLesoes } : {}),
  };

  onProgress?.('Enviando pré-cadastro...');
  await criarPreCadastro(payload);
}
