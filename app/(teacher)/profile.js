// app/(teacher)/profile.js
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TeacherProfile() {
  const { user, logout } = useAuth();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);

  // Загрузка настроек и статистики
  useEffect(() => {
    loadSettings();
    loadTeacherStats();
  }, []);

  const loadSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('pushNotifications');
      setPushNotifications(notifications !== 'false');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Загрузка статистики преподавателя
  const loadTeacherStats = async () => {
    try {
      // В реальном приложении здесь был бы API запрос
      // Здесь используем заглушку для демонстрации
      setStudentCount(85); // Пример данных
      setGroupCount(4);    // Пример данных
    } catch (error) {
      console.error('Error loading teacher stats:', error);
    }
  };

  // Если пользователь не авторизован, показываем загрузку
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        {
          text: 'Отмена',
          style: 'cancel'
        },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await logout();
              router.replace('/');
            } catch (error) {
              console.error('Logout error:', error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const toggleNotifications = async (value) => {
    try {
      await AsyncStorage.setItem('pushNotifications', value.toString());
      setPushNotifications(value);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Получаем имя преподавателя (либо из teacher, либо из fullName)
  const teacherName = user.teacher || user.fullName || user.full_name;

  // Получаем первые буквы имени для аватара
  const getInitials = () => {
    const nameParts = teacherName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return teacherName.charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Профиль преподавателя</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Карточка профиля */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{teacherName}</Text>
            <Text style={styles.userRole}>Преподаватель</Text>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={16} color="#8E8E93" />
              <Text style={styles.infoText}>{user.email}</Text>
            </View>
          </View>

          {/* Статистика преподавателя */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{studentCount}</Text>
              <Text style={styles.statLabel}>Студентов</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{groupCount}</Text>
              <Text style={styles.statLabel}>Групп</Text>
            </View>
          </View>
        </View>

        {/* Учебная информация */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Управление обучением</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => router.push('/(teacher)/schedule')}
            >
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Моё расписание</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => router.push('/(teacher)/grades')}
            >
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#FF9500' }]}>
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Журнал успеваемости</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => {
                Alert.alert('Список студентов', 'Здесь будет список всех студентов, которых вы обучаете');
              }}
            >
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="people-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Мои студенты</Text>
              </View>
              <Text style={styles.itemValue}>{studentCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="school-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Учебные группы</Text>
              </View>
              <Text style={styles.itemValue}>{groupCount}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Учетная запись */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Учетная запись</Text>

          <View style={styles.card}>
            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Личные данные</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Изменить пароль</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#AF52DE' }]}>
                  <Ionicons name="book-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Мои предметы</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Настройки */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Настройки</Text>

          <View style={styles.card}>
            <View style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#FF9500' }]}>
                  <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Push-уведомления</Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                ios_backgroundColor="#E5E5EA"
              />
            </View>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="moon-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Темная тема</Text>
              </View>
              <Text style={styles.itemNote}>Скоро</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="language-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Язык</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemValue}>Русский</Text>
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Информация */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Информация</Text>

          <View style={styles.card}>
            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#FF2D55' }]}>
                  <Ionicons name="help-circle-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Поддержка</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#FF9500' }]}>
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>Условия использования</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconBg, { backgroundColor: '#5AC8FA' }]}>
                  <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.itemText}>О приложении</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Кнопка выхода */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.logoutText}>Выйти</Text>
          )}
        </TouchableOpacity>

        {/* Версия приложения */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Версия alpha-0.4.3 25.03.2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF9500', // Оранжевый цвет для преподавателей
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 17,
    color: '#8E8E93',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  infoText: {
    fontSize: 15,
    color: '#8E8E93',
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  statBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'ios' ? 10 : 0,
    overflow: 'hidden',
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemText: {
    fontSize: 16,
    color: '#000000',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemValue: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 6,
  },
  itemNote: {
    fontSize: 15,
    color: '#8E8E93',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Platform.OS === 'ios' ? 10 : 0,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});