export type UpdatePrisonerStep = 'dados' | 'biometria';

export type UpdatePrisonerDraft = {
  nome: string;
  mae: string;
  cpf: string;
  prontuario: string;
  reeducandoId: string | null;
  photoUri: string | null;
  step: UpdatePrisonerStep;
};

const emptyDraft = (): UpdatePrisonerDraft => ({
  nome: '',
  mae: '',
  cpf: '',
  prontuario: '',
  reeducandoId: null,
  photoUri: null,
  step: 'dados',
});

let draft: UpdatePrisonerDraft | null = null;

export function getUpdatePrisonerDraft(): UpdatePrisonerDraft | null {
  return draft;
}

export function setUpdatePrisonerDraft(next: UpdatePrisonerDraft): void {
  draft = next;
}

export function clearUpdatePrisonerDraft(): void {
  draft = null;
}

export function createEmptyUpdatePrisonerDraft(): UpdatePrisonerDraft {
  return emptyDraft();
}
