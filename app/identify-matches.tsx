import { ThemedText } from '@/components/themed-text';
import { addActivity } from '@/src/services/database';
import type { BuscaFacialMatch } from '@/src/services/goiaspenAppApi';
import {
  getFacialSearchPurpose,
  getIdentifyMatchList,
  registerParamsFromMatch,
  setIdentifyMatch,
} from '@/src/services/identifyMatchStore';
import { maskCpf } from '@/src/utils/inputMasks';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

function formatDistance(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(4);
}

export default function IdentifyMatchesScreen() {
  const router = useRouter();
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
    router.replace({
      pathname: '/identify-result',
      params: {
        prisonerId: item.id,
        source: 'api',
        ...(item.distance != null && { distance: String(item.distance) }),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.hint}>
        {purpose === 'prefill'
          ? 'Nenhum match único no GoiasPen. Selecione o detento para preencher o cadastro.'
          : 'Nenhum match único. Selecione o detento correspondente, se houver.'}
      </ThemedText>
      <FlatList
        data={matches}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>Nenhuma correspondência na lista.</ThemedText>
        }
        renderItem={({ item, index }) => {
          const distance = formatDistance(item.distance);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => void selectMatch(item)}
              activeOpacity={0.75}
            >
              {item.fotoUrl ? (
                <Image source={{ uri: item.fotoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.placeholder} />
              )}
              <View style={styles.info}>
                <ThemedText type="defaultSemiBold">
                  {index + 1}. {item.nome}
                </ThemedText>
                {item.nomeSocial ? (
                  <ThemedText style={styles.meta}>Nome social: {item.nomeSocial}</ThemedText>
                ) : null}
                <ThemedText>CPF: {item.cpf ? maskCpf(item.cpf) : '—'}</ThemedText>
                <ThemedText>Mãe: {item.mae || '—'}</ThemedText>
                {item.dataNascimento ? (
                  <ThemedText style={styles.meta}>Nascimento: {item.dataNascimento}</ThemedText>
                ) : null}
                {distance ? (
                  <ThemedText style={styles.badge}>Distância: {distance}</ThemedText>
                ) : (
                  <ThemedText style={styles.badge}>Candidato {index + 1}</ThemedText>
                )}
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
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  hint: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ddd',
  },
  placeholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccc',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  meta: {
    opacity: 0.75,
    fontSize: 13,
  },
  badge: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
});
