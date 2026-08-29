import { ThemedText } from '@/components/themed-text';
import { isUnauthorizedError } from '@/src/auth/unauthorizedSession';
import { FormSectionCard } from '@/src/components/FormSectionCard';
import { SelectField } from '@/src/components/SelectField';
import {
  ESTADO_CIVIL_API_OPTIONS,
  GRAU_INSTRUCAO_OPTIONS,
  SEXO_OPTIONS,
} from '@/src/configs/cadastroOptions';
import { usePendingBiometrics } from '@/src/context/PendingBiometricsContext';
import {
  BUST_PHOTO_LABELS,
  type BustPhotoKind,
} from '@/src/features/photos/types';
import {
  addPrisoner,
  addActivity,
  deletePrisonerPhoto,
  getPrisonerById,
  getPrisonerPhotos,
  updatePrisoner,
  type PrisonerPhotoRow,
} from '@/src/services/database';
import { submitPreCadastroFromLocal } from '@/src/services/preCadastroMapper';
import {
  clearRegisterDraft,
  getRegisterDraft,
  setRegisterDraft,
  type RegisterFormDraft,
} from '@/src/services/registerDraftStore';
import { maskCpf, maskDateBr, toDobBr } from '@/src/utils/inputMasks';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type RegisterStep = 'dados' | 'biometria' | 'fotos';

type SectionId = 'identificacao' | 'documentos' | 'endereco' | 'social';

const BUST_KINDS: BustPhotoKind[] = ['front', 'right_profile', 'left_profile'];
type FotoTimelineStep = BustPhotoKind | 'marks';
const FOTO_TIMELINE: FotoTimelineStep[] = ['front', 'right_profile', 'left_profile', 'marks'];

function timelineLabel(step: FotoTimelineStep): string {
  if (step === 'marks') return 'Marcas';
  if (step === 'right_profile') return 'Perfil dir.';
  if (step === 'left_profile') return 'Perfil esq.';
  return BUST_PHOTO_LABELS[step];
}

function paramToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

const INPUT_PLACEHOLDER_COLOR = '#dddddd';

const REQUIRED_FIELD_LABELS = {
  nome: 'Nome Completo',
  sexo: 'Sexo',
  mae: 'Nome da Mãe',
  dataNascimento: 'Data de Nascimento',
  cpf: 'CPF',
} as const;

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { pending, clearPending } = usePendingBiometrics();
  const initialDraft = getRegisterDraft();

  const [step, setStep] = useState<RegisterStep>(initialDraft?.step ?? 'dados');
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(initialDraft?.photoUri ?? null);
  const [localPrisonerId, setLocalPrisonerId] = useState<number | null>(
    initialDraft?.localPrisonerId ?? null
  );
  const [detaineePhotos, setDetaineePhotos] = useState<PrisonerPhotoRow[]>([]);
  const [fotoTimelineStep, setFotoTimelineStep] = useState<FotoTimelineStep>('front');

  const [nome, setNome] = useState(initialDraft?.nome ?? '');
  const [nomeSocial, setNomeSocial] = useState(initialDraft?.nomeSocial ?? '');
  const [sexo, setSexo] = useState(initialDraft?.sexo ?? '');
  const [mae, setMae] = useState(initialDraft?.mae ?? '');
  const [pai, setPai] = useState(initialDraft?.pai ?? '');
  const [dataNascimento, setDataNascimento] = useState(initialDraft?.dataNascimento ?? '');
  const [cpf, setCpf] = useState(initialDraft?.cpf ?? '');
  const [rg, setRg] = useState(initialDraft?.rg ?? '');
  const [orgaoEmissor, setOrgaoEmissor] = useState(initialDraft?.orgaoEmissor ?? '');
  const [estadoCivil, setEstadoCivil] = useState(initialDraft?.estadoCivil ?? '');
  const [naturalidade, setNaturalidade] = useState(initialDraft?.naturalidade ?? '');
  const [endereco, setEndereco] = useState(initialDraft?.endereco ?? '');
  const [telefone, setTelefone] = useState(initialDraft?.telefone ?? '');
  const [grauInstrucao, setGrauInstrucao] = useState(initialDraft?.grauInstrucao ?? '');
  const [profissao, setProfissao] = useState(initialDraft?.profissao ?? '');

  /** Mantém rascunho em memória para não perder dados ao trocar etapa / remount. */
  useEffect(() => {
    const draft: RegisterFormDraft = {
      nome,
      nomeSocial,
      sexo,
      mae,
      pai,
      dataNascimento,
      cpf,
      rg,
      orgaoEmissor,
      estadoCivil,
      naturalidade,
      endereco,
      telefone,
      grauInstrucao,
      profissao,
      photoUri,
      localPrisonerId,
      step,
    };
    setRegisterDraft(draft);
  }, [
    nome,
    nomeSocial,
    sexo,
    mae,
    pai,
    dataNascimento,
    cpf,
    rg,
    orgaoEmissor,
    estadoCivil,
    naturalidade,
    endereco,
    telefone,
    grauInstrucao,
    profissao,
    photoUri,
    localPrisonerId,
    step,
  ]);

  useEffect(() => {
    if (params.photo) {
      setPhotoUri(params.photo as string);
      setStep('biometria');
    }
    const draftId = paramToString(params.draftPrisonerId as string | string[] | undefined);
    if (draftId) {
      const id = Number(draftId);
      if (Number.isFinite(id) && id > 0) {
        setLocalPrisonerId(id);
      }
    }
    const requestedStep = paramToString(params.step as string | string[] | undefined);
    if (requestedStep === 'fotos' || requestedStep === 'biometria' || requestedStep === 'dados') {
      setStep(requestedStep);
    }
    const savedKind = paramToString(params.photoSaved as string | string[] | undefined);
    if (savedKind === 'front' || savedKind === 'right_profile' || savedKind === 'left_profile') {
      setFotoTimelineStep(savedKind);
    } else if (savedKind === 'mark' || savedKind === 'tattoo') {
      setFotoTimelineStep('marks');
    }
  }, [params.photo, params.draftPrisonerId, params.step, params.photoSaved]);

  const reloadDetaineePhotos = useCallback(async (prisonerId: number) => {
    try {
      const rows = await getPrisonerPhotos(prisonerId);
      setDetaineePhotos(rows);
    } catch (error) {
      console.warn('Falha ao carregar fotos do detento:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (localPrisonerId != null) {
        void reloadDetaineePhotos(localPrisonerId);
      }
    }, [localPrisonerId, reloadDetaineePhotos])
  );

  /** Rehidrata o form a partir do rascunho SQLite (volta da câmera remonta a tela). */
  const applyPrisonerRowToForm = useCallback((row: NonNullable<Awaited<ReturnType<typeof getPrisonerById>>>) => {
    if (row.name) setNome(row.name);
    if (row.social_name) setNomeSocial(row.social_name);
    if (row.sexo) setSexo(row.sexo);
    if (row.mother_name) setMae(row.mother_name);
    if (row.filiation) setPai(row.filiation);
    if (row.dob) {
      try {
        setDataNascimento(toDobBr(row.dob));
      } catch {
        setDataNascimento(maskDateBr(row.dob));
      }
    }
    if (row.cpf) setCpf(maskCpf(row.cpf));
    if (row.rg) setRg(row.rg);
    if (row.orgao_emissor) setOrgaoEmissor(row.orgao_emissor);
    if (row.marital_status) setEstadoCivil(row.marital_status);
    if (row.birth_place) setNaturalidade(row.birth_place);
    if (row.address) setEndereco(row.address);
    if (row.phone) setTelefone(row.phone);
    if (row.education) setGrauInstrucao(row.education);
    if (row.profession) setProfissao(row.profession);
    if (row.photo_uri) setPhotoUri(row.photo_uri);
  }, []);

  useEffect(() => {
    if (localPrisonerId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await getPrisonerById(localPrisonerId);
        if (!row || cancelled) return;
        applyPrisonerRowToForm(row);
      } catch (error) {
        console.warn('Falha ao rehidratar rascunho:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localPrisonerId, applyPrisonerRowToForm]);

  useEffect(() => {
    const prefillName = paramToString(params.prefillName as string | string[] | undefined);
    const prefillMotherName = paramToString(params.prefillMotherName as string | string[] | undefined);
    const prefillDob = paramToString(params.prefillDob as string | string[] | undefined);
    const prefillCpf = paramToString(params.prefillCpf as string | string[] | undefined);
    const prefillSource = paramToString(params.prefillSource as string | string[] | undefined);
    const prefillSocialName = paramToString(params.prefillSocialName as string | string[] | undefined);
    const prefillNationality = paramToString(params.prefillNationality as string | string[] | undefined);
    const prefillMaritalStatus = paramToString(params.prefillMaritalStatus as string | string[] | undefined);
    const prefillProfession = paramToString(params.prefillProfession as string | string[] | undefined);
    const prefillEducation = paramToString(params.prefillEducation as string | string[] | undefined);
    const prefillFiliation = paramToString(params.prefillFiliation as string | string[] | undefined);
    const prefillAddress = paramToString(params.prefillAddress as string | string[] | undefined);
    const prefillPhone = paramToString(params.prefillPhone as string | string[] | undefined);
    const prefillEmail = paramToString(params.prefillEmail as string | string[] | undefined);

    const hasAny = Boolean(
      prefillName ||
        prefillMotherName ||
        prefillDob ||
        prefillCpf ||
        prefillSocialName ||
        prefillNationality ||
        prefillMaritalStatus ||
        prefillProfession ||
        prefillEducation ||
        prefillFiliation ||
        prefillAddress ||
        prefillPhone ||
        prefillEmail
    );
    if (!hasAny) return;

    if (prefillName) setNome(prefillName);
    if (prefillMotherName) setMae(prefillMotherName);
    if (prefillDob) {
      try {
        setDataNascimento(toDobBr(prefillDob));
      } catch {
        setDataNascimento(maskDateBr(prefillDob));
      }
    }
    if (prefillCpf) setCpf(maskCpf(prefillCpf));
    if (prefillSocialName) setNomeSocial(prefillSocialName);
    if (prefillNationality) setNaturalidade(prefillNationality);
    if (prefillMaritalStatus) setEstadoCivil(prefillMaritalStatus);
    if (prefillProfession) setProfissao(prefillProfession);
    if (prefillEducation) setGrauInstrucao(prefillEducation);
    if (prefillFiliation) setPai(prefillFiliation);
    if (prefillAddress) setEndereco(prefillAddress);
    if (prefillPhone) setTelefone(prefillPhone);

    if (prefillSource === 'face') {
      Alert.alert('Dados preenchidos', 'Dados preenchidos pela pesquisa facial.');
    } else if (prefillSource === 'document') {
      Alert.alert('Dados preenchidos', 'Dados encontrados no documento e preenchidos automaticamente.');
    }
  }, [
    params.prefillName,
    params.prefillMotherName,
    params.prefillDob,
    params.prefillCpf,
    params.prefillSource,
    params.prefillSocialName,
    params.prefillNationality,
    params.prefillMaritalStatus,
    params.prefillProfession,
    params.prefillEducation,
    params.prefillFiliation,
    params.prefillAddress,
    params.prefillPhone,
    params.prefillEmail,
  ]);

  const canSaveBiometria = Boolean(pending && pending.photoUri === photoUri && photoUri);

  const getMissingRequiredFields = (): string[] => {
    const missing: string[] = [];
    if (!nome.trim()) missing.push(REQUIRED_FIELD_LABELS.nome);
    if (!sexo) missing.push(REQUIRED_FIELD_LABELS.sexo);
    if (!mae.trim()) missing.push(REQUIRED_FIELD_LABELS.mae);
    if (dataNascimento.length !== 10) missing.push(REQUIRED_FIELD_LABELS.dataNascimento);
    if (cpf.length !== 14) missing.push(REQUIRED_FIELD_LABELS.cpf);
    return missing;
  };

  const isDadosComplete = getMissingRequiredFields().length === 0;

  const openSectionForMissingFields = (missing: string[]) => {
    if (
      missing.includes(REQUIRED_FIELD_LABELS.nome) ||
      missing.includes(REQUIRED_FIELD_LABELS.sexo) ||
      missing.includes(REQUIRED_FIELD_LABELS.mae) ||
      missing.includes(REQUIRED_FIELD_LABELS.dataNascimento)
    ) {
      setOpenSection('identificacao');
      return;
    }
    if (missing.includes(REQUIRED_FIELD_LABELS.cpf)) {
      setOpenSection('documentos');
    }
  };

  const toggleSection = (id: SectionId) => {
    setOpenSection((current) => (current === id ? null : id));
  };

  const goBackToDados = useCallback(async () => {
    // Só rehidrata do SQLite se o form em memória estiver vazio (ex.: remount).
    const formEmpty = !nome.trim() && !mae.trim() && !cpf.trim() && !sexo;
    if (formEmpty && localPrisonerId != null) {
      try {
        const row = await getPrisonerById(localPrisonerId);
        if (row) applyPrisonerRowToForm(row);
      } catch (error) {
        console.warn('Falha ao restaurar dados ao voltar:', error);
      }
    }
    setOpenSection('identificacao');
    setStep('dados');
  }, [localPrisonerId, applyPrisonerRowToForm, nome, mae, cpf, sexo]);

  const buildLocalFields = () => ({
    name: nome.trim(),
    motherName: mae.trim(),
    dob: dataNascimento,
    cpf: cpf.trim(),
    socialName: nomeSocial.trim() || undefined,
    maritalStatus: estadoCivil || undefined,
    filiation: pai.trim() || undefined,
    profession: profissao.trim() || undefined,
    education: grauInstrucao || undefined,
    birthPlace: naturalidade.trim() || undefined,
    address: endereco.trim() || undefined,
    phone: telefone.trim() || undefined,
    sexo: sexo || undefined,
    rg: rg.trim() || undefined,
    orgaoEmissor: orgaoEmissor.trim() || undefined,
  });

  const goToBiometria = async () => {
    if (isSubmitting) return;
    const missing = getMissingRequiredFields();
    if (missing.length > 0) {
      const message =
        missing.length === 1
          ? `Falta preencher: ${missing[0]}.`
          : `Faltam preencher:\n• ${missing.join('\n• ')}`;
      Alert.alert('Campos obrigatórios', message);
      openSectionForMissingFields(missing);
      return;
    }
    try {
      toDobBr(dataNascimento);
    } catch (error) {
      Alert.alert('Data inválida', error instanceof Error ? error.message : 'Data inválida.');
      setOpenSection('identificacao');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Salvando dados localmente...');
    try {
      const fields = buildLocalFields();
      if (localPrisonerId != null) {
        await updatePrisoner(localPrisonerId, fields);
      } else {
        const id = await addPrisoner(
          fields.name,
          fields.motherName,
          fields.dob,
          fields.cpf,
          '',
          undefined,
          {
            socialName: fields.socialName,
            maritalStatus: fields.maritalStatus,
            filiation: fields.filiation,
            profession: fields.profession,
            education: fields.education,
            birthPlace: fields.birthPlace,
            address: fields.address,
            phone: fields.phone,
            sexo: fields.sexo,
            rg: fields.rg,
            orgaoEmissor: fields.orgaoEmissor,
          }
        );
        setLocalPrisonerId(Number(id));
      }
      setStep('biometria');
    } catch (error) {
      console.error('[CADASTRO] Falha ao salvar dados:', error);
      if (isUnauthorizedError(error)) return;
      Alert.alert('Erro ao salvar', error instanceof Error ? error.message : 'Falha no cadastro local.');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const takePhoto = () => {
    router.push({
      pathname: '/capture',
      params: {
        mode: 'register',
        draftPrisonerId: localPrisonerId != null ? String(localPrisonerId) : '',
        prefillName: nome,
        prefillMotherName: mae,
        prefillDob: dataNascimento,
        prefillCpf: cpf,
        prefillSocialName: nomeSocial,
        prefillNationality: naturalidade,
        prefillMaritalStatus: estadoCivil,
        prefillProfession: profissao,
        prefillEducation: grauInstrucao,
        prefillFiliation: pai,
        prefillAddress: endereco,
        prefillPhone: telefone,
      },
    });
  };

  const handleFacePrefill = () => {
    router.push({ pathname: '/capture', params: { mode: 'prefill' } });
  };

  const handleDocumentScan = () => {
    router.push('/document-scan');
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    if (!canSaveBiometria || !pending || !photoUri) {
      Alert.alert(
        'Biometria obrigatória',
        'Tire a foto do rosto e aguarde a validação da face antes de salvar.'
      );
      return;
    }

    const draftFromParams = Number(
      paramToString(params.draftPrisonerId as string | string[] | undefined)
    );
    const prisonerId =
      localPrisonerId ??
      (Number.isFinite(draftFromParams) && draftFromParams > 0 ? draftFromParams : null);

    setIsSubmitting(true);
    setStatusMessage('Salvando biometria localmente...');
    try {
      const embeddingJson = JSON.stringify(pending.embedding);
      let savedId = prisonerId;

      if (prisonerId != null) {
        // Dados já foram salvos antes da captura; só anexa foto + embedding
        // (o estado do form pode ter sido perdido no remount ao voltar da câmera)
        await updatePrisoner(prisonerId, {
          photoUri,
          faceEmbeddingJson: embeddingJson,
        });
        savedId = prisonerId;
      } else if (isDadosComplete) {
        const fields = buildLocalFields();
        const id = await addPrisoner(
          fields.name,
          fields.motherName,
          fields.dob,
          fields.cpf,
          photoUri,
          embeddingJson,
          {
            socialName: fields.socialName,
            maritalStatus: fields.maritalStatus,
            filiation: fields.filiation,
            profession: fields.profession,
            education: fields.education,
            birthPlace: fields.birthPlace,
            address: fields.address,
            phone: fields.phone,
            sexo: fields.sexo,
            rg: fields.rg,
            orgaoEmissor: fields.orgaoEmissor,
          }
        );
        savedId = Number(id);
      } else {
        Alert.alert(
          'Dados pendentes',
          'Salve os dados do cadastro antes de continuar.'
        );
        setStep('dados');
        return;
      }

      setLocalPrisonerId(savedId);
      clearPending();
      setStep('fotos');
      if (savedId != null) void reloadDetaineePhotos(savedId);
    } catch (error) {
      console.error('[CADASTRO] Falha ao salvar biometria:', error);
      if (isUnauthorizedError(error)) return;
      Alert.alert('Erro na biometria', error instanceof Error ? error.message : 'Falha ao salvar biometria.');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const getBustPhoto = (kind: BustPhotoKind) =>
    detaineePhotos.find((p) => p.photo_type === kind) ?? null;

  const markPhotos = detaineePhotos.filter(
    (p) => p.photo_type === 'mark' || p.photo_type === 'tattoo'
  );

  const requiredPhotosOk = BUST_KINDS.every((kind) => Boolean(getBustPhoto(kind)));

  const openBustCapture = (kind: BustPhotoKind) => {
    if (localPrisonerId == null) {
      Alert.alert('Cadastro pendente', 'Salve a biometria antes de capturar as fotos.');
      setStep('biometria');
      return;
    }
    router.push({
      pathname: '/bust-capture',
      params: {
        kind,
        draftPrisonerId: String(localPrisonerId),
      },
    });
  };

  const openMarkCapture = () => {
    if (localPrisonerId == null) {
      Alert.alert('Cadastro pendente', 'Salve a biometria antes de capturar as fotos.');
      setStep('biometria');
      return;
    }
    router.push({
      pathname: '/mark-capture',
      params: { draftPrisonerId: String(localPrisonerId) },
    });
  };

  const removeMarkPhoto = (photoId: number) => {
    Alert.alert('Remover foto', 'Deseja remover esta marca/tatuagem?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deletePrisonerPhoto(photoId);
          if (localPrisonerId != null) await reloadDetaineePhotos(localPrisonerId);
        },
      },
    ]);
  };

  const finishCadastro = async () => {
    if (isSubmitting) return;
    if (!requiredPhotosOk) {
      Alert.alert(
        'Fotos obrigatórias',
        'Capture frente, perfil direito e perfil esquerdo antes de concluir.'
      );
      return;
    }
    if (localPrisonerId == null) {
      Alert.alert('Cadastro pendente', 'Salve a biometria antes de concluir.');
      setStep('biometria');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Preparando pré-cadastro...');
    try {
      const row = await getPrisonerById(localPrisonerId);
      if (!row) throw new Error('Rascunho local não encontrado.');

      // Atualiza rascunho só se o form ainda tiver os obrigatórios (evita wipe após remount)
      if (isDadosComplete) {
        await updatePrisoner(localPrisonerId, buildLocalFields());
      }
      const prisoner = (await getPrisonerById(localPrisonerId)) ?? row;
      const photos = await getPrisonerPhotos(localPrisonerId);

      await submitPreCadastroFromLocal({
        prisoner,
        photos,
        onProgress: setStatusMessage,
      });

      const prisonerName = nome.trim() || prisoner.name?.trim() || undefined;
      await addActivity({
        type: 'register',
        prisonerId: localPrisonerId,
        prisonerName,
      });

      Alert.alert('Sucesso', 'Pré-cadastro enviado com sucesso.', [
        {
          text: 'OK',
          onPress: () => {
            clearRegisterDraft();
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (error) {
      console.error('[CADASTRO] Falha no pré-cadastro:', error);
      if (isUnauthorizedError(error)) return;
      Alert.alert(
        'Erro no pré-cadastro',
        'Não foi possível enviar o pré-cadastro. O rascunho local foi mantido. Veja o detalhe no terminal.'
      );
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const goToFotos = () => {
    if (localPrisonerId == null && !canSaveBiometria) {
      Alert.alert('Biometria pendente', 'Salve a biometria facial antes de continuar.');
      setStep('biometria');
      return;
    }
    if (canSaveBiometria) {
      void handleSave();
      return;
    }
    setStep('fotos');
  };

  const renderTabs = () => (
    <View style={styles.tabs}>
      <TouchableOpacity
        style={[styles.tabButton, step === 'dados' && styles.tabButtonActive]}
        onPress={() => {
          void goBackToDados();
        }}
      >
        <Text style={[styles.tabButtonText, step === 'dados' && styles.tabButtonTextActive]}>
          1. Dados
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, step === 'biometria' && styles.tabButtonActive]}
        onPress={goToBiometria}
      >
        <Text style={[styles.tabButtonText, step === 'biometria' && styles.tabButtonTextActive]}>
          2. Biometria
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, step === 'fotos' && styles.tabButtonActive]}
        onPress={goToFotos}
      >
        <Text style={[styles.tabButtonText, step === 'fotos' && styles.tabButtonTextActive]}>
          3. Fotos
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    step === 'fotos' ? (
      <View style={styles.fotosScreen}>
        <ScrollView
          style={styles.fotosScroll}
          contentContainerStyle={styles.fotosScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderTabs()}

          <View style={styles.fotosStep}>
            <View style={styles.timeline}>
              {FOTO_TIMELINE.map((item, index) => {
                const done =
                  item === 'marks' ? markPhotos.length > 0 : Boolean(getBustPhoto(item));
                const active = fotoTimelineStep === item;
                const isLast = index === FOTO_TIMELINE.length - 1;
                return (
                  <React.Fragment key={item}>
                    <TouchableOpacity
                      style={styles.timelineItem}
                      onPress={() => setFotoTimelineStep(item)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.timelineDot,
                          done && styles.timelineDotDone,
                          active && styles.timelineDotActive,
                        ]}
                      >
                        {done ? (
                          <Ionicons name="checkmark" size={12} color="#64748B" />
                        ) : (
                          <Text style={styles.timelineDotText}>{index + 1}</Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.timelineLabel,
                          active && styles.timelineLabelActive,
                          done && styles.timelineLabelDone,
                        ]}
                        numberOfLines={1}
                      >
                        {timelineLabel(item)}
                      </Text>
                    </TouchableOpacity>
                    {!isLast ? (
                      <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

            {fotoTimelineStep !== 'marks' ? (
              <View style={styles.timelineStage}>
                <Text style={styles.timelineStageTitle}>{BUST_PHOTO_LABELS[fotoTimelineStep]}</Text>
                {getBustPhoto(fotoTimelineStep) ? (
                  <Image
                    source={{ uri: getBustPhoto(fotoTimelineStep)!.photo_uri }}
                    style={styles.timelineFullPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.timelineFullPlaceholder}>
                    <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.timelinePlaceholderText}>Nenhuma foto ainda</Text>
                  </View>
                )}
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={[styles.photoBtn, styles.photoActionHalf, styles.photoBtnWide]}
                    onPress={() => openBustCapture(fotoTimelineStep)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.photoBtnText}>
                      {getBustPhoto(fotoTimelineStep) ? 'Refazer foto' : 'Tirar foto'}
                    </Text>
                  </TouchableOpacity>
                  {getBustPhoto(fotoTimelineStep) ? (
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.photoActionHalf]}
                      onPress={() => {
                        const idx = FOTO_TIMELINE.indexOf(fotoTimelineStep);
                        const next = FOTO_TIMELINE[Math.min(idx + 1, FOTO_TIMELINE.length - 1)];
                        setFotoTimelineStep(next);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Próximo</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.timelineStage}>
                <Text style={styles.timelineStageTitle}>Marcas e tatuagens</Text>
                <Text style={styles.markHint}>
                  Opcional — tipo de sinal, parte do corpo e observação (API).
                </Text>

                {markPhotos.length > 0 ? (
                  <Image
                    source={{ uri: markPhotos[markPhotos.length - 1].photo_uri }}
                    style={styles.timelineFullPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.timelineFullPlaceholder}>
                    <Ionicons name="body-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.timelinePlaceholderText}>Nenhuma marca adicionada</Text>
                  </View>
                )}

                {markPhotos.map((photo) => (
                  <View key={photo.id} style={styles.markRow}>
                    <Image source={{ uri: photo.photo_uri }} style={styles.markThumb} />
                    <View style={styles.markInfo}>
                      <Text style={styles.markTitle}>
                        {photo.photo_type === 'tattoo' ? 'Tatuagem' : 'Marca'}
                        {photo.sinal ? ` · sinal ${photo.sinal}` : ''}
                      </Text>
                      <Text style={styles.markMeta}>
                        {photo.parte_corpo ? `Parte ${photo.parte_corpo}` : 'Sem parte do corpo'}
                        {photo.observacao ? ` · ${photo.observacao}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMarkPhoto(photo.id)}>
                      <Ionicons name="trash-outline" size={22} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.photoBtn, styles.photoBtnWide]}
                  onPress={openMarkCapture}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoBtnText}>Adicionar marca/tatuagem</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.fotosFooter}>
          {statusMessage ? <Text style={styles.statusHint}>{statusMessage}</Text> : null}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.fotosFooterBtn,
              (!requiredPhotosOk || isSubmitting) && styles.primaryButtonDisabled,
            ]}
            onPress={finishCadastro}
            disabled={!requiredPhotosOk || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  !requiredPhotosOk && styles.primaryButtonTextDisabled,
                ]}
              >
                Enviar pré-cadastro
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    ) : step === 'dados' ? (
      <View style={styles.fixedScreen}>
        <ScrollView
          style={styles.fixedScroll}
          contentContainerStyle={styles.fixedScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderTabs()}

          <View style={styles.form}>
            <View style={styles.topActions}>
              <TouchableOpacity
                style={[styles.topActionButton, styles.topActionButtonSecondary]}
                onPress={handleFacePrefill}
                accessibilityLabel="Pesquisar por biometria facial"
              >
                <Ionicons name="scan" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topActionButton}
                onPress={handleDocumentScan}
                accessibilityLabel="Ler documento"
              >
                <Ionicons name="document-text" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FormSectionCard
              title="Identificação"
              subtitle="Nome, filiação e nascimento"
              icon="person-outline"
              open={openSection === 'identificacao'}
              onToggle={() => toggleSection('identificacao')}
              requiredHint
            >
              <ThemedText type="defaultSemiBold">Nome Completo *</ThemedText>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">Nome Social</ThemedText>
              <TextInput
                style={styles.input}
                value={nomeSocial}
                onChangeText={setNomeSocial}
                placeholder="Nome social (se houver)"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <SelectField
                label="Sexo *"
                value={sexo}
                options={SEXO_OPTIONS}
                onChange={setSexo}
                allowEmpty={false}
              />

              <ThemedText type="defaultSemiBold">Nome da Mãe *</ThemedText>
              <TextInput
                style={styles.input}
                value={mae}
                onChangeText={setMae}
                placeholder="Nome da mãe"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">Nome do Pai</ThemedText>
              <TextInput
                style={styles.input}
                value={pai}
                onChangeText={setPai}
                placeholder="Nome do pai"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">Data de Nascimento *</ThemedText>
              <TextInput
                style={styles.input}
                value={dataNascimento}
                onChangeText={(text) => setDataNascimento(maskDateBr(text))}
                placeholder="DD/MM/YYYY"
                keyboardType="number-pad"
                maxLength={10}
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">Naturalidade</ThemedText>
              <TextInput
                style={styles.input}
                value={naturalidade}
                onChangeText={setNaturalidade}
                placeholder="Ex: GOIANIA-GO"
                autoCapitalize="characters"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <SelectField
                label="Estado Civil"
                value={estadoCivil}
                options={ESTADO_CIVIL_API_OPTIONS}
                onChange={setEstadoCivil}
              />
            </FormSectionCard>

            <FormSectionCard
              title="Documentos"
              subtitle="CPF, RG e órgão emissor"
              icon="id-card-outline"
              open={openSection === 'documentos'}
              onToggle={() => toggleSection('documentos')}
              requiredHint
            >
              <ThemedText type="defaultSemiBold">CPF *</ThemedText>
              <TextInput
                style={styles.input}
                value={cpf}
                onChangeText={(text) => setCpf(maskCpf(text))}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">RG</ThemedText>
              <TextInput
                style={styles.input}
                value={rg}
                onChangeText={setRg}
                placeholder="RG"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">Órgão Emissor</ThemedText>
              <TextInput
                style={styles.input}
                value={orgaoEmissor}
                onChangeText={setOrgaoEmissor}
                placeholder="Ex: SSP-GO"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />
            </FormSectionCard>

            <FormSectionCard
              title="Endereço e contato"
              subtitle="Logradouro e telefone"
              icon="home-outline"
              open={openSection === 'endereco'}
              onToggle={() => toggleSection('endereco')}
            >
              <ThemedText type="defaultSemiBold">Endereço</ThemedText>
              <TextInput
                style={styles.input}
                value={endereco}
                onChangeText={setEndereco}
                placeholder="Logradouro e número"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />

              <ThemedText type="defaultSemiBold">Telefone</ThemedText>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                placeholder="62999999999"
                keyboardType="phone-pad"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />
            </FormSectionCard>

            <FormSectionCard
              title="Social"
              subtitle="Escolaridade e profissão"
              icon="school-outline"
              open={openSection === 'social'}
              onToggle={() => toggleSection('social')}
            >
              <SelectField
                label="Escolaridade"
                value={grauInstrucao}
                options={GRAU_INSTRUCAO_OPTIONS}
                onChange={setGrauInstrucao}
              />

              <ThemedText type="defaultSemiBold">Profissão</ThemedText>
              <TextInput
                style={styles.input}
                value={profissao}
                onChangeText={setProfissao}
                placeholder="Profissão"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              />
            </FormSectionCard>
          </View>
        </ScrollView>

        <View style={styles.fixedFooter}>
          {statusMessage ? <Text style={styles.statusHint}>{statusMessage}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryButton, styles.fixedFooterBtn, isSubmitting && styles.primaryButtonDisabled]}
            onPress={goToBiometria}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Salvar e ir para biometria</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      <ScrollView
        contentContainerStyle={[styles.container, styles.containerBiometry]}
        keyboardShouldPersistTaps="handled"
      >
        {renderTabs()}

        <View style={styles.biometryStepWrapper}>
          <View style={styles.biometryCenter}>
            <View style={styles.photoContainer}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={50} color="#ccc" />
                  <Text style={{ color: '#666' }}>Sem Foto</Text>
                </View>
              )}
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={24} color="#374151" />
                <Text style={styles.photoBtnText}>Tirar Foto</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.biometryBottom}>
            {isSubmitting ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="large" color="#0D9488" />
                <Text style={{ color: '#666' }}>{statusMessage}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void goBackToDados();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>Voltar para dados</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, !canSaveBiometria && styles.primaryButtonDisabled]}
                  onPress={handleSave}
                  disabled={!canSaveBiometria}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      !canSaveBiometria && styles.primaryButtonTextDisabled,
                    ]}
                  >
                    Salvar biometria e avançar
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F2F2F7',
    flexGrow: 1,
  },
  containerBiometry: {
    flexGrow: 1,
    minHeight: Dimensions.get('window').height - 120,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  tabButtonActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  tabButtonText: {
    textAlign: 'center',
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  biometryStepWrapper: {
    flex: 1,
  },
  biometryCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
  },
  biometryBottom: {
    marginTop: 24,
    paddingBottom: 8,
    gap: 10,
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 10,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  photoBtn: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoBtnWide: {
    paddingVertical: 14,
    borderRadius: 12,
  },
  photoBtnText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 15,
  },
  form: {
    gap: 12,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 4,
  },
  topActionButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActionButtonSecondary: {
    backgroundColor: '#7C3AED',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonTextDisabled: {
    color: 'rgba(255,255,255,0.6)',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  statusHint: {
    marginBottom: 8,
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
  fotosStep: {
    gap: 14,
  },
  fixedScreen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  fixedScroll: {
    flex: 1,
  },
  fixedScrollContent: {
    padding: 20,
    paddingBottom: 16,
  },
  fixedFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  fixedFooterBtn: {
    marginTop: 0,
  },
  fotosScreen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  fotosScroll: {
    flex: 1,
  },
  fotosScrollContent: {
    padding: 20,
    paddingBottom: 16,
  },
  fotosFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  fotosFooterBtn: {
    marginTop: 0,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  timelineDotDone: {
    backgroundColor: '#F1F5F9',
    borderColor: '#94A3B8',
  },
  timelineDotActive: {
    backgroundColor: '#fff',
    borderColor: '#64748B',
    borderWidth: 2,
  },
  timelineDotText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 11,
  },
  timelineLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  timelineLabelActive: {
    color: '#334155',
    fontWeight: '700',
  },
  timelineLabelDone: {
    color: '#64748B',
  },
  timelineLine: {
    width: 16,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 12,
    borderRadius: 1,
    flexShrink: 0,
  },
  timelineLineDone: {
    backgroundColor: '#CBD5E1',
  },
  timelineStage: {
    gap: 10,
  },
  timelineStageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  timelineFullPhoto: {
    width: '100%',
    height: Dimensions.get('window').height * 0.52,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  timelineFullPlaceholder: {
    width: '100%',
    height: Dimensions.get('window').height * 0.42,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timelinePlaceholderText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  photoCardBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  photoCardBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  retakeBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoActionHalf: {
    flex: 1,
    marginTop: 0,
    alignSelf: 'stretch',
  },
  markHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  markThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  markInfo: {
    flex: 1,
  },
  markTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  markMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
