import { PushEvents } from '../components/PushEvents';
import { OfflineSync } from '../components/OfflineSync';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers, useSession } from '../providers/session';
import { colors } from '../theme';
import { Button, ErrorNotice, Screen } from '../components/ui';

function Routes() {
  const { token, loading, recoveryError, restore, user } = useSession();
  const pathname = usePathname();
  if (loading && pathname !== '/privacy') return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Restoring your account" /></View>;
  if (recoveryError && pathname !== '/privacy') return <Screen><ErrorNotice error={recoveryError} /><Button title="Reconnect" onPress={() => void restore()} /></Screen>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Protected guard={!token}><Stack.Screen name="sign-in" /><Stack.Screen name="forgot-password" /><Stack.Screen name="register" /><Stack.Screen name="activate" /><Stack.Screen name="reset-password" /></Stack.Protected>
    <Stack.Protected guard={!!token && !!user?.mustChangePassword}><Stack.Screen name="change-password" /></Stack.Protected>
    <Stack.Protected guard={!!token && !user?.mustChangePassword && user?.role === 'MEMBER'}><Stack.Screen name="(tabs)" /><Stack.Screen name="payments" /><Stack.Screen name="updates" /><Stack.Screen name="diet" /><Stack.Screen name="progress" /><Stack.Screen name="fitness" /><Stack.Screen name="attendance" /></Stack.Protected>
    <Stack.Protected guard={!!token && !user?.mustChangePassword && user?.role === 'TRAINER'}><Stack.Screen name="trainer" /></Stack.Protected>
    <Stack.Protected guard={!!token && !user?.mustChangePassword && (user?.role === 'OWNER' || user?.role === 'RECEPTIONIST')}><Stack.Screen name="admin" /></Stack.Protected>
    <Stack.Protected guard={!!token && !user?.mustChangePassword}><Stack.Screen name="staff-account" /></Stack.Protected>
    <Stack.Screen name="privacy" />
  </Stack>;
}
export default function RootLayout() {
  const [loaded, error] = useFonts({ Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, BarlowCondensed_700Bold });
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
  if (error) return <View style={{ flex: 1, padding: 30, justifyContent: 'center' }}><Text>Unable to load app fonts. Please restart the app.</Text></View>;
  return <SafeAreaProvider><StatusBar style="dark" /><Providers><OfflineSync /><PushEvents /><Routes /></Providers></SafeAreaProvider>;
}



