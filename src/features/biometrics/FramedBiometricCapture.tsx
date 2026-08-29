import { isUnauthorizedError } from '@/src/auth/unauthorizedSession';
import { BiometricOverlay } from '@/src/components/BiometricOverlay';
import { usePendingBiometrics } from '@/src/context/PendingBiometricsContext';
import { deleteLocalFiles, toFileUri } from '@/src/features/biometrics/captureFiles';
import {
  releaseCaptureSession,
  tryAcquireCaptureSession,
} from '@/src/features/biometrics/captureSessionLock';
import {
  evaluateFraming,
  framingMessage,
  getFaceGuide,
  overlayColor,
} from '@/src/features/biometrics/faceGuide';
import { FACE_CAPTURE_ERROR_MESSAGES, generateEmbedding } from '@/src/services/api';
import { addActivity } from '@/src/services/database';
import { buscaFacialMelhorMatch, buscaFacialMatches } from '@/src/services/goiaspenAppApi';
import {
  registerParamsFromMatch,
  setFacialSearchPurpose,
  setIdentifyMatch,
  setIdentifyMatchList,
} from '@/src/services/identifyMatchStore';
import { useFaceDetector } from '@noma4i/vision-camera-face-detector';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';

const STABLE_MS = 3000;

export type BiometricCaptureMode = 'register' | 'identify' | 'prefill';

type Props = {
  mode: BiometricCaptureMode;
};

export default function FramedBiometricCapture({ mode }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width, height } = useWindowDimensions();
  const { setPending } = usePendingBiometrics();
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const photoOutput = usePhotoOutput({
    quality: 0.85,
    containerFormat: 'jpeg',
    targetResolution: CommonResolutions.FHD_4_3,
    qualityPrioritization: 'balanced',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shotLocked, setShotLocked] = useState(false);
  const [noMatchVisible, setNoMatchVisible] = useState(false);
  const capturingRef = useRef(false);
  const captureRef = useRef<(() => Promise<void>) | null>(null);
  const photoUriRef = useRef<string | null>(null);
  const acquiredRef = useRef(false);
  const successRef = useRef(false);

  const guide = useMemo(() => getFaceGuide(width, height), [height, width]);

  const detectorOptions = useMemo(
    () => ({
      preset: 'selfie' as const,
      fps: 12,
      outputs: photoOutput,
      preview: 'screen' as const,
      guide: 'none' as const,
      stability: { readySamples: 1, resetSamples: 2, minTransitionMs: 120 },
    }),
    [photoOutput]
  );

  const face = useFaceDetector(detectorOptions);

  const framing = useMemo(
    () => evaluateFraming(face.result.faces.length, face.result.primaryFaceRect, guide),
    [face.result.faces.length, face.result.primaryFaceRect, guide]
  );

  const framedOk =
    face.available &&
    framing === 'ok' &&
    !busy &&
    !uploading &&
    !shotLocked &&
    !noMatchVisible;

  const overlayStatus = busy || uploading ? 'yellow' : overlayColor(framing);

  const goBackToRegister = useCallback(
    (photoUri?: string) => {
      router.replace({
        pathname: '/register',
        params: {
          ...(photoUri ? { photo: photoUri } : {}),
          draftPrisonerId: (params.draftPrisonerId as string) ?? '',
          prefillName: (params.prefillName as string) ?? '',
          prefillMotherName: (params.prefillMotherName as string) ?? '',
          prefillDob: (params.prefillDob as string) ?? '',
          prefillCpf: (params.prefillCpf as string) ?? '',
          prefillSocialName: (params.prefillSocialName as string) ?? '',
          prefillNationality: (params.prefillNationality as string) ?? '',
          prefillMaritalStatus: (params.prefillMaritalStatus as string) ?? '',
          prefillProfession: (params.prefillProfession as string) ?? '',
          prefillEducation: (params.prefillEducation as string) ?? '',
          prefillAge: (params.prefillAge as string) ?? '',
          prefillBirthPlace: (params.prefillBirthPlace as string) ?? '',
          prefillFiliation: (params.prefillFiliation as string) ?? '',
          prefillAddress: (params.prefillAddress as string) ?? '',
          prefillPhone: (params.prefillPhone as string) ?? '',
          prefillEmail: (params.prefillEmail as string) ?? '',
        },
      });
    },
    [params, router]
  );

  const handleCapturedEmbedding = useCallback(
    async (uri: string, embedding: number[]): Promise<'done' | 'no_match'> => {
      if (mode !== 'identify' && mode !== 'prefill') {
        setPending(uri, embedding);
        successRef.current = true;
        goBackToRegister(uri);
        return 'done';
      }

      setFacialSearchPurpose(mode);
      const match = await buscaFacialMelhorMatch(embedding);
      if (match) {
        const view = setIdentifyMatch(match);
        try {
          await addActivity({
            type: 'identify',
            prisonerId: view.prisoner.id || null,
            prisonerName: match.nome,
          });
        } catch (e) {
          console.warn('Falha ao registrar atividade:', e);
        }
        successRef.current = true;
        deleteLocalFiles([uri]);
        if (mode === 'prefill') {
          router.replace({
            pathname: '/register',
            params: registerParamsFromMatch(match),
          });
          return 'done';
        }
        router.replace({
          pathname: '/identify-result',
          params: {
            prisonerId: match.id,
            source: 'api',
            ...(match.distance != null && { distance: String(match.distance) }),
          },
        });
        return 'done';
      }

      const matches = await buscaFacialMatches(embedding);
      if (matches.length > 0) {
        setIdentifyMatchList(matches);
        successRef.current = true;
        deleteLocalFiles([uri]);
        router.replace({ pathname: '/identify-matches' });
        return 'done';
      }

      try {
        await addActivity({ type: 'identify_fail' });
      } catch {
        // ignore
      }
      return 'no_match';
    },
    [goBackToRegister, mode, router, setPending]
  );

  const captureAndSubmit = useCallback(async () => {
    if (capturingRef.current || busy || shotLocked) return;
    capturingRef.current = true;
    setShotLocked(true);
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const file = await photoOutput.capturePhotoToFile(
        { flashMode: 'off', enableShutterSound: false },
        {}
      );
      const uri = toFileUri(file.filePath);
      photoUriRef.current = uri;
      setUploading(true);
      const embedding = await generateEmbedding(uri);
      if (embedding.length !== 512) {
        throw new Error('Resposta inválida da API: embedding não encontrado.');
      }
      const outcome = await handleCapturedEmbedding(uri, embedding);
      if (outcome === 'no_match') {
        deleteLocalFiles([photoUriRef.current]);
        photoUriRef.current = null;
        setNoMatchVisible(true);
      }
    } catch (error) {
      console.error('[BIOMETRIA] captura recusada', error);
      deleteLocalFiles([photoUriRef.current]);
      photoUriRef.current = null;
      if (isUnauthorizedError(error)) return;
      const code = error instanceof Error ? error.message : '';
      const network =
        /network request failed|failed to fetch|network error/i.test(code)
          ? 'Não foi possível conectar ao servidor de biometria. Confira o Wi-Fi e o endereço da API.'
          : null;
      const message =
        network ||
        (code && FACE_CAPTURE_ERROR_MESSAGES[code]) ||
        (error instanceof Error ? error.message : 'Não foi possível capturar a foto.');
      Alert.alert('Captura recusada', message, [{ text: 'OK' }]);
    } finally {
      capturingRef.current = false;
      setBusy(false);
      setUploading(false);
    }
  }, [busy, handleCapturedEmbedding, photoOutput, shotLocked]);

  captureRef.current = captureAndSubmit;

  useEffect(() => {
    if (!tryAcquireCaptureSession()) {
      Alert.alert(
        'Captura em andamento',
        'Conclua ou cancele a verificação atual antes de iniciar outra.'
      );
      router.back();
      return;
    }
    acquiredRef.current = true;
    return () => {
      if (acquiredRef.current) {
        releaseCaptureSession();
        acquiredRef.current = false;
      }
      if (successRef.current) return;
      deleteLocalFiles([photoUriRef.current]);
    };
  }, [router]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      void requestPermission();
    }
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    if (noMatchVisible) return;
    if (framing !== 'ok' && !busy && !uploading) {
      setShotLocked(false);
    }
  }, [busy, framing, noMatchVisible, uploading]);

  useEffect(() => {
    if (!framedOk) {
      setCountdown(null);
      return;
    }

    const startedAt = Date.now();
    let lastShown = 3;
    setCountdown(3);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= STABLE_MS) {
        clearInterval(interval);
        setCountdown(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void captureRef.current?.();
        return;
      }
      const remaining = Math.max(1, 3 - Math.floor(elapsed / 1000));
      if (remaining !== lastShown) {
        lastShown = remaining;
        setCountdown(remaining);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [framedOk]);

  const handleCancel = () => {
    deleteLocalFiles([photoUriRef.current]);
    photoUriRef.current = null;
    router.back();
  };

  const handleRetry = () => {
    deleteLocalFiles([photoUriRef.current]);
    photoUriRef.current = null;
    capturingRef.current = false;
    setBusy(false);
    setUploading(false);
    setCountdown(null);
    setNoMatchVisible(false);
    setShotLocked(false);
  };

  const handleNoMatchClose = () => {
    setNoMatchVisible(false);
    router.replace('/(tabs)');
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Permissão de câmera necessária para a biometria.</Text>
        <TouchableOpacity style={styles.textButton} onPress={() => void requestPermission()}>
          <Text style={styles.textButtonLabel}>Permitir câmera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Câmera frontal indisponível.</Text>
      </View>
    );
  }

  const instruction = !face.available
    ? 'Detector facial indisponível. Gere um novo development build.'
    : busy || uploading
      ? uploading
        ? 'Processando biometria...'
        : 'Capturando foto...'
      : countdown != null
        ? `${countdown}`
        : shotLocked && framing === 'ok'
          ? 'Toque em Repetir para nova captura'
          : framingMessage(framing);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Camera
        {...face.camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!successRef.current}
      />

      <BiometricOverlay status={overlayStatus} instruction={instruction} guide={guide} />

      {busy ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color="#00E676" />
          <Text style={styles.busyText}>
            {uploading
              ? mode === 'register'
                ? 'Salvando biometria...'
                : 'Consultando o GoiasPen...'
              : 'Capturando foto...'}
          </Text>
        </View>
      ) : null}

      <Modal visible={noMatchVisible} transparent animationType="fade" onRequestClose={handleNoMatchClose}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nenhum detento encontrado</Text>
            <Text style={styles.modalBody}>
              {mode === 'prefill'
                ? 'Não encontramos correspondência facial no GoiasPen para preencher o cadastro.'
                : 'Não encontramos correspondência facial no GoiasPen para este rosto.'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={handleNoMatchClose}>
                <Text style={styles.modalSecondaryLabel}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={handleRetry}>
                <Text style={styles.modalPrimaryLabel}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.textButton} onPress={handleCancel} disabled={busy}>
          <Text style={styles.textButtonLabel}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textButton} onPress={handleRetry} disabled={busy}>
          <Text style={styles.textButtonLabel}>Repetir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 16,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  busyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  textButtonLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalSecondaryLabel: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 15,
  },
  modalPrimary: {
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalPrimaryLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
