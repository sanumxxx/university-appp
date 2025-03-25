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
    activeUsers: 0,
    pendingRequests: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      // В реальном приложении здесь будет API запрос
      // const response = await api.get('/admin/dashboard');
      // setStats(response.data);

      // Демо-данные
      setTimeout(() => {
        setStats({
          totalStudents: 2547,
          totalTeachers: 126,
          totalCourses: 84,
          totalLessons: 1253,
          activeUsers: 734,
          pendingRequests: 12,
        });
        setIsLoading(false);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const navigationItems = [
    {
      title: 'Пользователи',
      icon: 'people',
      route: '/users',
      color: '#5F66F2',
      count: stats.totalStudents + stats.totalTeachers,
      description: 'Управление студентами и преподавателями'
    },
    {
      title: 'Расписание',
      icon: 'calendar',
      route: '/schedule',
      color: '#007AFF',
      count: stats.totalLessons,
      description: 'Управление занятиями и аудиториями'
    },
    {
      title: 'Контент',
      icon: 'newspaper',
      route: '/content',
      color: '#FF9500',
      count: null,
      description: 'Новости, события и уведомления'
    },
    {
      title: 'Аналитика',
      icon: 'analytics',
      route: '/analytics',
      color: '#34C759',
      count: null,
      description: 'Статистика и отчеты'
    },
    {
      title: 'Запросы',
      icon: 'mail-unread',
      route: '/requests',
      color: '#FF3B30',
      count: stats.pendingRequests,
      description: 'Заявки и обращения пользователей'
    },
    {
      title: 'Настройки',
      icon: 'settings',
      route: '/settings',
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
          {renderStatCard('Курсы', stats.totalCourses, 'book', '#34C759')}
          {renderStatCard('Активные пользователи', stats.activeUsers, 'pulse', '#007AFF')}
        </View>

        <Text style={styles.sectionTitle}>Управление системой</Text>

        <View style={styles.navGrid}>
          {navigationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.navItem}
              onPress={() => router.push(`/(admin)${item.route}`)}
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
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Смотреть все</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: '#5F66F220' }]}>
                <Ionicons name="person-add" size={20} color="#5F66F2" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  <Text style={styles.highlightText}>Иванов И.А.</Text> зарегистрировался в системе
                </Text>
                <Text style={styles.activityTime}>15 минут назад</Text>
              </View>
            </View>

            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: '#34C75920' }]}>
                <Ionicons name="calendar" size={20} color="#34C759" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  Обновлено расписание для группы <Text style={styles.highlightText}>2211-0101.1</Text>
                </Text>
                <Text style={styles.activityTime}>2 часа назад</Text>
              </View>
            </View>

            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: '#FF950020' }]}>
                <Ionicons name="newspaper" size={20} color="#FF9500" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  Опубликована новая новость <Text style={styles.highlightText}>Научная конференция...</Text>
                </Text>
                <Text style={styles.activityTime}>вчера, 15:43</Text>
              </View>
            </View>
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
});