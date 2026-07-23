import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/auth';
import {
  clearDatabase,
  getPrisonerById,
  getRecentActivities,
  type ActivityRow,
} from '@/src/services/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoje, ${time}`;
  return `${date.toLocaleDateString('pt-BR')} ${time}`;
}

function activityMeta(item: ActivityRow): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
} {
  if (item.activity_type === 'register') {
    return {
      icon: 'person-outline',
      color: '#2563EB',
      title: item.prisoner_name
        ? `Cadastro: ${item.prisoner_name}`
        : 'Cadastro',
    };
  }
  if (item.activity_type === 'identify') {
    return {
      icon: 'scan',
      color: '#2563EB',
      title: item.prisoner_name
        ? `Identificado: ${item.prisoner_name}`
        : 'Preso identificado',
    };
  }
  return {
    icon: 'alert-circle',
    color: '#F59E0B',
    title: 'Identificação sem correspondência',
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { authData, requestLogout } = useAuth();
  const userName = authData.userLogado.servidor?.nome;
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const loadActivities = useCallback(async () => {
    try {
      const rows = await getRecentActivities(8);
      const withNames = await Promise.all(
        rows.map(async (row) => {
          if (row.prisoner_name || row.prisoner_id == null) return row;
          const prisoner = await getPrisonerById(row.prisoner_id);
          return prisoner?.name
            ? { ...row, prisoner_name: prisoner.name }
            : row;
        })
      );
      setActivities(withNames);
    } catch (error) {
      console.warn('Falha ao carregar atividades:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActivities();
    }, [loadActivities])
  );

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
            await loadActivities();
            Alert.alert('Sucesso', 'Banco de dados limpo.');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar a sessão SSO?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => requestLogout() },
    ]);
  };

  const openActivity = (item: ActivityRow) => {
    if (item.prisoner_id != null && item.activity_type !== 'identify_fail') {
      router.push({
        pathname: '/identify-result',
        params: {
          prisonerId: String(item.prisoner_id),
          from: 'search',
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <TouchableOpacity style={styles.brandRow} onLongPress={handleClearDB} activeOpacity={1}>
            <Image
              source={require('../../assets/images/logopp.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.brandText}>
              <ThemedText type="title">PPGO Biometria</ThemedText>
              <ThemedText style={styles.subtitle}>
                {userName ? `Olá, ${userName}` : 'Sistema de Identificação Prisional'}
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} accessibilityLabel="Sair">
          <Ionicons name="log-out-outline" size={26} color="#0D9488" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.mainAction} onPress={() => router.push('/capture')}>
          <Ionicons name="scan-circle" size={64} color="#fff" />
          <ThemedText type="subtitle" style={styles.actionText}>
            IDENTIFICAR PRESO
          </ThemedText>
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
          {activities.length === 0 ? (
            <ThemedText style={styles.emptyRecent}>
              Nenhuma atividade ainda. Cadastros e identificações aparecerão aqui.
            </ThemedText>
          ) : (
            activities.map((item) => {
              const meta = activityMeta(item);
              const canOpen = item.prisoner_id != null && item.activity_type !== 'identify_fail';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recentItem}
                  onPress={() => openActivity(item)}
                  disabled={!canOpen}
                  activeOpacity={canOpen ? 0.7 : 1}
                >
                  <Ionicons name={meta.icon} size={24} color={meta.color} />
                  <View style={styles.recentInfo}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                      {meta.title}
                    </ThemedText>
                    <ThemedText style={styles.timestamp}>
                      {formatActivityTime(item.created_at)}
                    </ThemedText>
                  </View>
                  {canOpen ? (
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ThemedView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 52,
    height: 52,
  },
  brandText: {
    flex: 1,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  mainAction: {
    backgroundColor: '#007AFF',
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
  emptyRecent: {
    marginTop: 14,
    fontSize: 14,
    color: '#9CA3AF',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 15,
    gap: 12,
  },
  recentInfo: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
});
