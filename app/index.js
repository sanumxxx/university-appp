// app/index.js - updated with role-based redirection
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
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

  // If not logged in, redirect to auth
  if (!user) {
    return <Redirect href="/auth" />;
  }

  // Role-based redirection
  switch (user.userType) {
    case 'admin':
      return <Redirect href="/(admin)/dashboard" />;
    case 'teacher':
      return <Redirect href="/(teacher)/schedule" />;
    case 'student':
    default:
      return <Redirect href="/(student)/schedule" />;
  }
}