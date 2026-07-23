import { ThemedText } from '@/components/themed-text';
import { getPrisoners, type PrisonerRow } from '@/src/services/database';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function PrisonersScreen() {
  const router = useRouter();
  const [prisoners, setPrisoners] = useState<PrisonerRow[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadPrisoners();
    }, [])
  );

  const loadPrisoners = async () => {
    try {
      const data = await getPrisoners();
      setPrisoners(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os detentos.');
    }
  };

  const openDetail = (item: PrisonerRow) => {
    router.push({
      pathname: '/identify-result',
      params: {
        prisonerId: String(item.id),
        from: 'search',
      },
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={prisoners}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>Nenhum detento encontrado.</ThemedText>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDetail(item)}
            activeOpacity={0.75}
          >
            {item.photo_uri ? (
              <Image source={{ uri: item.photo_uri }} style={styles.avatar} />
            ) : (
              <View style={styles.placeholder} />
            )}
            <View style={styles.info}>
              <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
              {item.social_name ? (
                <ThemedText style={styles.meta}>Nome social: {item.social_name}</ThemedText>
              ) : null}
              <ThemedText>CPF: {item.cpf || '—'}</ThemedText>
              <ThemedText>Mãe: {item.mother_name || '—'}</ThemedText>
              {item.profession ? (
                <ThemedText style={styles.meta}>Profissão: {item.profession}</ThemedText>
              ) : null}
              <ThemedText style={styles.badge}>
                {item.face_embedding ? 'Biometria salva' : 'Sem biometria'}
              </ThemedText>
            </View>
          </TouchableOpacity>
        )}
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
  list: {
    gap: 15,
    paddingBottom: 24,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ddd',
  },
  placeholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    color: '#0D9488',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    opacity: 0.5,
  },
});
