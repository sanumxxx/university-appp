// app/_layout.js - updated to handle role-based routing
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/auth';
import { View, ActivityIndicator, Text } from 'react-native';

// Create a separate component for navigation that uses the auth context
function RootLayoutNav() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Determine user role for screen options
  const getUserScreenOptions = () => {
    if (!user) return { headerShown: false };

    switch (user.userType) {
      case 'admin':
        return {
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F8F9FF' }
        };
      case 'teacher':
        return {
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#F7F9FC' }
        };
      default: // student
        return {
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#F7F9FC' }
        };
    }
  };

  return (
    <Stack screenOptions={getUserScreenOptions()}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />

      {/* Role-specific sections with clear separation */}
      <Stack.Screen name="(student)" options={{ headerShown: false }} />
      <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
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