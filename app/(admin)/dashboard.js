import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import api from '../../utils/api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    totalLessons: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load dashboard statistics
      const statsResponse = await api.get('/admin/dashboard/stats');
      if (statsResponse.data) {
        setStats(statsResponse.data);
      }

      // Load recent activity
      const activityResponse = await api.get('/admin/activity-log', {
        params: { limit: 5, offset: 0 }
      });

      if (activityResponse.data && activityResponse.data.logs) {
        setRecentActivity(activityResponse.data.logs);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} мин. назад`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)} ч. назад`;
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  };

  // Navigation items
  const navigationItems = [
    {
      title: 'Пользователи',
      icon: 'people',
      route: '/(admin)/users',
      color: '#5F66F2',
      count: stats.totalStudents + stats.totalTeachers,
    },
    {
      title: 'Расписание',
      icon: 'calendar',
      route: '/(admin)/schedule',
      color: '#007AFF',
      count: stats.totalLessons,
    },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Админ-панель</Text>
          <Text style={styles.headerSubtitle}>Привет, {user?.fullName}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(admin)/profile')}
        >
          <Ionicons name="person-circle" size={36} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
          />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#5F66F2' }]}>
            <Ionicons name="school" size={24} color="#5F66F2" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.totalStudents}</Text>
            <Text style={styles.statTitle}>Студенты</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#FF9500' }]}>
            <Ionicons name="people" size={24} color="#FF9500" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.totalTeachers}</Text>
            <Text style={styles.statTitle}>Преподаватели</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#34C759' }]}>
            <Ionicons name="book" size={24} color="#34C759" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.totalCourses}</Text>
            <Text style={styles.statTitle}>Предметы</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#007AFF' }]}>
            <Ionicons name="calendar" size={24} color="#007AFF" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.totalLessons}</Text>
            <Text style={styles.statTitle}>Занятия</Text>
          </View>
        </View>

        {/* Navigation Grid */}
        <Text style={styles.sectionTitle}>Управление</Text>
        <View style={styles.navGrid}>
          {navigationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.navItem}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.navIconContainer, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
                {item.count > 0 && (
                  <View style={[styles.navBadge, { backgroundColor: item.color }]}>
                    <Text style={styles.navBadgeText}>
                      {item.count > 99 ? '99+' : item.count}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.navTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}

          {/* Добавляем плитку профиля */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/(admin)/profile')}
          >
            <View style={[styles.navIconContainer, { backgroundColor: '#FF2D5520' }]}>
              <Ionicons name="person" size={24} color="#FF2D55" />
            </View>
            <Text style={styles.navTitle}>Профиль</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Последние действия</Text>
              <TouchableOpacity onPress={() => router.push('/(admin)/activity')}>
                <Text style={styles.seeAllText}>Все</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.activityList}>
              {recentActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.highlightText}>{activity.admin_name}</Text> {activity.action}
                    </Text>
                    <Text style={styles.activityTime}>{formatTimestamp(activity.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#151940',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#151940',
  },
  statTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151940',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  navItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  navIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  navBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#151940',
  },
  activitySection: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#151940',
    lineHeight: 20,
  },
  highlightText: {
    fontWeight: '600',
    color: '#007AFF',
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
});