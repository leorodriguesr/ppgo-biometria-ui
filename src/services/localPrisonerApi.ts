import {
  getPrisonerById,
  getPrisonerPhotos,
  identifyMatchesByEmbeddingLocal,
  searchPrisonersLocal,
  type PrisonerRow,
} from '@/src/services/database';
import type {
  BuscaFacialFoto,
  BuscaFacialMatch,
  PesquisarReeducandoBody,
} from '@/src/services/goiaspenAppApi';

function toMatch(
  prisoner: PrisonerRow,
  photos: Awaited<ReturnType<typeof getPrisonerPhotos>>,
  distance?: number
): BuscaFacialMatch {
  const fotosDetalhe: BuscaFacialFoto[] = photos
    .filter((photo) =>
      ['front', 'right_profile', 'left_profile'].includes(photo.photo_type)
    )
    .map((photo) => ({
      uri: photo.photo_uri,
      kind: photo.photo_type as BuscaFacialFoto['kind'],
    }));

  return {
    id: String(prisoner.id),
    nome: prisoner.name,
    nomeSocial: prisoner.social_name ?? undefined,
    mae: prisoner.mother_name ?? undefined,
    pai: prisoner.filiation ?? undefined,
    dataNascimento: prisoner.dob ?? undefined,
    cpf: prisoner.cpf ?? undefined,
    sexo: prisoner.sexo ?? undefined,
    rg: prisoner.rg ?? undefined,
    orgaoEmissor: prisoner.orgao_emissor ?? undefined,
    escolaridade: prisoner.education ?? undefined,
    profissao: prisoner.profession ?? undefined,
    estadoCivil: prisoner.marital_status ?? undefined,
    naturalidade: prisoner.birth_place ?? undefined,
    nacionalidade: prisoner.nationality ?? undefined,
    endereco: prisoner.address ?? undefined,
    telefone: prisoner.phone ?? undefined,
    email: prisoner.email ?? undefined,
    prontuario: prisoner.prontuario ?? undefined,
    fotoUrl:
      fotosDetalhe.find((photo) => photo.kind === 'front')?.uri ??
      prisoner.photo_uri ??
      undefined,
    fotos: fotosDetalhe.map((photo) => photo.uri),
    fotosDetalhe,
    distance,
  };
}

async function hydratePrisoner(
  prisoner: PrisonerRow,
  distance?: number
): Promise<BuscaFacialMatch> {
  return toMatch(prisoner, await getPrisonerPhotos(prisoner.id), distance);
}

export async function buscaFacialMatchesLocal(
  embedding: number[]
): Promise<BuscaFacialMatch[]> {
  const candidates = await identifyMatchesByEmbeddingLocal(embedding);
  const matches = await Promise.all(
    candidates.map(async (candidate) => {
      const prisoner = await getPrisonerById(candidate.preso_id);
      return prisoner
        ? hydratePrisoner(prisoner, candidate.distance)
        : null;
    })
  );
  return matches.filter((match): match is BuscaFacialMatch => match !== null);
}

export async function pesquisarReeducandosLocal(
  filter: PesquisarReeducandoBody
): Promise<BuscaFacialMatch[]> {
  const prisoners = await searchPrisonersLocal(filter);
  return Promise.all(prisoners.map((prisoner) => hydratePrisoner(prisoner)));
}
