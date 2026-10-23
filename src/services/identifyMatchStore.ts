import type { BustPhotoKind } from '@/src/features/photos/types';
import type { PrisonerPhotoRow, PrisonerRow } from '@/src/services/database';
import type { BuscaFacialFoto, BuscaFacialMatch } from '@/src/services/goiaspenAppApi';
import type { PrefillBustPhoto } from '@/src/services/persistPrefillPhotos';

export type IdentifyMatchView = {
  prisoner: PrisonerRow;
  photos: PrisonerPhotoRow[];
  /** Fotos extras da API, sem a de frente. */
  galleryUris: string[];
  bustPhotos: PrefillBustPhoto[];
  reeducandoId: string;
  distance?: number;
};

const cache = new Map<string, IdentifyMatchView>();

function toPrisonerRow(match: BuscaFacialMatch): PrisonerRow {
  const numericId = Number(match.id);
  return {
    id: Number.isFinite(numericId) ? numericId : 0,
    name: match.nome,
    mother_name: match.mae ?? null,
    dob: match.dataNascimento ?? null,
    cpf: match.cpf ?? null,
    photo_uri: match.fotoUrl ?? null,
    face_embedding: null,
    social_name: match.nomeSocial ?? null,
    nationality: match.nacionalidade ?? null,
    marital_status: match.estadoCivil ?? null,
    profession: match.profissao ?? null,
    education: match.escolaridade ?? null,
    age: null,
    birth_place: match.naturalidade ?? null,
    filiation: match.pai ?? null,
    address: match.endereco ?? null,
    phone: match.telefone ?? null,
    email: match.email ?? null,
    sexo: match.sexo ?? null,
    rg: match.rg ?? null,
    orgao_emissor: match.orgaoEmissor ?? null,
    prontuario: match.prontuario ?? null,
  };
}

function assignBustPhotos(match: BuscaFacialMatch): PrefillBustPhoto[] {
  const slots: BustPhotoKind[] = ['front', 'right_profile', 'left_profile'];
  const used = new Set<BustPhotoKind>();
  const out: PrefillBustPhoto[] = [];
  const detalhe: BuscaFacialFoto[] = match.fotosDetalhe?.length
    ? match.fotosDetalhe
    : (match.fotos ?? []).map((uri) => ({ uri }));

  for (const item of detalhe) {
    if (item.kind && slots.includes(item.kind) && !used.has(item.kind)) {
      used.add(item.kind);
      out.push({ kind: item.kind, uri: item.uri });
    }
  }
  for (const item of detalhe) {
    if (out.some((photo) => photo.uri === item.uri)) continue;
    const kind = slots.find((slot) => !used.has(slot));
    if (!kind) break;
    used.add(kind);
    out.push({ kind, uri: item.uri });
  }
  return out;
}

export function setIdentifyMatch(match: BuscaFacialMatch): IdentifyMatchView {
  const bustPhotos = assignBustPhotos(match);
  const front = bustPhotos.find((photo) => photo.kind === 'front')?.uri ?? match.fotoUrl ?? match.fotos?.[0];
  const galleryUris = (match.fotos ?? []).filter((uri) => uri !== front);
  const prisoner = toPrisonerRow(match);
  if (front) prisoner.photo_uri = front;
  const photos: PrisonerPhotoRow[] = bustPhotos.map((photo, index) => ({
    id: index + 1,
    prisoner_id: prisoner.id,
    photo_type: photo.kind,
    body_region: null,
    body_side: null,
    photo_uri: photo.uri,
    quality_ok: 1,
    created_at: '',
    sinal: null,
    parte_corpo: null,
    observacao: null,
  }));
  const view: IdentifyMatchView = {
    prisoner,
    photos,
    galleryUris,
    bustPhotos,
    reeducandoId: match.id,
    distance: match.distance,
  };
  cache.set(match.id, view);
  cache.set(String(view.prisoner.id), view);
  cache.set('last', view);
  return view;
}

let matchList: BuscaFacialMatch[] = [];

export function setIdentifyMatchList(matches: BuscaFacialMatch[]): void {
  matchList = matches;
  for (const match of matches) {
    setIdentifyMatch(match);
  }
}

export function getIdentifyMatchList(): BuscaFacialMatch[] {
  return matchList;
}

export function getIdentifyMatch(id?: string): IdentifyMatchView | null {
  if (id) return cache.get(id) ?? null;
  return cache.get('last') ?? null;
}

export function clearIdentifyMatches(): void {
  cache.clear();
  matchList = [];
  searchPurpose = 'identify';
}

export type FacialSearchPurpose = 'identify' | 'prefill' | 'update';

let searchPurpose: FacialSearchPurpose = 'identify';

export function setFacialSearchPurpose(purpose: FacialSearchPurpose): void {
  searchPurpose = purpose;
}

export function getFacialSearchPurpose(): FacialSearchPurpose {
  return searchPurpose;
}

export function registerParamsFromMatch(match: BuscaFacialMatch): Record<string, string> {
  setIdentifyMatch(match);
  return {
    prefillMatchId: match.id,
    prefillName: match.nome ?? '',
    prefillMotherName: match.mae ?? '',
    prefillDob: match.dataNascimento ?? '',
    prefillCpf: match.cpf ?? '',
    prefillSocialName: match.nomeSocial ?? '',
    prefillSexo: match.sexo ?? '',
    prefillRg: match.rg ?? '',
    prefillOrgaoEmissor: match.orgaoEmissor ?? '',
    prefillNationality: match.nacionalidade ?? '',
    prefillMaritalStatus: match.estadoCivil ?? '',
    prefillProfession: match.profissao ?? '',
    prefillEducation: match.escolaridade ?? '',
    prefillBirthPlace: match.naturalidade ?? '',
    prefillFiliation: match.pai ?? '',
    prefillAddress: match.endereco ?? '',
    prefillPhone: match.telefone ?? '',
    prefillEmail: match.email ?? '',
    prefillProntuario: match.prontuario ?? '',
    prefillSource: 'face',
  };
}
