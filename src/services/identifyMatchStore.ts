import type { PrisonerPhotoRow, PrisonerRow } from '@/src/services/database';
import type { BuscaFacialMatch } from '@/src/services/goiaspenAppApi';

export type IdentifyMatchView = {
  prisoner: PrisonerRow;
  photos: PrisonerPhotoRow[];
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
  };
}

export function setIdentifyMatch(match: BuscaFacialMatch): IdentifyMatchView {
  const view: IdentifyMatchView = {
    prisoner: toPrisonerRow(match),
    photos: [],
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

export type FacialSearchPurpose = 'identify' | 'prefill';

let searchPurpose: FacialSearchPurpose = 'identify';

export function setFacialSearchPurpose(purpose: FacialSearchPurpose): void {
  searchPurpose = purpose;
}

export function getFacialSearchPurpose(): FacialSearchPurpose {
  return searchPurpose;
}

export function registerParamsFromMatch(match: BuscaFacialMatch): Record<string, string> {
  return {
    prefillName: match.nome ?? '',
    prefillMotherName: match.mae ?? '',
    prefillDob: match.dataNascimento ?? '',
    prefillCpf: match.cpf ?? '',
    prefillSocialName: match.nomeSocial ?? '',
    prefillNationality: match.nacionalidade ?? '',
    prefillMaritalStatus: match.estadoCivil ?? '',
    prefillProfession: match.profissao ?? '',
    prefillEducation: match.escolaridade ?? '',
    prefillBirthPlace: match.naturalidade ?? '',
    prefillFiliation: match.pai ?? '',
    prefillAddress: match.endereco ?? '',
    prefillPhone: match.telefone ?? '',
    prefillEmail: match.email ?? '',
    prefillSource: 'face',
  };
}
