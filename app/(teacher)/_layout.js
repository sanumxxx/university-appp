// app/(teacher)/_layout.js
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';

export default function TeacherTabsLayout() {
  const { user, isLoading } = useAuth();

  // Check if user is logged in and is a teacher
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect non-teachers
  if (!user || user.userType !== 'teacher') {
    if (user) {
      // Redirect to the appropriate section based on user type
      if (user.userType === 'admin') {
        router.replace('/(admin)/dashboard');
      } else if (user.userType === 'student') {
        router.replace('/(student)/schedule');
      }
    } else {
      router.replace('/auth');
    }
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, fontSize: 16, color: '#8E8E93' }}>Redirecting...</Text>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#E5E5EA',
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Расписание',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Новости',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'newspaper' : 'newspaper-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Мероприятия',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'star' : 'star-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="grades"
        options={{
          title: 'Журнал',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}