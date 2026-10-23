import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/auth';
import { getProdGoiaspenToken, setProdGoiaspenToken } from '@/src/auth/prodTokenStorage';
import { ambiente } from '@/src/configs/urlsConfig';
import { BrandWordmark } from '@/src/components/BrandWordmark';
import { usePendingBiometrics } from '@/src/context/PendingBiometricsContext';
import {
  clearDatabase,
  getPrisonerById,
  getRecentActivities,
  type ActivityRow,
} from '@/src/services/database';
import { clearIdentifyMatches } from '@/src/services/identifyMatchStore';
import { clearRegisterDraft } from '@/src/services/registerDraftStore';
import { clearUpdatePrisonerDraft } from '@/src/services/updatePrisonerDraft';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const { clearPending } = usePendingBiometrics();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [tokensOpen, setTokensOpen] = useState(false);
  const [goiaspenToken, setGoiaspenToken] = useState('');
  const [savingTokens, setSavingTokens] = useState(false);
  const userName = authData.userLogado.servidor?.nome?.trim() || 'Usuário';

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
            clearRegisterDraft();
            clearUpdatePrisonerDraft();
            clearIdentifyMatches();
            clearPending();
            await loadActivities();
            Alert.alert('Sucesso', 'Banco de dados limpo.');
          },
        },
      ]
    );
  };

  const startNewRegistration = () => {
    clearRegisterDraft();
    clearIdentifyMatches();
    clearPending();
    router.push('/register');
  };

  const startPrisonerUpdate = () => {
    clearUpdatePrisonerDraft();
    clearIdentifyMatches();
    clearPending();
    router.push('/update-prisoner');
  };

  const handleLogout = () => {
    setAccountOpen(false);
    requestLogout();
  };

  const openProdTokens = async () => {
    setGoiaspenToken(await getProdGoiaspenToken());
    setAccountOpen(false);
    setTokensOpen(true);
  };

  const saveProdTokens = async () => {
    if (savingTokens) return;
    setSavingTokens(true);
    try {
      await setProdGoiaspenToken(goiaspenToken);
      setTokensOpen(false);
      Alert.alert('Token salvo', 'A imagem será comparada no GoiásPen de produção.');
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setSavingTokens(false);
    }
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
              <Text style={styles.appName}>GoiásPen</Text>
              <BrandWordmark size={22} />
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setAccountOpen(true)}
          style={styles.accountBtn}
          accessibilityLabel="Conta do usuário"
        >
          <Ionicons name="person-circle-outline" size={30} color="#027B8B" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={accountOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountOpen(false)}
      >
        <Pressable style={styles.accountBackdrop} onPress={() => setAccountOpen(false)}>
          <Pressable style={styles.accountCard} onPress={() => {}}>
            <Text style={styles.accountName}>{userName}</Text>
            {ambiente === 'HOMO' ? (
              <TouchableOpacity
                style={styles.accountTokens}
                onPress={() => void openProdTokens()}
                accessibilityLabel="Token GoiasPen de produção"
              >
                <Text style={styles.accountTokensText}>Token GoiasPen</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.accountLogout}
              onPress={handleLogout}
              accessibilityLabel="Sair"
            >
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.accountLogoutText}>Sair</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={tokensOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTokensOpen(false)}
      >
        <Pressable style={styles.tokensBackdrop} onPress={() => setTokensOpen(false)}>
          <Pressable style={styles.tokensCard} onPress={() => {}}>
            <Text style={styles.tokensTitle}>Token GoiasPen</Text>
            <Text style={styles.tokensHint}>
              Usado só para comparar a imagem no GoiásPen de produção. A biometria continua em homologação.
            </Text>
            <TextInput
              style={styles.tokensInput}
              value={goiaspenToken}
              onChangeText={setGoiaspenToken}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="Cole o token de produção"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.tokensActions}>
              <TouchableOpacity onPress={() => setTokensOpen(false)} disabled={savingTokens}>
                <Text style={styles.tokensCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tokensSave}
                onPress={() => void saveProdTokens()}
                disabled={savingTokens}
              >
                <Text style={styles.tokensSaveText}>{savingTokens ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.mainAction} onPress={() => router.push('/capture')}>
          <Ionicons name="scan-circle" size={64} color="#fff" />
          <ThemedText type="subtitle" style={styles.actionText}>
            IDENTIFICAR PRESO
          </ThemedText>
          <ThemedText style={styles.actionSubtext}>Reconhecimento Facial</ThemedText>
        </TouchableOpacity>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={startNewRegistration}>
            <Ionicons name="person-add" size={32} color="#007AFF" />
            <ThemedText type="defaultSemiBold">Novo Cadastro</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={startPrisonerUpdate}>
            <Ionicons name="sync" size={32} color="#007AFF" />
            <ThemedText type="defaultSemiBold">Atualizar Biometria</ThemedText>
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  logo: {
    width: 110,
    height: 110,
  },
  brandText: {
    flex: 1,
    alignItems: 'flex-start',
    paddingTop: 18,
    gap: 2,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#027B8B',
  },
  accountBtn: {
    marginTop: 14,
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
  accountBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    paddingTop: 112,
    paddingRight: 20,
  },
  accountCard: {
    width: 230,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  accountLogout: {
    alignSelf: 'stretch',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountLogoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  accountTokens: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#027B8B',
    borderRadius: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  accountTokensText: {
    color: '#027B8B',
    fontSize: 14,
    fontWeight: '700',
  },
  tokensBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tokensCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  tokensTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  tokensHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
    marginBottom: 6,
  },
  tokensLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  tokensInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  tokensActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  tokensCancel: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '700',
  },
  tokensSave: {
    backgroundColor: '#027B8B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tokensSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
