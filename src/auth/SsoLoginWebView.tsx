import { getUrlLogin } from '@/src/auth/AuthApi';
import { extractAccessToken } from '@/src/auth/ssoLogin';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

type Props = {
  visible: boolean;
  onSuccess: (token: string) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
};

/**
 * Lê window.location.href (inclui #access_token=...) e envia ao RN.
 * Polling cobre o caso em que o hash chega depois do load.
 */
const INJECT_CAPTURE_TOKEN = `
(function() {
  if (window.__ppgoSsoHooked) return;
  window.__ppgoSsoHooked = true;
  function post() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'href',
        href: String(window.location.href || '')
      }));
    } catch (e) {}
  }
  post();
  window.addEventListener('hashchange', post);
  document.addEventListener('DOMContentLoaded', post);
  var n = 0;
  var id = setInterval(function() {
    post();
    n += 1;
    if (n >= 40 || String(window.location.href).indexOf('access_token') !== -1) {
      clearInterval(id);
    }
  }, 250);
})();
true;
`;

/**
 * Login SSO em WebView dentro do app.
 * Sessão incognito a cada abertura para o 2º login não travar com cookie antigo.
 */
export function SsoLoginWebView({ visible, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [instanceKey, setInstanceKey] = useState(0);
  const [loginUrl, setLoginUrl] = useState(() => getUrlLogin());
  const capturedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    capturedRef.current = false;
    setLoading(true);
    setLoginUrl(getUrlLogin());
    setInstanceKey((k) => k + 1);

    // Fallback: nunca deixar o overlay infinito se onLoadEnd não disparar
    const timeout = setTimeout(() => setLoading(false), 6000);
    return () => clearTimeout(timeout);
  }, [visible]);

  const finishWithToken = useCallback(
    (token: string) => {
      if (capturedRef.current) return;
      capturedRef.current = true;
      setLoading(false);
      onSuccess(token);
    },
    [onSuccess]
  );

  const tryCaptureFromUrl = useCallback(
    (url: string): boolean => {
      if (!url || capturedRef.current) return false;
      const token = extractAccessToken(url);
      if (!token) return false;
      finishWithToken(token);
      return true;
    },
    [finishWithToken]
  );

  const handleNav = useCallback(
    (nav: WebViewNavigation) => {
      if (!nav.loading) {
        setLoading(false);
      }
      tryCaptureFromUrl(nav.url);
    },
    [tryCaptureFromUrl]
  );

  const handleShouldStart = useCallback(
    (request: { url: string }) => {
      if (tryCaptureFromUrl(request.url)) {
        return false;
      }
      return true;
    },
    [tryCaptureFromUrl]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as { type?: string; href?: string };
        if (data?.href) {
          tryCaptureFromUrl(data.href);
        }
      } catch {
        tryCaptureFromUrl(event.nativeEvent.data);
      }
    },
    [tryCaptureFromUrl]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {/* Modal cria outra árvore — precisa de SafeAreaProvider próprio */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Login SSO</Text>
            <TouchableOpacity
              onPress={() => {
                capturedRef.current = false;
                onCancel();
              }}
              hitSlop={12}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.webWrap}>
            {loading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#0D9488" />
                <Text style={styles.loadingText}>Carregando autenticação…</Text>
              </View>
            )}
            {visible && (
              <WebView
                key={instanceKey}
                source={{ uri: loginUrl }}
                onLoadEnd={() => setLoading(false)}
                onNavigationStateChange={handleNav}
                onShouldStartLoadWithRequest={handleShouldStart}
                onMessage={handleMessage}
                injectedJavaScript={INJECT_CAPTURE_TOKEN}
                injectedJavaScriptBeforeContentLoaded={INJECT_CAPTURE_TOKEN}
                // Sessão limpa a cada abertura (evita travar no 2º login com cookie)
                incognito
                cacheEnabled={false}
                sharedCookiesEnabled={false}
                thirdPartyCookiesEnabled={false}
                setSupportMultipleWindows={false}
                javaScriptEnabled
                style={styles.webview}
              />
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  webWrap: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,242,247,0.92)',
    gap: 10,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
