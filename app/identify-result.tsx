import { PrisonerDetailView } from '@/src/components/PrisonerDetailView';
import {
  getPrisonerById,
  getPrisonerPhotos,
  type PrisonerPhotoRow,
  type PrisonerRow,
} from '@/src/services/database';
import { USE_LOCAL_DATABASE } from '@/src/configs/runtimeConfig';
import { getIdentifyMatch } from '@/src/services/identifyMatchStore';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

function asParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function mergeLocalPhotos(
  prisoner: PrisonerRow,
  rows: PrisonerPhotoRow[],
  storedPhotos: PrisonerPhotoRow[]
): PrisonerPhotoRow[] {
  const byType = new Map<string, PrisonerPhotoRow>();
  for (const photo of [...storedPhotos, ...rows]) {
    const key =
      photo.photo_type === 'mark' || photo.photo_type === 'tattoo'
        ? `mark-${photo.id}-${photo.photo_uri}`
        : photo.photo_type;
    byType.set(key, photo);
  }
  return [...byType.values()];
}

export default function IdentifyResultScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    prisonerId: string;
    from?: string;
    source?: string;
  }>();
  const [prisoner, setPrisoner] = useState<PrisonerRow | null>(null);
  const [photos, setPhotos] = useState<PrisonerPhotoRow[]>([]);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const [variant, setVariant] = useState<'local' | 'api'>('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prisonerId = asParam(params.prisonerId);
  const fromSearch = asParam(params.from) === 'search';

  useLayoutEffect(() => {
    navigation.setOptions({
      title: fromSearch ? 'Detento' : 'Preso identificado',
    });
  }, [fromSearch, navigation]);

  useEffect(() => {
    if (!prisonerId) {
      setError('ID do detento não informado.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const stored = getIdentifyMatch(prisonerId) ?? getIdentifyMatch();

        if (!USE_LOCAL_DATABASE) {
          if (!stored) {
            setPrisoner(null);
            setError('Resultado do GoiásPen não encontrado. Faça a identificação novamente.');
            return;
          }
          setPrisoner(stored.prisoner);
          setPhotos(stored.photos);
          setGalleryUris(stored.galleryUris);
          setVariant('api');
          return;
        }

        const numericId = Number(prisonerId);
        const p = await getPrisonerById(
          Number.isFinite(numericId) && numericId > 0 ? numericId : prisonerId
        );
        if (!p) {
          setPrisoner(null);
          setError('Detento não encontrado no banco local.');
          return;
        }
        const rows = await getPrisonerPhotos(Number(p.id));
        const merged = mergeLocalPhotos(p, rows, stored?.photos ?? []);
        setPrisoner(p);
        setPhotos(merged);
        setGalleryUris([]);
        setVariant('local');
      } catch {
        setError('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    })();
  }, [prisonerId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.loadingText}>Carregando dados...</Text>
      </View>
    );
  }

  if (error || !prisoner) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Detento não encontrado.'}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <PrisonerDetailView
        prisoner={prisoner}
        photos={photos}
        variant={variant}
        galleryUris={galleryUris}
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Voltar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F2F2F7',
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
