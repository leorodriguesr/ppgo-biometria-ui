import { ThemedText } from '@/components/themed-text';
import { USE_LOCAL_DATABASE } from '@/src/configs/runtimeConfig';
import { addActivity } from '@/src/services/database';
import type { BuscaFacialMatch } from '@/src/services/goiaspenAppApi';
import {
  getFacialSearchPurpose,
  getIdentifyMatchList,
  registerParamsFromMatch,
  setIdentifyMatch,
} from '@/src/services/identifyMatchStore';
import { maskCpf } from '@/src/utils/inputMasks';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

function formatDistance(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(4);
}

function frontPhotoUri(item: BuscaFacialMatch): string | undefined {
  return item.fotoUrl ?? item.fotos?.[0];
}

export default function IdentifyMatchesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const origin = Array.isArray(params.origin) ? params.origin[0] : params.origin;
  const fromDataSearch = origin === 'data';
  const matches = useMemo(() => getIdentifyMatchList(), []);
  const purpose = useMemo(() => getFacialSearchPurpose(), []);

  const selectMatch = async (item: BuscaFacialMatch) => {
    const view = setIdentifyMatch(item);
    try {
      await addActivity({
        type: 'identify',
        prisonerId: view.prisoner.id || null,
        prisonerName: item.nome,
      });
    } catch {
      // ignore
    }
    if (purpose === 'prefill') {
      router.replace({
        pathname: '/register',
        params: registerParamsFromMatch(item),
      });
      return;
    }
    if (purpose === 'update') {
      router.dismissTo({
        pathname: '/update-prisoner',
        params: registerParamsFromMatch(item),
      });
      return;
    }
    router.replace({
      pathname: '/identify-result',
      params: {
        prisonerId: item.id,
        source: USE_LOCAL_DATABASE ? 'local' : 'api',
        ...(item.distance != null && { distance: String(item.distance) }),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.hint}>
        {fromDataSearch
          ? 'A pesquisa encontrou mais de um preso. Confira a foto, o nome, a mãe, o CPF e a data de nascimento e selecione o correto.'
          : purpose === 'prefill'
          ? 'A busca facial encontrou mais de uma pessoa com biometria semelhante. Confira foto, CPF e filiação e selecione o detento correto para preencher o cadastro.'
          : purpose === 'update'
            ? 'A busca facial encontrou mais de uma pessoa com biometria semelhante. Selecione o preso correto para atualizar a biometria.'
            : 'A busca facial encontrou mais de uma pessoa com biometria semelhante. Confira foto, CPF, filiação e data de nascimento e selecione o detento correto.'}
      </ThemedText>
      <FlatList
        data={matches}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>Nenhuma correspondência na lista.</ThemedText>
        }
        renderItem={({ item }) => {
          const photoUri = frontPhotoUri(item);
          const distance = formatDistance(item.distance);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => void selectMatch(item)}
              activeOpacity={0.85}
            >
              <View style={styles.photoWrap}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={40} color="#9CA3AF" />
                    <ThemedText style={styles.placeholderText}>Sem foto</ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <ThemedText type="defaultSemiBold" style={styles.name} numberOfLines={2}>
                    Nome: {item.nome}
                  </ThemedText>
                  {distance ? (
                    <View style={styles.chip}>
                      <ThemedText style={styles.chipText}>{distance}</ThemedText>
                    </View>
                  ) : null}
                </View>
                {item.nomeSocial ? (
                  <ThemedText style={styles.meta}>Nome social: {item.nomeSocial}</ThemedText>
                ) : null}
                <ThemedText style={styles.detail}>CPF: {item.cpf ? maskCpf(item.cpf) : '—'}</ThemedText>
                <ThemedText style={styles.detail}>Mãe: {item.mae || '—'}</ThemedText>
                <ThemedText style={styles.detail}>
                  Nascimento: {item.dataNascimento || '—'}
                </ThemedText>
                <View style={styles.ctaRow}>
                  <ThemedText style={styles.cta}>Toque para selecionar</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F2F2F7',
  },
  hint: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 14,
    lineHeight: 20,
  },
  list: {
    gap: 16,
    paddingBottom: 28,
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  photoWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photo: {
    width: '100%',
    height: 280,
  },
  photoPlaceholder: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    color: '#6B7280',
    fontSize: 13,
  },
  info: {
    paddingTop: 12,
    paddingHorizontal: 4,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  chip: {
    backgroundColor: '#CCFBF1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '800',
  },
  meta: {
    color: '#6B7280',
    fontSize: 13,
  },
  detail: {
    fontSize: 15,
    color: '#111827',
  },
  ctaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
});
