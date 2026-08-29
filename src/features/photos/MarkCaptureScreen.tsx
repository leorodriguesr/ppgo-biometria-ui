import { isUnauthorizedError } from '@/src/auth/unauthorizedSession';
import { BustPhotoOverlay } from '@/src/components/BustPhotoOverlay';
import { SelectField } from '@/src/components/SelectField';
import type { SelectOption } from '@/src/configs/cadastroOptions';
import { useBustPhotoQuality } from '@/src/features/photos/hooks/useBustPhotoQuality';
import type { MarkPhotoKind } from '@/src/features/photos/types';
import { addPrisonerPhoto } from '@/src/services/database';
import {
  listarPartesCorpo,
  listarTiposSinal,
} from '@/src/services/goiaspenAppApi';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Phase = 'form' | 'camera';

export default function MarkCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const draftPrisonerId = Number(
    Array.isArray(params.draftPrisonerId) ? params.draftPrisonerId[0] : params.draftPrisonerId
  );

  const [phase, setPhase] = useState<Phase>('form');
  const [sinalId, setSinalId] = useState('');
  const [parteCorpoId, setParteCorpoId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [tipoSinalOptions, setTipoSinalOptions] = useState<SelectOption[]>([]);
  const [parteCorpoOptions, setParteCorpoOptions] = useState<SelectOption[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const { status, simulateDetection } = useBustPhotoQuality(
    'Enquadre a marca/tatuagem com boa iluminação'
  );
  const camera = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const sinalLabel = tipoSinalOptions.find((o) => o.value === sinalId)?.label?.trim() ?? '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCatalogs(true);
      try {
        const [tipos, partes] = await Promise.all([listarTiposSinal(), listarPartesCorpo()]);
        if (cancelled) return;
        setTipoSinalOptions(
          tipos.map((t) => ({
            label: t.descricao,
            value: String(t.id),
          }))
        );
        setParteCorpoOptions(
          partes.map((p) => ({
            label: p.regiao ? `${p.descricao} (${p.regiao})` : p.descricao,
            value: String(p.id),
          }))
        );
      } catch (error) {
        console.error(error);
        if (cancelled || isUnauthorizedError(error)) return;
        Alert.alert(
          'Catálogos indisponíveis',
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar tipos de sinal e partes do corpo.'
        );
      } finally {
        if (!cancelled) setLoadingCatalogs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'camera') return;
    const cleanup = simulateDetection();
    return cleanup;
  }, [phase, simulateDetection]);

  useEffect(() => {
    if (phase !== 'camera') return;
    (async () => {
      if (permission && !permission.granted && permission.canAskAgain) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permissão negada', 'O app precisa da câmera para as fotos.');
          setPhase('form');
        }
      }
    })();
  }, [phase, permission, requestPermission]);

  const formReady = Boolean(sinalId) && Boolean(parteCorpoId) && observacao.trim().length <= 70;

  const resolveObservacao = () => {
    const typed = observacao.trim();
    if (typed) return typed.slice(0, 70);
    return (sinalLabel || 'Sinal').slice(0, 70);
  };

  const goToCamera = () => {
    if (!sinalId || !parteCorpoId) {
      Alert.alert('Campos obrigatórios', 'Selecione o tipo de sinal e a parte do corpo.');
      return;
    }
    if (observacao.trim().length > 70) {
      Alert.alert('Observação longa', 'A observação deve ter no máximo 70 caracteres.');
      return;
    }
    setPhase('camera');
  };

  const takePhoto = async () => {
    if (!Number.isFinite(draftPrisonerId) || draftPrisonerId <= 0) {
      Alert.alert('Erro', 'Dados incompletos para salvar a foto.');
      return;
    }
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({
        base64: false,
        skipProcessing: true,
        quality: 0.85,
      });
      const uri = photo?.uri ?? '';
      if (!uri) throw new Error('Foto vazia');

      const resolvedKind: MarkPhotoKind = sinalLabel.toLowerCase().includes('tatu')
        ? 'tattoo'
        : 'mark';

      await addPrisonerPhoto({
        prisonerId: draftPrisonerId,
        photoType: resolvedKind,
        photoUri: uri,
        bodyRegion: parteCorpoId,
        qualityOk: true,
        sinal: sinalId,
        parteCorpo: parteCorpoId,
        observacao: resolveObservacao(),
      });

      router.replace({
        pathname: '/register',
        params: {
          draftPrisonerId: String(draftPrisonerId),
          step: 'fotos',
          photoSaved: resolvedKind,
        },
      });
    } catch (error) {
      console.error(error);
      if (isUnauthorizedError(error)) return;
      Alert.alert('Erro', 'Falha ao capturar ou salvar a foto.');
    } finally {
      setIsCapturing(false);
    }
  };

  if (phase === 'form') {
    return (
      <ScrollView contentContainerStyle={styles.regionContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Marcas e tatuagens</Text>
        <Text style={styles.subtitle}>
          Selecione o tipo de sinal e a parte do corpo. A observação é opcional.
        </Text>

        {loadingCatalogs ? (
          <ActivityIndicator color="#0D9488" style={{ marginVertical: 24 }} />
        ) : (
          <>
            <SelectField
              label="Tipo de sinal *"
              value={sinalId}
              options={tipoSinalOptions}
              onChange={setSinalId}
              allowEmpty={false}
              placeholder="Selecione o tipo"
            />
            <SelectField
              label="Parte do corpo *"
              value={parteCorpoId}
              options={parteCorpoOptions}
              onChange={setParteCorpoId}
              allowEmpty={false}
              placeholder="Selecione a região"
            />

            <Text style={styles.label}>Observação (máx. 70)</Text>
            <TextInput
              style={styles.input}
              value={observacao}
              onChangeText={(text) => setObservacao(text.slice(0, 70))}
              placeholder={sinalLabel || 'Se vazio, usa o tipo de sinal'}
              placeholderTextColor="#dddddd"
              maxLength={70}
              multiline
            />
            <Text style={styles.counter}>{observacao.trim().length}/70</Text>
          </>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, (!formReady || loadingCatalogs) && styles.primaryDisabled]}
          onPress={goToCamera}
          disabled={!formReady || loadingCatalogs}
        >
          <Text style={styles.primaryButtonText}>Continuar para câmera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const canCapture = !isCapturing;

  return (
    <View style={styles.cameraContainer}>
      <StatusBar hidden />
      {!permission?.granted ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            animateShutter={false}
          />
          <BustPhotoOverlay status={status.overallConfig} showMidGuide={false} />
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>
              {(
                parteCorpoOptions.find((o) => o.value === parteCorpoId)?.label ?? 'MARCA'
              ).toUpperCase()}
            </Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.backCamBtn} onPress={() => setPhase('form')}>
              <Text style={styles.backCamText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureBtn}
              onPress={takePhoto}
              disabled={!canCapture}
            >
              {isCapturing ? (
                <ActivityIndicator color="#00E676" />
              ) : (
                <View style={styles.captureInner} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  regionContainer: {
    padding: 20,
    backgroundColor: '#F2F2F7',
    flexGrow: 1,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  label: {
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#6B7280',
    fontSize: 12,
    marginTop: -4,
  },
  primaryButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  topBadge: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: 'rgba(13,148,136,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '90%',
  },
  topBadgeText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 13,
  },
  controls: {
    position: 'absolute',
    bottom: 46,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
  },
  backCamBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backCamText: {
    color: '#fff',
    fontWeight: '600',
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#00E676',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00E676',
  },
});
