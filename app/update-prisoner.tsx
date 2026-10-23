import { isUnauthorizedError } from '@/src/auth/unauthorizedSession';
import { USE_LOCAL_DATABASE } from '@/src/configs/runtimeConfig';
import { usePendingBiometrics } from '@/src/context/PendingBiometricsContext';
import { updatePrisoner } from '@/src/services/database';
import { atualizaBiometriaFacial, pesquisarReeducandos, type BuscaFacialMatch } from '@/src/services/goiaspenAppApi';
import { getIdentifyMatch, setFacialSearchPurpose, setIdentifyMatch, setIdentifyMatchList } from '@/src/services/identifyMatchStore';
import { persistLocalImage } from '@/src/services/localImageStorage';
import { pesquisarReeducandosLocal } from '@/src/services/localPrisonerApi';
import {
  clearUpdatePrisonerDraft,
  getUpdatePrisonerDraft,
  setUpdatePrisonerDraft,
} from '@/src/services/updatePrisonerDraft';
import { maskCpf, onlyDigits } from '@/src/utils/inputMasks';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

const INPUT_PLACEHOLDER_COLOR = '#dddddd';

function paramToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function applyMatchToFields(match: BuscaFacialMatch) {
  return {
    nome: match.nome ?? '',
    mae: match.mae ?? '',
    cpf: match.cpf ? maskCpf(match.cpf) : '',
    prontuario: match.prontuario ?? '',
    reeducandoId: match.id,
  };
}

export default function UpdatePrisonerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { pending, clearPending } = usePendingBiometrics();
  const initialDraft = getUpdatePrisonerDraft();

  const incomingMatch =
    paramToString(params.prefillSource as string | string[] | undefined) === 'face' ||
    Boolean(paramToString(params.prefillMatchId as string | string[] | undefined));
  const [step, setStep] = useState<'dados' | 'biometria'>(
    incomingMatch ? 'dados' : (initialDraft?.step ?? 'dados')
  );
  const [nome, setNome] = useState(initialDraft?.nome ?? '');
  const [mae, setMae] = useState(initialDraft?.mae ?? '');
  const [cpf, setCpf] = useState(initialDraft?.cpf ?? '');
  const [prontuario, setProntuario] = useState(initialDraft?.prontuario ?? '');
  const [reeducandoId, setReeducandoId] = useState<string | null>(initialDraft?.reeducandoId ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(initialDraft?.photoUri ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [prefillAppliedKey, setPrefillAppliedKey] = useState<string | null>(null);

  const canSaveBiometria = Boolean(pending && pending.photoUri === photoUri && photoUri);
  const canGoToBiometria = Boolean(reeducandoId);

  useEffect(() => {
    setUpdatePrisonerDraft({
      nome,
      mae,
      cpf,
      prontuario,
      reeducandoId,
      photoUri,
      step,
    });
  }, [nome, mae, cpf, prontuario, reeducandoId, photoUri, step]);

  useEffect(() => {
    const photo = paramToString(params.photo as string | string[] | undefined);
    if (!photo) return;
    setPhotoUri(photo);
    const selectingMatch = paramToString(params.prefillMatchId as string | string[] | undefined);
    if (!selectingMatch) setStep('biometria');
  }, [params.photo, params.prefillMatchId]);

  useEffect(() => {
    const source = paramToString(params.prefillSource as string | string[] | undefined);
    const matchId = paramToString(params.prefillMatchId as string | string[] | undefined);
    if (source !== 'face' && !matchId) return;
    const key = matchId || `face:${paramToString(params.prefillCpf as string | string[] | undefined)}`;
    if (prefillAppliedKey === key) return;

    const stored = getIdentifyMatch(matchId || undefined) ?? getIdentifyMatch();
    const nextNome = stored?.prisoner.name ?? paramToString(params.prefillName as string | string[] | undefined);
    const nextMae =
      stored?.prisoner.mother_name ?? paramToString(params.prefillMotherName as string | string[] | undefined);
    const nextCpf = stored?.prisoner.cpf ?? paramToString(params.prefillCpf as string | string[] | undefined);
    const nextProntuario = paramToString(params.prefillProntuario as string | string[] | undefined);
    const nextId = stored?.reeducandoId || matchId;

    if (nextNome) setNome(nextNome);
    if (nextMae) setMae(nextMae);
    if (nextCpf) setCpf(maskCpf(nextCpf));
    if (nextProntuario) setProntuario(nextProntuario);
    if (nextId) setReeducandoId(nextId);
    setPrefillAppliedKey(key);
    setStep('dados');
  }, [
    params.prefillSource,
    params.prefillMatchId,
    params.prefillName,
    params.prefillMotherName,
    params.prefillCpf,
    params.prefillProntuario,
    prefillAppliedKey,
  ]);

  const selectMatch = (match: BuscaFacialMatch) => {
    setIdentifyMatch(match);
    const fields = applyMatchToFields(match);
    setNome(fields.nome);
    setMae(fields.mae);
    setCpf(fields.cpf);
    setProntuario(fields.prontuario);
    setReeducandoId(fields.reeducandoId);
    setStep('dados');
  };

  const searchByData = async () => {
    const cpfDigits = onlyDigits(cpf);
    const prontuarioDigits = onlyDigits(prontuario);
    const body: { prontuario?: number; nome?: string; mae?: string; cpf?: string } = {};
    if (prontuarioDigits) body.prontuario = Number(prontuarioDigits);
    if (nome.trim()) body.nome = nome.trim().toUpperCase();
    if (mae.trim()) body.mae = mae.trim().toUpperCase();
    if (cpfDigits) body.cpf = cpfDigits;

    if (Object.keys(body).length === 0) {
      Alert.alert('Pesquisa', 'Preencha ao menos um campo para pesquisar o preso.');
      return;
    }

    setIsSearching(true);
    try {
      const found = USE_LOCAL_DATABASE
        ? await pesquisarReeducandosLocal(body)
        : await pesquisarReeducandos(body);
      if (found.length === 0) {
        setReeducandoId(null);
        Alert.alert('Nenhum preso encontrado', 'Nenhum reeducando corresponde aos dados informados.');
        return;
      }
      if (found.length === 1) {
        selectMatch(found[0]);
        Alert.alert('Preso encontrado', 'Os dados foram preenchidos. Avance para atualizar a biometria facial.');
        return;
      }
      setFacialSearchPurpose('update');
      setIdentifyMatchList(found);
      router.push({ pathname: '/identify-matches', params: { origin: 'data' } });
    } catch (error) {
      if (isUnauthorizedError(error)) return;
      Alert.alert(
        'Erro na pesquisa',
        error instanceof Error ? error.message : 'Não foi possível pesquisar o preso.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const goToBiometria = () => {
    if (!canGoToBiometria) {
      Alert.alert(
        'Preso não selecionado',
        'Pesquise e selecione o preso pela biometria ou pelos dados antes de atualizar.'
      );
      return;
    }
    setStep('biometria');
  };

  const takePhoto = () => {
    router.push({
      pathname: '/capture',
      params: { mode: 'update-photo' },
    });
  };

  const handleUpdateBiometria = async () => {
    if (!canSaveBiometria || !pending || !reeducandoId) {
      Alert.alert('Biometria obrigatória', 'Tire a foto do rosto e aguarde a validação da face.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage('Atualizando biometria facial...');
    try {
      if (USE_LOCAL_DATABASE) {
        const localId = Number(reeducandoId);
        if (!Number.isFinite(localId)) throw new Error('ID local inválido.');
        const persistedPhoto = await persistLocalImage(
          pending.photoUri,
          localId,
          'biometria'
        );
        await updatePrisoner(localId, {
          photoUri: persistedPhoto,
          faceEmbeddingJson: JSON.stringify(pending.embedding),
        });
      } else {
        await atualizaBiometriaFacial(reeducandoId, pending.embedding);
      }
      clearPending();
      Alert.alert('Biometria atualizada', 'A biometria facial do preso foi atualizada.', [
        {
          text: 'OK',
          onPress: () => {
            clearUpdatePrisonerDraft();
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (error) {
      if (isUnauthorizedError(error)) return;
      Alert.alert(
        'Erro ao atualizar',
        error instanceof Error ? error.message : 'Não foi possível atualizar a biometria facial.'
      );
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const renderTabs = () => (
    <View style={styles.tabs}>
      <TouchableOpacity
        style={[styles.tabButton, step === 'dados' && styles.tabButtonActive]}
        onPress={() => setStep('dados')}
      >
        <Text style={[styles.tabButtonText, step === 'dados' && styles.tabButtonTextActive]}>1. Dados</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tabButton,
          step === 'biometria' && styles.tabButtonActive,
          !canGoToBiometria && styles.tabButtonDisabled,
        ]}
        onPress={goToBiometria}
        disabled={!canGoToBiometria}
      >
        <Text
          style={[
            styles.tabButtonText,
            step === 'biometria' && styles.tabButtonTextActive,
            !canGoToBiometria && styles.tabButtonTextDisabled,
          ]}
        >
          2. Biometria
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (step === 'biometria') {
    return (
      <ScrollView
        contentContainerStyle={[styles.container, styles.containerBiometry]}
        keyboardShouldPersistTaps="handled"
      >
        {renderTabs()}
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
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('dados')}>
                <Text style={styles.secondaryButtonText}>Voltar para dados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, !canSaveBiometria && styles.primaryButtonDisabled]}
                onPress={() => void handleUpdateBiometria()}
                disabled={!canSaveBiometria}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !canSaveBiometria && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Atualizar biometria
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.fixedScreen}>
      <ScrollView
        style={styles.fixedScroll}
        contentContainerStyle={styles.fixedScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderTabs()}

        <TouchableOpacity
          style={[styles.quickActionCard, styles.faceActionCard]}
          onPress={() => router.push({ pathname: '/capture', params: { mode: 'update' } })}
          accessibilityRole="button"
          accessibilityLabel="Buscar cadastro por reconhecimento facial"
          activeOpacity={0.85}
        >
          <View style={styles.faceScanIcon}>
            <Ionicons name="scan-outline" size={32} color="#6D28D9" />
            <Ionicons name="person" size={14} color="#6D28D9" style={styles.faceScanPerson} />
          </View>
          <Text style={styles.quickActionTitle}>{`Busca por facial`}</Text>
        </TouchableOpacity>

        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Pesquisar por</Text>
          {/* <Text style={styles.searchHint}>Nome, mãe, CPF ou prontuário</Text> */}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nome do preso</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome completo"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nome da mãe</Text>
            <TextInput
              style={styles.input}
              value={mae}
              onChangeText={setMae}
              placeholder="Nome da mãe"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CPF</Text>
              <TextInput
                style={styles.input}
                value={cpf}
                onChangeText={(text) => setCpf(maskCpf(text))}
                placeholder="000.000.000-00"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardType="number-pad"
                maxLength={14}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Prontuário</Text>
              <TextInput
                style={styles.input}
                value={prontuario}
                onChangeText={(text) => setProntuario(onlyDigits(text))}
                placeholder="Número"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardType="number-pad"
                returnKeyType="search"
                onSubmitEditing={() => void searchByData()}
              />
            </View>
          </View>
        </View>

      </ScrollView>

      <View style={styles.fixedFooter}>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.fixedFooterBtn, isSearching && styles.primaryButtonDisabled]}
          onPress={() => void searchByData()}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color="#0D9488" />
          ) : (
            <Text style={styles.secondaryButtonText}>Pesquisar preso</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, styles.fixedFooterBtn, !canGoToBiometria && styles.primaryButtonDisabled]}
          onPress={goToBiometria}
          disabled={!canGoToBiometria}
        >
          <Text style={[styles.primaryButtonText, !canGoToBiometria && styles.primaryButtonTextDisabled]}>
            Ir para biometria
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
  fixedScreen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  fixedScroll: {
    flex: 1,
  },
  fixedScrollContent: {
    padding: 20,
    paddingBottom: 24,
    gap: 16,
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
    backgroundColor: '#fff',
  },
  tabButtonActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  tabButtonDisabled: {
    opacity: 0.45,
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
  tabButtonTextDisabled: {
    color: '#9CA3AF',
  },
  quickActionCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 0,
    marginTop: -10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  faceActionCard: {
    alignSelf: 'flex-end',
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  faceScanIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceScanPerson: {
    position: 'absolute',
  },
  quickActionTitle: {
    color: '#6D28D9',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 12,
  },
  searchTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  searchHint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: -6,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  fixedFooter: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F2F2F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  fixedFooterBtn: {
    alignSelf: 'stretch',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photo: {
    width: 180,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  photoPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  photoBtnText: {
    color: '#374151',
    fontWeight: '600',
  },
  biometryCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  biometryBottom: {
    gap: 10,
    paddingBottom: 12,
  },
});
