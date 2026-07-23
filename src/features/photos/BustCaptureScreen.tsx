import { BustPhotoOverlay } from '@/src/components/BustPhotoOverlay';
import { useBustPhotoQuality } from '@/src/features/photos/hooks/useBustPhotoQuality';
import { BUST_PHOTO_LABELS, type BustPhotoKind } from '@/src/features/photos/types';
import { validateDetaineePhoto } from '@/src/features/photos/validateDetaineePhoto';
import { addPrisonerPhoto } from '@/src/services/database';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

function asKind(value: string | string[] | undefined): BustPhotoKind {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'right_profile' || raw === 'left_profile' || raw === 'front') return raw;
  return 'front';
}

export default function BustCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const kind = asKind(params.kind as string | string[] | undefined);
  const draftPrisonerId = Number(
    Array.isArray(params.draftPrisonerId) ? params.draftPrisonerId[0] : params.draftPrisonerId
  );

  const [permission, requestPermission] = useCameraPermissions();
  const { status } = useBustPhotoQuality();
  const camera = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted && permission.canAskAgain) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permissão negada', 'O app precisa da câmera para as fotos.');
          router.back();
        }
      } else if (permission && !permission.granted) {
        Alert.alert('Permissão negada', 'O app precisa da câmera para as fotos.');
        router.back();
      }
    })();
  }, [permission, requestPermission, router]);

  const takePhoto = async () => {
    if (!Number.isFinite(draftPrisonerId) || draftPrisonerId <= 0) {
      Alert.alert('Erro', 'Cadastro local não encontrado. Volte e salve os dados novamente.');
      return;
    }
    if (!camera.current || isCapturing || isValidating) return;

    setIsCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({
        base64: false,
        skipProcessing: true,
        quality: 0.85,
      });
      const uri = photo?.uri ?? '';
      if (!uri) throw new Error('Foto vazia');

      setIsCapturing(false);
      setIsValidating(true);

      const validation = await validateDetaineePhoto(uri, kind);
      if (!validation.ok) {
        Alert.alert('Foto rejeitada', validation.message, [{ text: 'OK' }]);
        return;
      }

      await addPrisonerPhoto({
        prisonerId: draftPrisonerId,
        photoType: kind,
        photoUri: uri,
        qualityOk: true,
      });

      router.replace({
        pathname: '/register',
        params: {
          draftPrisonerId: String(draftPrisonerId),
          step: 'fotos',
          photoSaved: kind,
        },
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao capturar ou validar a foto.');
    } finally {
      setIsCapturing(false);
      setIsValidating(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Sem permissão de câmera</Text>
      </View>
    );
  }

  const busy = isCapturing || isValidating;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        animateShutter={false}
      />

      <BustPhotoOverlay status={status.overallConfig} />

      <View style={styles.topBadge}>
        <Text style={styles.topBadgeText}>{BUST_PHOTO_LABELS[kind].toUpperCase()}</Text>
      </View>

      {isValidating ? (
        <View style={styles.validatingOverlay}>
          <ActivityIndicator size="large" color="#00E676" />
          <Text style={styles.validatingText}>Validando qualidade da foto...</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.captureBtn, busy && styles.captureBtnDisabled]}
          onPress={takePhoto}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#00E676" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 40,
  },
  validatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  validatingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  controls: {
    position: 'absolute',
    bottom: 46,
    alignSelf: 'center',
    alignItems: 'center',
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
  captureBtnDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00E676',
  },
});
