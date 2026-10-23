import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import 'react-native-reanimated';

import { AuthGate, AuthProvider } from '@/src/auth';
import { PendingBiometricsProvider } from '@/src/context/PendingBiometricsContext';
import { initDatabase } from '@/src/services/database';
import { getFacialSearchPurpose } from '@/src/services/identifyMatchStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

const headerBackground = { backgroundColor: '#0D9488' };

function HeaderTitle({
  children,
  tintColor,
  fontSize,
}: {
  children: ReactNode;
  tintColor?: string;
  fontSize: number;
}) {
  return (
    <View pointerEvents="none">
      <Text
        numberOfLines={1}
        style={{ color: tintColor ?? '#fff', fontWeight: 'bold', fontSize }}
      >
        {children}
      </Text>
    </View>
  );
}

function BackButton({ tintColor = '#111827' }: { tintColor?: string }) {
  const pathname = usePathname();

  const goBack = () => {
    if (pathname === '/update-prisoner' || pathname === '/register') {
      router.dismissAll();
      return;
    }
    if (pathname === '/identify-matches' && getFacialSearchPurpose() === 'update') {
      router.dismissTo('/update-prisoner');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={{ top: 14, bottom: 14, left: 10, right: 14 }}
      onPress={goBack}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 22,
        marginLeft: -6,
        paddingRight: 8,
      }}
    >
      <Ionicons name="chevron-back" size={28} color={tintColor} />
      <Text style={{ color: tintColor, fontSize: 17 }}>Voltar</Text>
    </Pressable>
  );
}

function screenHeader(title: string, fontSize: number) {
  return {
    title,
    headerBackTitle: 'Voltar',
    headerTitle: ({ children, tintColor }: { children: string; tintColor?: string }) => (
      <HeaderTitle tintColor={tintColor} fontSize={fontSize}>
        {children}
      </HeaderTitle>
    ),
    headerTitleStyle: { fontWeight: 'bold' as const, fontSize },
    headerStyle: headerBackground,
    headerTintColor: '#fff',
  };
}

export default function RootLayout() {
  useEffect(() => {
    void initDatabase();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        {/* App é light — ícones escuros na status bar (auto segue o dark mode do iOS e deixa branco) */}
        <StatusBar style="dark" />
        <AuthGate>
          <PendingBiometricsProvider>
            <Stack
              screenOptions={{
                headerBackButtonDisplayMode: 'minimal',
                headerBackVisible: false,
                headerLeft: ({ tintColor, canGoBack }) => {
                  if (!canGoBack) return null;
                  return <BackButton tintColor={tintColor} />;
                },
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: 'Voltar', headerBackTitle: 'Voltar' }}
              />
              <Stack.Screen name="register" options={screenHeader('Novo Cadastro', 20)} />
              <Stack.Screen name="capture" options={screenHeader('Captura de Biometria', 20)} />
              <Stack.Screen name="bust-capture" options={screenHeader('Foto do Detento', 18)} />
              <Stack.Screen name="mark-capture" options={screenHeader('Marcas e Tatuagens', 18)} />
              <Stack.Screen name="identify-result" options={screenHeader('Detento', 18)} />
              <Stack.Screen
                name="identify-matches"
                options={screenHeader('Possíveis correspondências', 18)}
              />
              <Stack.Screen name="update-prisoner" options={screenHeader('Atualizar Biometria', 20)} />
              <Stack.Screen name="prisoners" options={screenHeader('Detentos Cadastrados', 18)} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </PendingBiometricsProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
