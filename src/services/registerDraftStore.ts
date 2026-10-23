export type RegisterDraftStep = 'dados' | 'biometria' | 'fotos';

export type RegisterFormDraft = {
  nome: string;
  nomeSocial: string;
  sexo: string;
  mae: string;
  pai: string;
  dataNascimento: string;
  cpf: string;
  rg: string;
  orgaoEmissor: string;
  estadoCivil: string;
  naturalidade: string;
  endereco: string;
  telefone: string;
  grauInstrucao: string;
  profissao: string;
  nacionalidade: string;
  email: string;
  photoUri: string | null;
  localPrisonerId: number | null;
  step: RegisterDraftStep;
  prefillAppliedKey: string | null;
  goiaspenReeducandoId: string | null;
};

const emptyDraft = (): RegisterFormDraft => ({
  nome: '',
  nomeSocial: '',
  sexo: '',
  mae: '',
  pai: '',
  dataNascimento: '',
  cpf: '',
  rg: '',
  orgaoEmissor: '',
  estadoCivil: '',
  naturalidade: '',
  endereco: '',
  telefone: '',
  grauInstrucao: '',
  profissao: '',
  nacionalidade: '',
  email: '',
  photoUri: null,
  localPrisonerId: null,
  step: 'dados',
  prefillAppliedKey: null,
  goiaspenReeducandoId: null,
});

/** Rascunho em memória — sobrevive a remount da tela (ex.: volta da câmera). */
let draft: RegisterFormDraft | null = null;

export function getRegisterDraft(): RegisterFormDraft | null {
  return draft;
}

export function setRegisterDraft(next: RegisterFormDraft): void {
  draft = next;
}

export function clearRegisterDraft(): void {
  draft = null;
}

export function createEmptyRegisterDraft(): RegisterFormDraft {
  return emptyDraft();
}
