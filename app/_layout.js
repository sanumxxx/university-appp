// app/_layout.js - updated version
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/auth';
import { View, ActivityIndicator } from 'react-native';

// Create a separate component for navigation
function RootLayoutNav() {
  const { isLoading, isAdmin, user } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Customize screenOptions based on user type for better visual distinction
  const getScreenOptions = () => {
    if (isAdmin) {
      return {
        headerShown: false,
        // Use different animation for admin screens for visual distinction
        animation: 'slide_from_right',
        // Admin-specific styling if needed
        contentStyle: { backgroundColor: '#F8F9FF' }
      };
    }

    return {
      headerShown: false
    };
  };

  return (
    <Stack screenOptions={getScreenOptions()}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="(tabs)"
        // Prevent admin from accessing student/teacher tabs
        listeners={{
          beforeRemove: (e) => {
            if (isAdmin) {
              // Prevent navigation to tabs for admin users
              e.preventDefault();
              // Could redirect to admin dashboard instead
              router.replace('/(admin)/dashboard');
            }
          }
        }}
      />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="auth" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}