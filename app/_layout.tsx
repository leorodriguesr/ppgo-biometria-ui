import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs',
};

import { PendingBiometricsProvider } from '@/src/context/PendingBiometricsContext';
import { initDatabase } from '@/src/services/database';
import { useEffect } from 'react';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void initDatabase();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <PendingBiometricsProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            name="identify-result"
            options={{
              title: 'Detento Identificado',
              headerBackTitle: 'Voltar',
              headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
              headerStyle: { backgroundColor: '#0D9488' },
              headerTintColor: '#fff',
            }}
          />

          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </PendingBiometricsProvider>
    </ThemeProvider>
  );
}
