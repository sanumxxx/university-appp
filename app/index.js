import { View, ActivityIndicator } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../context/auth';

export default function Index() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF'
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Если пользователь авторизован - перенаправляем на главный экран
  if (user) {
    return <Redirect href="/(tabs)/schedule" />;
  }

  // Если пользователь не авторизован - перенаправляем на экран входа
  return <Redirect href="/auth" />;
}