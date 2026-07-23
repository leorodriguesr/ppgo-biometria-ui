import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthGate, AuthProvider } from '@/src/auth';
import { PendingBiometricsProvider } from '@/src/context/PendingBiometricsContext';
import { initDatabase } from '@/src/services/database';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

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
            <Stack>
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: 'Voltar', headerBackTitle: 'Voltar' }}
              />
              <Stack.Screen
                name="register"
                options={{
                  title: 'Novo Cadastro',
                  headerBackTitle: 'Voltar',
                  headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
                  headerStyle: { backgroundColor: '#0D9488' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen
                name="capture"
                options={{
                  title: 'Captura de Biometria',
                  headerBackTitle: 'Voltar',
                  headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
                  headerStyle: { backgroundColor: '#0D9488' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen
                name="bust-capture"
                options={{
                  title: 'Foto do Detento',
                  headerBackTitle: 'Voltar',
                  headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
                  headerStyle: { backgroundColor: '#0D9488' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen
                name="mark-capture"
                options={{
                  title: 'Marcas e Tatuagens',
                  headerBackTitle: 'Voltar',
                  headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
                  headerStyle: { backgroundColor: '#0D9488' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen
                name="identify-result"
                options={{
                  title: 'Detento',
                  headerBackTitle: 'Voltar',
                  headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
                  headerStyle: { backgroundColor: '#0D9488' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen
                name="prisoners"
                options={{
                  title: 'Detentos Cadastrados',
                  headerBackTitle: 'Voltar',
                  headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
                  headerStyle: { backgroundColor: '#0D9488' },
                  headerTintColor: '#fff',
                }}
              />

              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </PendingBiometricsProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
