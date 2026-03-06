import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAppSettings } from '@/data/app-settings';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { settings } = useAppSettings();
  useKeepAwake(settings.keepScreenAwake ? 'global' : undefined);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
