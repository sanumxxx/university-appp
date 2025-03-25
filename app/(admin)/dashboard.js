import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert
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
    activeUsers: 0,
    pendingRequests: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load dashboard statistics from API
      const statsResponse = await api.get('/admin/dashboard/stats');

      if (statsResponse.data) {
        setStats(statsResponse.data);
      } else {
        // Fallback to default values if API fails
        setStats({
          totalStudents: 0,
          totalTeachers: 0,
          totalCourses: 0,
          totalLessons: 0,
          activeUsers: 0,
          pendingRequests: 0,
        });
      }

      // Load recent activity from API
      const activityResponse = await api.get('/admin/activity-log', {
        params: { limit: 10, offset: 0 }
      });

      if (activityResponse.data && activityResponse.data.logs) {
        setRecentActivity(activityResponse.data.logs);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить данные дашборда. Проверьте подключение к интернету.'
      );

      // Set default values on error
      setStats({
        totalStudents: 0,
        totalTeachers: 0,
        totalCourses: 0,
        totalLessons: 0,
        activeUsers: 0,
        pendingRequests: 0,
      });
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
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} минут назад`;
    } else if (diffHours < 24) {
      return `${diffHours} часов назад`;
    } else if (diffDays < 7) {
      return `${diffDays} дней назад`;
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };

  const getUserCount = () => {
    return stats.totalStudents + stats.totalTeachers;
  };

  const navigationItems = [
    {
      title: 'Пользователи',
      icon: 'people',
      route: '/(admin)/users',
      color: '#5F66F2',
      count: getUserCount(),
      description: 'Управление студентами и преподавателями'
    },
    {
      title: 'Расписание',
      icon: 'calendar',
      route: '/(admin)/schedule',
      color: '#007AFF',
      count: stats.totalLessons,
      description: 'Управление занятиями и аудиториями'
    },
    {
      title: 'Контент',
      icon: 'newspaper',
      route: '/(admin)/content',
      color: '#FF9500',
      count: null,
      description: 'Новости, события и уведомления'
    },
    {
      title: 'Аналитика',
      icon: 'analytics',
      route: '/(admin)/analytics',
      color: '#34C759',
      count: null,
      description: 'Статистика и отчеты'
    },
    {
      title: 'Запросы',
      icon: 'mail-unread',
      route: '/(admin)/requests',
      color: '#FF3B30',
      count: stats.pendingRequests,
      description: 'Заявки и обращения пользователей'
    },
    {
      title: 'Настройки',
      icon: 'settings',
      route: '/(admin)/settings',
      color: '#8E8E93',
      count: null,
      description: 'Параметры системы'
    },
  ];

  const renderStatCard = (title, value, icon, color) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIconContainer}>
        <View style={[styles.statIconBackground, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Панель управления</Text>
          <Text style={styles.headerSubtitle}>Добро пожаловать, {user?.fullName}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
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
        <View style={styles.statsContainer}>
          {renderStatCard('Студенты', stats.totalStudents, 'school', '#5F66F2')}
          {renderStatCard('Преподаватели', stats.totalTeachers, 'people', '#FF9500')}
          {renderStatCard('Предметы', stats.totalCourses, 'book', '#34C759')}
          {renderStatCard('Активные пользователи', stats.activeUsers, 'pulse', '#007AFF')}
        </View>

        <Text style={styles.sectionTitle}>Управление системой</Text>

        <View style={styles.navGrid}>
          {navigationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.navItem}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.navIconContainer, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
                {item.count !== null && (
                  <View style={[styles.navBadge, { backgroundColor: item.color }]}>
                    <Text style={styles.navBadgeText}>
                      {item.count > 99 ? '99+' : item.count}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.navTitle}>{item.title}</Text>
              <Text style={styles.navDescription}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Последние действия</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/activity')}>
              <Text style={styles.seeAllText}>Смотреть все</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={[styles.activityIcon, {
                    backgroundColor: activity.action.includes('создание') ? '#34C75920' :
                                     activity.action.includes('удаление') ? '#FF3B3020' :
                                     activity.action.includes('обновление') ? '#FF950020' :
                                     '#5F66F220'
                  }]}>
                    <Ionicons
                      name={
                        activity.action.includes('пользователя') ? 'person' :
                        activity.action.includes('расписания') ? 'calendar' :
                        activity.action.includes('настройки') ? 'settings' :
                        'document-text'
                      }
                      size={20}
                      color={
                        activity.action.includes('создание') ? '#34C759' :
                        activity.action.includes('удаление') ? '#FF3B30' :
                        activity.action.includes('обновление') ? '#FF9500' :
                        '#5F66F2'
                      }
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.highlightText}>{activity.admin_name}</Text> {activity.action}
                      {activity.details && <Text> - {activity.details}</Text>}
                    </Text>
                    <Text style={styles.activityTime}>{formatTimestamp(activity.created_at)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivity}>
                <Text style={styles.emptyActivityText}>Нет последних действий</Text>
              </View>
            )}
          </View>
        </View>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    marginRight: 12,
  },
  statIconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
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
  },
  navIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
    marginBottom: 6,
  },
  navDescription: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
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
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  emptyActivity: {
    padding: 20,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 14,
    color: '#8E8E93',
  }
});