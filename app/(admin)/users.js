// app/(admin)/users.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../utils/api';

export default function UsersManagement() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'student', 'teacher', 'admin'
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Демо-данные для пользователей
  const demoUsers = [
    { id: 1, fullName: 'Иванов Иван Иванович', email: 'ivanov@example.com', userType: 'student', group: '2211-0101.1', status: 'active', lastActive: '2025-03-24T10:15:00' },
    { id: 2, fullName: 'Петров Петр Петрович', email: 'petrov@example.com', userType: 'student', group: '2211-0101.1', status: 'active', lastActive: '2025-03-24T09:30:00' },
    { id: 3, fullName: 'Сидорова Анна Владимировна', email: 'sidorova@example.com', userType: 'teacher', teacherName: 'Сидорова А.В.', status: 'active', lastActive: '2025-03-24T11:45:00' },
    { id: 4, fullName: 'Козлов Дмитрий Сергеевич', email: 'kozlov@example.com', userType: 'teacher', teacherName: 'Козлов Д.С.', status: 'inactive', lastActive: '2025-03-20T14:20:00' },
    { id: 5, fullName: 'Новикова Елена Александровна', email: 'novikova@example.com', userType: 'admin', status: 'active', lastActive: '2025-03-24T08:15:00' },
    { id: 6, fullName: 'Морозов Александр Игоревич', email: 'morozov@example.com', userType: 'student', group: '2211-0102.1', status: 'blocked', lastActive: '2025-03-15T16:40:00' },
    { id: 7, fullName: 'Соколова Мария Николаевна', email: 'sokolova@example.com', userType: 'student', group: '2212-0101.1', status: 'active', lastActive: '2025-03-23T12:10:00' },
    { id: 8, fullName: 'Кузнецов Владимир Андреевич', email: 'kuznetsov@example.com', userType: 'teacher', teacherName: 'Кузнецов В.А.', status: 'active', lastActive: '2025-03-22T10:05:00' },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, filter, users]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      // В реальном приложении здесь будет API запрос
      // const response = await api.get('/admin/users');
      // setUsers(response.data);

      // Используем демо-данные
      setTimeout(() => {
        setUsers(demoUsers);
        setIsLoading(false);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading users:', error);
      setIsLoading(false);
      setRefreshing(false);
      Alert.alert('Ошибка', 'Не удалось загрузить список пользователей');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Фильтрация по типу пользователя
    if (filter !== 'all') {
      filtered = filtered.filter(user => user.userType === filter);
    }

    // Поиск по имени или email
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.group && user.group.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.teacherName && user.teacherName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredUsers(filtered);
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setModalVisible(true);
  };

  const handleStatusChange = (newStatus) => {
    // В реальном приложении здесь будет API запрос
    // api.patch(`/admin/users/${selectedUser.id}`, { status: newStatus })

    // Обновляем локальный список
    const updatedUsers = users.map(u =>
      u.id === selectedUser.id ? { ...u, status: newStatus } : u
    );

    setUsers(updatedUsers);
    setModalVisible(false);

    Alert.alert(
      'Статус изменен',
      `Пользователь ${selectedUser.fullName} теперь ${newStatus === 'active' ? 'активен' : newStatus === 'blocked' ? 'заблокирован' : 'неактивен'}`
    );
  };

  const handleRoleChange = (newRole) => {
    // В реальном приложении здесь будет API запрос
    // api.patch(`/admin/users/${selectedUser.id}`, { userType: newRole })

    // Обновляем локальный список
    const updatedUsers = users.map(u =>
      u.id === selectedUser.id ? { ...u, userType: newRole } : u
    );

    setUsers(updatedUsers);
    setModalVisible(false);

    Alert.alert(
      'Роль изменена',
      `Пользователь ${selectedUser.fullName} теперь ${newRole === 'admin' ? 'администратор' : newRole === 'teacher' ? 'преподаватель' : 'студент'}`
    );
  };

  const handleResetPassword = () => {
    // В реальном приложении здесь будет API запрос
    // api.post(`/admin/users/${selectedUser.id}/reset-password`)

    Alert.alert(
      'Пароль сброшен',
      `Новый пароль был отправлен на email пользователя: ${selectedUser.email}`
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'inactive': return '#8E8E93';
      case 'blocked': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getUserTypeText = (userType) => {
    switch (userType) {
      case 'student': return 'Студент';
      case 'teacher': return 'Преподаватель';
      case 'admin': return 'Администратор';
      default: return userType;
    }
  };

  const getUserTypeIcon = (userType) => {
    switch (userType) {
      case 'student': return 'school';
      case 'teacher': return 'people';
      case 'admin': return 'shield';
      default: return 'person';
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.userInfo}>
        <View style={[
          styles.userTypeIconContainer,
          { backgroundColor: item.userType === 'admin' ? '#5F66F230' : item.userType === 'teacher' ? '#FF950030' : '#34C75930' }
        ]}>
          <Ionicons
            name={getUserTypeIcon(item.userType)}
            size={22}
            color={item.userType === 'admin' ? '#5F66F2' : item.userType === 'teacher' ? '#FF9500' : '#34C759'}
          />
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.fullName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userMetaInfo}>
            <Text style={styles.userType}>{getUserTypeText(item.userType)}</Text>
            {item.group && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.userGroup}>{item.group}</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.userStatus}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={styles.lastActive}>
          {formatDate(item.lastActive)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const UserModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Управление пользователем</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.userProfile}>
              <View style={[
                styles.userAvatarContainer,
                { backgroundColor: selectedUser.userType === 'admin' ? '#5F66F230' : selectedUser.userType === 'teacher' ? '#FF950030' : '#34C75930' }
              ]}>
                <Text style={[
                  styles.userAvatarText,
                  { color: selectedUser.userType === 'admin' ? '#5F66F2' : selectedUser.userType === 'teacher' ? '#FF9500' : '#34C759' }
                ]}>
                  {selectedUser.fullName.split(' ').map(name => name[0]).join('').toUpperCase()}
                </Text>
              </View>

              <Text style={styles.profileName}>{selectedUser.fullName}</Text>
              <Text style={styles.profileEmail}>{selectedUser.email}</Text>

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoItem}>
                  <Text style={styles.profileInfoLabel}>Тип</Text>
                  <Text style={styles.profileInfoValue}>{getUserTypeText(selectedUser.userType)}</Text>
                </View>

                <View style={styles.profileInfoItem}>
                  <Text style={styles.profileInfoLabel}>Статус</Text>
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedUser.status) }]} />
                    <Text style={styles.profileInfoValue}>
                      {selectedUser.status === 'active' ? 'Активен' :
                       selectedUser.status === 'blocked' ? 'Заблокирован' : 'Неактивен'}
                    </Text>
                  </View>
                </View>
              </View>

              {selectedUser.userType === 'student' && (
                <View style={styles.profileInfoRow}>
                  <View style={styles.profileInfoItem}>
                    <Text style={styles.profileInfoLabel}>Группа</Text>
                    <Text style={styles.profileInfoValue}>{selectedUser.group || 'Не указана'}</Text>
                  </View>
                </View>
              )}

              {selectedUser.userType === 'teacher' && (
                <View style={styles.profileInfoRow}>
                  <View style={styles.profileInfoItem}>
                    <Text style={styles.profileInfoLabel}>Преподаватель</Text>
                    <Text style={styles.profileInfoValue}>{selectedUser.teacherName || 'Не указан'}</Text>
                  </View>
                </View>
              )}

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoItem}>
                  <Text style={styles.profileInfoLabel}>Последняя активность</Text>
                  <Text style={styles.profileInfoValue}>{formatDate(selectedUser.lastActive)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.actionSectionTitle}>Действия</Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  selectedUser.status === 'active' ? styles.blockButton : styles.activateButton
                ]}
                onPress={() => handleStatusChange(selectedUser.status === 'active' ? 'blocked' : 'active')}
              >
                <Ionicons
                  name={selectedUser.status === 'active' ? 'ban' : 'checkmark-circle'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>
                  {selectedUser.status === 'active' ? 'Заблокировать' : 'Активировать'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleResetPassword}
              >
                <Ionicons name="key" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Сбросить пароль</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.actionSectionTitle}>Изменить роль</Text>

            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedUser.userType === 'student' && styles.activeRoleButton
                ]}
                onPress={() => handleRoleChange('student')}
              >
                <Ionicons
                  name="school"
                  size={20}
                  color={selectedUser.userType === 'student' ? '#FFFFFF' : '#34C759'}
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedUser.userType === 'student' && styles.activeRoleButtonText
                ]}>
                  Студент
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedUser.userType === 'teacher' && styles.activeRoleButton
                ]}
                onPress={() => handleRoleChange('teacher')}
              >
                <Ionicons
                  name="people"
                  size={20}
                  color={selectedUser.userType === 'teacher' ? '#FFFFFF' : '#FF9500'}
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedUser.userType === 'teacher' && styles.activeRoleButtonText
                ]}>
                  Преподаватель
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedUser.userType === 'admin' && styles.activeRoleButton
                ]}
                onPress={() => handleRoleChange('admin')}
              >
                <Ionicons
                  name="shield"
                  size={20}
                  color={selectedUser.userType === 'admin' ? '#FFFFFF' : '#5F66F2'}
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedUser.userType === 'admin' && styles.activeRoleButtonText
                ]}>
                  Администратор
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(admin)/dashboard')}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Управление пользователями</Text>
        <TouchableOpacity style={styles.headerActionButton}>
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по имени, email или группе"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.activeFilterButton]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.activeFilterText]}>
            Все
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'student' && styles.activeFilterButton]}
          onPress={() => setFilter('student')}
        >
          <Text style={[styles.filterButtonText, filter === 'student' && styles.activeFilterText]}>
            Студенты
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'teacher' && styles.activeFilterButton]}
          onPress={() => setFilter('teacher')}
        >
          <Text style={[styles.filterButtonText, filter === 'teacher' && styles.activeFilterText]}>
            Преподаватели
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'admin' && styles.activeFilterButton]}
          onPress={() => setFilter('admin')}
        >
          <Text style={[styles.filterButtonText, filter === 'admin' && styles.activeFilterText]}>
            Администраторы
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Загрузка пользователей...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.usersList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#007AFF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>Пользователи не найдены</Text>
              <Text style={styles.emptySubtext}>
                Попробуйте изменить параметры поиска
              </Text>
            </View>
          }
        />
      )}

      <UserModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151940',
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#151940',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#151940',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '500',
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
  usersList: {
    padding: 16,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
  },
  userTypeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#151940',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#5F66F2',
    marginBottom: 4,
  },
  userMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userType: {
    fontSize: 13,
    color: '#8E8E93',
  },
  metaSeparator: {
    fontSize: 13,
    color: '#8E8E93',
    marginHorizontal: 4,
  },
  userGroup: {
    fontSize: 13,
    color: '#8E8E93',
  },
  userStatus: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  lastActive: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#151940',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151940',
  },
  closeButton: {
    padding: 4,
  },
  userProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  userAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatarText: {
    fontSize: 28,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151940',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#5F66F2',
    marginBottom: 16,
  },
  profileInfoRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 12,
  },
  profileInfoItem: {
    flex: 1,
  },
  profileInfoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  profileInfoValue: {
    fontSize: 15,
    color: '#151940',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  actionSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#151940',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  blockButton: {
    backgroundColor: '#FF3B30',
  },
  activateButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  activeRoleButton: {
    backgroundColor: '#007AFF',
  },
  roleButtonText: {
    fontSize: 14,
    color: '#151940',
    marginLeft: 6,
  },
  activeRoleButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});