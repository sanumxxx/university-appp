import { Stack } from 'expo-router';
import { useAuth } from '../../context/auth';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Проверка, является ли пользователь администратором
  if (!user || user.userType !== 'admin') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" options={{ title: 'Панель управления' }} />
      <Stack.Screen name="users" options={{ title: 'Пользователи' }} />
      <Stack.Screen name="schedule" options={{ title: 'Расписание' }} />
      <Stack.Screen name="content" options={{ title: 'Контент' }} />
      <Stack.Screen name="analytics" options={{ title: 'Аналитика' }} />
      <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
    </Stack>
  );
}