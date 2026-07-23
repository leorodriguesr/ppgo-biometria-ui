import { useAuth } from '@/src/auth/AuthProvider';
import { SsoLoginWebView } from '@/src/auth/SsoLoginWebView';
import { setTokenSso } from '@/src/auth/tokenStorage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

  if (authData.isAuthenticated && !authData.userLogado.semPerfilThisSistema) {
    return <>{children}</>;
  }

  if (authData.isAuthenticated && authData.userLogado.semPerfilThisSistema) {
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
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name="finger-print" size={40} color="#fff" />
        </View>
        <Text style={styles.brand}>PPGO Biometria</Text>
        <Text style={styles.subtitle}>Sistema de Identificação Prisional</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: 100,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
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
    lineHeight: 22,
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
    backgroundColor: '#0D9488',
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
