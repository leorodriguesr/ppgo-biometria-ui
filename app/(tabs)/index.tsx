import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { clearDatabase } from '@/src/services/database';
import { Alert } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  const handleClearDB = async () => {
    Alert.alert(
      'Limpar Banco Local',
      'Tem certeza que deseja apagar todos os presos do dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            await clearDatabase();
            Alert.alert('Sucesso', 'Banco de dados limpo.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <TouchableOpacity onLongPress={handleClearDB}>
            <ThemedText type="title">PPGO Biometria</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.subtitle}>Sistema de Identificação Prisional</ThemedText>
        </View>
        <Ionicons name="shield-checkmark" size={32} color="#007AFF" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.mainAction}
          onPress={() => router.push('/capture')}
        >
          <Ionicons name="scan-circle" size={64} color="#fff" />
          <ThemedText type="subtitle" style={styles.actionText}>IDENTIFICAR PRESO</ThemedText>
          <ThemedText style={styles.actionSubtext}>Reconhecimento Facial</ThemedText>
        </TouchableOpacity>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/register')}>
            <Ionicons name="person-add" size={32} color="#007AFF" />
            <ThemedText type="defaultSemiBold">Novo Cadastro</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/prisoners')}>
            <Ionicons name="search" size={32} color="#007AFF" />
            <ThemedText type="defaultSemiBold">Buscar Detento</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedView style={styles.recentContainer}>
          <ThemedText type="subtitle">Atividades Recentes</ThemedText>
          <View style={styles.recentItem}>
            <Ionicons name="alert-circle" size={24} color="#FF9500" />
            <View style={styles.recentInfo}>
              <ThemedText type="defaultSemiBold">Tentativa de Acesso</ThemedText>
              <ThemedText style={styles.timestamp}>Hoje, 10:42</ThemedText>
            </View>
          </View>
        </ThemedView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mainAction: {
    backgroundColor: '#007AFF', // Police Blue
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 20,
  },
  actionSubtext: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    display: 'flex',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recentContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 15,
  },
  recentInfo: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.5,
  },
});
