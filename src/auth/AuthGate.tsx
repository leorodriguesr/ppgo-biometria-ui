import { useAuth } from '@/src/auth/AuthProvider';
import { SsoLoginWebView } from '@/src/auth/SsoLoginWebView';
import { setTokenSso } from '@/src/auth/tokenStorage';
import { BrandWordmark } from '@/src/components/BrandWordmark';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Gate global de autenticação (equivalente ao RequireAuth do agenda).
 * Login SSO em WebView: intercepta access_token no redirect sem abrir o Safari externo.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authData, bootstrapSession, acceptSsoToken, performLogout, clearAuthError } = useAuth();
  const [ssoVisible, setSsoVisible] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoMessage, setSsoMessage] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (authData.deslogar) {
      void performLogout();
    }
  }, [authData.deslogar, performLogout]);

  useEffect(() => {
    if (!authData.sessionExpired) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [authData.sessionExpired]);

  const handleSsoSuccess = async (token: string) => {
    setSsoVisible(false);
    setSsoLoading(true);
    setSsoMessage(null);
    clearAuthError();
    try {
      await setTokenSso(token);
      await acceptSsoToken(token);
    } finally {
      setSsoLoading(false);
    }
  };

  if (!authData.bootstrapped || authData.verificandoToken || authData.deslogando || ssoLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.hint}>
          {authData.deslogando
            ? 'Encerrando sessão…'
            : ssoLoading
              ? 'Salvando autenticação…'
              : 'Verificando autenticação…'}
        </Text>
      </View>
    );
  }

  const hasValidUser = Boolean(
    authData.isAuthenticated && authData.userLogado.token && authData.userLogado.servidor
  );

  if (hasValidUser && !authData.userLogado.semPerfilThisSistema) {
    return (
      <View style={styles.appRoot}>
        <View
          style={styles.appRoot}
          pointerEvents={authData.sessionExpired ? 'none' : 'auto'}
        >
          {children}
        </View>
        <Modal
          visible={authData.sessionExpired}
          transparent
          animationType="fade"
          onRequestClose={() => undefined}
        >
          <View style={styles.sessionBackdrop}>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>Sessão expirada</Text>
              <Text style={styles.sessionBody}>
                Sua sessão expirou. É necessário realizar o login novamente para continuar.
              </Text>
              <TouchableOpacity
                style={styles.sessionButton}
                onPress={() => void performLogout()}
                activeOpacity={0.85}
              >
                <Text style={styles.sessionButtonText}>Efetuar login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (hasValidUser && authData.userLogado.semPerfilThisSistema) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#B45309" />
        <Text style={styles.title}>Sem permissão</Text>
        <Text style={styles.subtitle}>
          Você não tem perfil de acesso para este sistema. Verifique seus perfis no SSO.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => void performLogout()}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Sair</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.loginRoot}>
      <View style={styles.topBar}>
        <Image
          source={require('../../assets/images/logopp.png')}
          style={styles.logoPp}
          resizeMode="contain"
          accessibilityLabel="Polícia Penal"
        />
      </View>

      <View style={styles.loginBody}>
        <View style={styles.hero}>
          <BrandWordmark size={32} />
          <Text style={styles.subtitle}>Sistema de identificação prisional</Text>
        </View>

        {(authData.authError || ssoMessage) && (
          <Text style={styles.error}>{authData.authError || ssoMessage}</Text>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            clearAuthError();
            setSsoMessage(null);
            setSsoVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="log-in-outline" size={22} color="#fff" />
          <Text style={styles.buttonText}>Entrar</Text>
        </TouchableOpacity>
      </View>

      <SsoLoginWebView
        visible={ssoVisible}
        onSuccess={(token) => void handleSsoSuccess(token)}
        onCancel={() => {
          setSsoVisible(false);
        }}
        onError={(message) => {
          setSsoVisible(false);
          setSsoMessage(message);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  sessionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sessionCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  sessionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 22,
  },
  sessionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sessionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 24,
    gap: 12,
  },
  loginRoot: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 4,
  },
  logoPp: {
    width: 120,
    height: 120,
  },
  loginBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 60,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  hint: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: '#007AFF',
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
