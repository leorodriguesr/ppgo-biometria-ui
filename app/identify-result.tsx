import { PrisonerDetailView } from '@/src/components/PrisonerDetailView';
import {
  getPrisonerById,
  getPrisonerPhotos,
  type PrisonerPhotoRow,
  type PrisonerRow,
} from '@/src/services/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function IdentifyResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prisonerId: string;
    distance?: string;
    from?: string;
  }>();
  const [prisoner, setPrisoner] = useState<PrisonerRow | null>(null);
  const [photos, setPhotos] = useState<PrisonerPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prisonerId = params.prisonerId;
  const distance = params.distance != null ? parseFloat(params.distance) : undefined;
  const fromSearch = params.from === 'search';

  useEffect(() => {
    if (!prisonerId) {
      setError('ID do detento não informado.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const p = await getPrisonerById(prisonerId);
        setPrisoner(p ?? null);
        if (!p) {
          setError('Detento não encontrado.');
          return;
        }
        const rows = await getPrisonerPhotos(Number(p.id));
        setPhotos(rows);
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
        badgeTitle={fromSearch ? undefined : 'PRESO IDENTIFICADO'}
        // badgeSubtitle={
        //   !fromSearch && distance != null && Number.isFinite(distance)
        //     ? `Distância: ${distance.toFixed(2)}`
        //     : undefined
        // }
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
