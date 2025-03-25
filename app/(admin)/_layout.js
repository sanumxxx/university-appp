import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../context/auth';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Admin sidebar navigation component
function AdminSidebar({ onClose, currentPath }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Navigation items for the sidebar
  const navItems = [
    {
      name: 'dashboard',
      title: 'Панель управления',
      icon: 'grid-outline',
      path: '/(admin)/dashboard'
    },
    {
      name: 'users',
      title: 'Пользователи',
      icon: 'people-outline',
      path: '/(admin)/users'
    },
    {
      name: 'schedule',
      title: 'Расписание',
      icon: 'calendar-outline',
      path: '/(admin)/schedule'
    },
    {
      name: 'profile',
      title: 'Профиль',
      icon: 'person-outline',
      path: '/(admin)/profile'
    }
  ];

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top }]}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>Панель администратора</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Text style={styles.userInitials}>
            {user?.fullName?.substring(0, 2).toUpperCase() || 'A'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.fullName || 'Администратор'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      <View style={styles.navItems}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.navItem,
              currentPath.includes(item.path) && styles.navItemActive
            ]}
            onPress={() => {
              onClose();
              router.push(item.path);
            }}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={currentPath.includes(item.path) ? '#5F66F2' : '#FFFFFF'}
            />
            <Text
              style={[
                styles.navItemText,
                currentPath.includes(item.path) && styles.navItemTextActive
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const currentPath = usePathname();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect non-admin users to home
  if (!user || user.userType !== 'admin') {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      {/* Conditional sidebar rendering */}
      {sidebarVisible && (
        <AdminSidebar
          onClose={() => setSidebarVisible(false)}
          currentPath={currentPath}
        />
      )}

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="dashboard" options={{ title: 'Панель управления' }} />
        <Stack.Screen name="users" options={{ title: 'Пользователи' }} />
        <Stack.Screen name="schedule" options={{ title: 'Расписание' }} />
        <Stack.Screen name="profile" options={{ title: 'Профиль администратора' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#151940',
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5F66F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInitials: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  navItems: {
    marginTop: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  navItemActive: {
    backgroundColor: '#FFFFFF',
  },
  navItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  navItemTextActive: {
    color: '#5F66F2',
  },
});