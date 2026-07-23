import { BodyMannequin } from '@/src/components/BodyMannequin';
import {
  BODY_REGION_LABELS,
  type BodyRegionId,
  type BodySide,
  type MarkPhotoKind,
} from '@/src/features/photos/types';
import { useBustPhotoQuality } from '@/src/features/photos/hooks/useBustPhotoQuality';
import { BustPhotoOverlay } from '@/src/components/BustPhotoOverlay';
import { addPrisonerPhoto } from '@/src/services/database';
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
  TouchableOpacity,
  View,
} from 'react-native';

type Phase = 'region' | 'camera';

export default function MarkCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const draftPrisonerId = Number(
    Array.isArray(params.draftPrisonerId) ? params.draftPrisonerId[0] : params.draftPrisonerId
  );

  const [phase, setPhase] = useState<Phase>('region');
  const [side, setSide] = useState<BodySide>('front');
  const [region, setRegion] = useState<BodyRegionId | null>(null);
  const [markKind, setMarkKind] = useState<MarkPhotoKind>('tattoo');
  const [permission, requestPermission] = useCameraPermissions();
  const { status, simulateDetection } = useBustPhotoQuality(
    'Enquadre a marca/tatuagem com boa iluminação'
  );
  const camera = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

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
          setPhase('region');
        }
      }
    })();
  }, [phase, permission, requestPermission]);

  const goToCamera = () => {
    if (!region) {
      Alert.alert('Região obrigatória', 'Selecione no manequim onde está a marca ou tatuagem.');
      return;
    }
    setPhase('camera');
  };

  const takePhoto = async () => {
    if (!region || !Number.isFinite(draftPrisonerId) || draftPrisonerId <= 0) {
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

      await addPrisonerPhoto({
        prisonerId: draftPrisonerId,
        photoType: markKind,
        photoUri: uri,
        bodyRegion: region,
        bodySide: side,
        qualityOk: true,
      });

      router.replace({
        pathname: '/register',
        params: {
          draftPrisonerId: String(draftPrisonerId),
          step: 'fotos',
          photoSaved: markKind,
        },
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao capturar ou salvar a foto.');
    } finally {
      setIsCapturing(false);
    }
  };

  if (phase === 'region') {
    return (
      <ScrollView contentContainerStyle={styles.regionContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Marcas e tatuagens</Text>
        <Text style={styles.subtitle}>Indique a região no manequim e o tipo da marca.</Text>

        <View style={styles.sideRow}>
          <TouchableOpacity
            style={[styles.sideBtn, side === 'front' && styles.sideBtnActive]}
            onPress={() => setSide('front')}
          >
            <Text style={[styles.sideBtnText, side === 'front' && styles.sideBtnTextActive]}>
              Frente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sideBtn, side === 'back' && styles.sideBtnActive]}
            onPress={() => setSide('back')}
          >
            <Text style={[styles.sideBtnText, side === 'back' && styles.sideBtnTextActive]}>
              Costas
            </Text>
          </TouchableOpacity>
        </View>

        <BodyMannequin side={side} selected={region} onSelect={setRegion} />

        <View style={styles.kindRow}>
          <TouchableOpacity
            style={[styles.kindBtn, markKind === 'tattoo' && styles.kindBtnActive]}
            onPress={() => setMarkKind('tattoo')}
          >
            <Text style={[styles.kindBtnText, markKind === 'tattoo' && styles.kindBtnTextActive]}>
              Tatuagem
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.kindBtn, markKind === 'mark' && styles.kindBtnActive]}
            onPress={() => setMarkKind('mark')}
          >
            <Text style={[styles.kindBtnText, markKind === 'mark' && styles.kindBtnTextActive]}>
              Marca / cicatriz
            </Text>
          </TouchableOpacity>
        </View>

        {region ? (
          <Text style={styles.summary}>
            {markKind === 'tattoo' ? 'Tatuagem' : 'Marca'} · {side === 'front' ? 'Frente' : 'Costas'} ·{' '}
            {BODY_REGION_LABELS[region]}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, !region && styles.primaryDisabled]}
          onPress={goToCamera}
          disabled={!region}
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
              {(region ? BODY_REGION_LABELS[region] : 'MARCA').toUpperCase()}
            </Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.backCamBtn} onPress={() => setPhase('region')}>
              <Text style={styles.backCamText}>Trocar região</Text>
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
  sideRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  sideBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  sideBtnActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  sideBtnText: {
    fontWeight: '700',
    color: '#111827',
  },
  sideBtnTextActive: {
    color: '#fff',
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kindBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  kindBtnActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  kindBtnText: {
    fontWeight: '700',
    color: '#374151',
  },
  kindBtnTextActive: {
    color: '#0F766E',
  },
  summary: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#0F766E',
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
  },
  topBadgeText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 13,
  },
  feedbackContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '88%',
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
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
