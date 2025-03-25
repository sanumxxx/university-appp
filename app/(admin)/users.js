import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import api from '../../utils/api';

export default function UsersManagement() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'student', 'teacher', 'admin'
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [groupSuggestions, setGroupSuggestions] = useState([]);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);

  // New user form
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    userType: 'student',
    group: '',
    teacher: '',
    status: 'active'
  });

  // Form validation errors
  const [errors, setErrors] = useState({});

  // Load users from API
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('type', filter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await api.get(`/admin/users?${params.toString()}`);

      if (response.data) {
        setUsers(response.data);
        setFilteredUsers(response.data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить список пользователей. Проверьте подключение к сети.'
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filter, searchQuery]);

  // Load groups for suggestions
  const loadGroups = async () => {
    try {
      const response = await api.get('/groups');
      if (response.data) {
        setAvailableGroups(response.data);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  // Initial data load
  useEffect(() => {
    loadUsers();
    loadGroups();
  }, [loadUsers]);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setUserModalVisible(true);
  };

  // Filter groups based on input
  const filterGroups = (text) => {
    if (!text) {
      setGroupSuggestions([]);
      setShowGroupSuggestions(false);
      return;
    }

    const filtered = availableGroups.filter(group =>
      group.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 5);

    setGroupSuggestions(filtered);
    setShowGroupSuggestions(filtered.length > 0);
  };

  // Reset form errors for a field
  const clearError = (field) => {
    setErrors(prev => ({...prev, [field]: null}));
  };

  // Handle status change
  const handleStatusChange = async (newStatus) => {
    if (isSubmitting || !selectedUser) return;

    try {
      setIsSubmitting(true);

      await api.put(`/admin/users/${selectedUser.id}`, {
        status: newStatus
      });

      // Update local state
      const updatedUsers = users.map(u =>
        u.id === selectedUser.id ? {...u, status: newStatus} : u
      );

      setUsers(updatedUsers);
      setUserModalVisible(false);

      Alert.alert(
        'Статус изменен',
        `Пользователь ${selectedUser.full_name} теперь ${
          newStatus === 'active' ? 'активен' : 
          newStatus === 'blocked' ? 'заблокирован' : 'неактивен'
        }`
      );
    } catch (error) {
      console.error('Error updating user status:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось изменить статус пользователя'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle role change
  const handleRoleChange = async (newRole) => {
    if (isSubmitting || !selectedUser) return;

    try {
      setIsSubmitting(true);

      await api.put(`/admin/users/${selectedUser.id}`, {
        userType: newRole
      });

      // Update local state
      const updatedUsers = users.map(u =>
        u.id === selectedUser.id ? {...u, user_type: newRole} : u
      );

      setUsers(updatedUsers);
      setUserModalVisible(false);

      Alert.alert(
        'Роль изменена',
        `Пользователь ${selectedUser.full_name} теперь ${
          newRole === 'admin' ? 'администратор' : 
          newRole === 'teacher' ? 'преподаватель' : 'студент'
        }`
      );
    } catch (error) {
      console.error('Error updating user role:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось изменить роль пользователя'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (isSubmitting || !selectedUser) return;

    try {
      setIsSubmitting(true);

      // Generate random password
      const randomPassword = Math.random().toString(36).substring(2, 10);

      await api.put(`/admin/users/${selectedUser.id}`, {
        password: randomPassword
      });

      Alert.alert(
        'Пароль сброшен',
        `Новый пароль для ${selectedUser.email}: ${randomPassword}\n\nПожалуйста, сообщите пользователю новый пароль.`
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось сбросить пароль пользователя'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create new user
  const handleCreateUser = async () => {
    if (isSubmitting) return;

    // Validate form
    const validationErrors = {};
    if (!newUser.email) validationErrors.email = 'Email обязателен';
    if (!newUser.password) validationErrors.password = 'Пароль обязателен';
    if (!newUser.fullName) validationErrors.fullName = 'ФИО обязательно';
    if (newUser.userType === 'student' && !newUser.group) {
      validationErrors.group = 'Укажите группу для студента';
    }
    if (newUser.userType === 'teacher' && !newUser.teacher) {
      validationErrors.teacher = 'Укажите имя преподавателя';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await api.post('/admin/users', newUser);

      if (response.data) {
        // Add new user to the list
        setUsers(prev => [response.data, ...prev]);

        // Close modal and reset form
        setCreateModalVisible(false);
        setNewUser({
          email: '',
          password: '',
          fullName: '',
          userType: 'student',
          group: '',
          teacher: '',
          status: 'active'
        });

        Alert.alert(
          'Пользователь создан',
          `Пользователь ${response.data.full_name} успешно создан`
        );
      }
    } catch (error) {
      console.error('Error creating user:', error);

      if (error.response?.data?.error === 'Email already exists') {
        setErrors(prev => ({...prev, email: 'Email уже используется'}));
      } else {
        Alert.alert(
          'Ошибка',
          'Не удалось создать пользователя'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (isSubmitting || !selectedUser) return;

    try {
      setIsSubmitting(true);

      await api.delete(`/admin/users/${selectedUser.id}`);

      // Remove user from list
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));

      // Close modals
      setConfirmDeleteVisible(false);
      setUserModalVisible(false);

      Alert.alert(
        'Пользователь удален',
        `Пользователь ${selectedUser.full_name} успешно удален`
      );
    } catch (error) {
      console.error('Error deleting user:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось удалить пользователя'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'inactive': return '#8E8E93';
      case 'blocked': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  // Get user type text
  const getUserTypeText = (userType) => {
    switch (userType) {
      case 'student': return 'Студент';
      case 'teacher': return 'Преподаватель';
      case 'admin': return 'Администратор';
      default: return userType;
    }
  };

  // Get user type icon
  const getUserTypeIcon = (userType) => {
    switch (userType) {
      case 'student': return 'school';
      case 'teacher': return 'people';
      case 'admin': return 'shield';
      default: return 'person';
    }
  };

  // Render user item
  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.userInfo}>
        <View style={[
          styles.userTypeIconContainer,
          { backgroundColor: item.user_type === 'admin' ? '#5F66F230' : item.user_type === 'teacher' ? '#FF950030' : '#34C75930' }
        ]}>
          <Ionicons
            name={getUserTypeIcon(item.user_type)}
            size={22}
            color={item.user_type === 'admin' ? '#5F66F2' : item.user_type === 'teacher' ? '#FF9500' : '#34C759'}
          />
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.full_name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userMetaInfo}>
            <Text style={styles.userType}>{getUserTypeText(item.user_type)}</Text>
            {item.group_name && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.userGroup}>{item.group_name}</Text>
              </>
            )}
            {item.teacher_name && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.userGroup}>{item.teacher_name}</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.userStatus}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={styles.lastActive}>
          {formatDate(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // User detail modal
  const UserDetailModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={userModalVisible}
        onRequestClose={() => setUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Управление пользователем</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setUserModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.userProfile}>
              <View style={[
                styles.userAvatarContainer,
                { backgroundColor: selectedUser.user_type === 'admin' ? '#5F66F230' : selectedUser.user_type === 'teacher' ? '#FF950030' : '#34C75930' }
              ]}>
                <Text style={[
                  styles.userAvatarText,
                  { color: selectedUser.user_type === 'admin' ? '#5F66F2' : selectedUser.user_type === 'teacher' ? '#FF9500' : '#34C759' }
                ]}>
                  {selectedUser.full_name.split(' ').map(name => name[0]).join('').toUpperCase()}
                </Text>
              </View>

              <Text style={styles.profileName}>{selectedUser.full_name}</Text>
              <Text style={styles.profileEmail}>{selectedUser.email}</Text>

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoItem}>
                  <Text style={styles.profileInfoLabel}>Тип</Text>
                  <Text style={styles.profileInfoValue}>{getUserTypeText(selectedUser.user_type)}</Text>
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

              {selectedUser.user_type === 'student' && (
                <View style={styles.profileInfoRow}>
                  <View style={styles.profileInfoItem}>
                    <Text style={styles.profileInfoLabel}>Группа</Text>
                    <Text style={styles.profileInfoValue}>{selectedUser.group_name || 'Не указана'}</Text>
                  </View>
                </View>
              )}

              {selectedUser.user_type === 'teacher' && (
                <View style={styles.profileInfoRow}>
                  <View style={styles.profileInfoItem}>
                    <Text style={styles.profileInfoLabel}>Преподаватель</Text>
                    <Text style={styles.profileInfoValue}>{selectedUser.teacher_name || 'Не указан'}</Text>
                  </View>
                </View>
              )}

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoItem}>
                  <Text style={styles.profileInfoLabel}>Создан</Text>
                  <Text style={styles.profileInfoValue}>{formatDate(selectedUser.created_at)}</Text>
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                  selectedUser.user_type === 'student' && styles.activeRoleButton
                ]}
                onPress={() => handleRoleChange('student')}
                disabled={isSubmitting}
              >
                <Ionicons
                  name="school"
                  size={20}
                  color={selectedUser.user_type === 'student' ? '#FFFFFF' : '#34C759'}
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedUser.user_type === 'student' && styles.activeRoleButtonText
                ]}>
                  Студент
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedUser.user_type === 'teacher' && styles.activeRoleButton
                ]}
                onPress={() => handleRoleChange('teacher')}
                disabled={isSubmitting}
              >
                <Ionicons
                  name="people"
                  size={20}
                  color={selectedUser.user_type === 'teacher' ? '#FFFFFF' : '#FF9500'}
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedUser.user_type === 'teacher' && styles.activeRoleButtonText
                ]}>
                  Преподаватель
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedUser.user_type === 'admin' && styles.activeRoleButton
                ]}
                onPress={() => handleRoleChange('admin')}
                disabled={isSubmitting}
              >
                <Ionicons
                  name="shield"
                  size={20}
                  color={selectedUser.user_type === 'admin' ? '#FFFFFF' : '#5F66F2'}
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedUser.user_type === 'admin' && styles.activeRoleButtonText
                ]}>
                  Администратор
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setConfirmDeleteVisible(true)}
              disabled={isSubmitting}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>Удалить пользователя</Text>
            </TouchableOpacity>

            {isSubmitting && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // Create user modal
  const CreateUserModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={createModalVisible}
      onRequestClose={() => setCreateModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, {maxHeight: '85%'}]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Создание пользователя</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCreateModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScrollView}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={[styles.formInput, errors.email && styles.inputError]}
                placeholder="например: student@example.com"
                value={newUser.email}
                onChangeText={(text) => {
                  setNewUser(prev => ({...prev, email: text}));
                  clearError('email');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Пароль <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={[styles.formInput, errors.password && styles.inputError]}
                placeholder="Минимум 6 символов"
                value={newUser.password}
                onChangeText={(text) => {
                  setNewUser(prev => ({...prev, password: text}));
                  clearError('password');
                }}
                secureTextEntry
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ФИО <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={[styles.formInput, errors.fullName && styles.inputError]}
                placeholder="Иванов Иван Иванович"
                value={newUser.fullName}
                onChangeText={(text) => {
                  setNewUser(prev => ({...prev, fullName: text}));
                  clearError('fullName');
                }}
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Тип пользователя <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.userTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.userTypeButton,
                    newUser.userType === 'student' && styles.userTypeButtonActive,
                  ]}
                  onPress={() => setNewUser(prev => ({...prev, userType: 'student'}))}
                >
                  <Ionicons
                    name="school"
                    size={20}
                    color={newUser.userType === 'student' ? '#007AFF' : '#8E8E93'}
                  />
                  <Text style={[
                    styles.userTypeText,
                    newUser.userType === 'student' && styles.userTypeTextActive,
                  ]}>
                    Студент
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.userTypeButton,
                    newUser.userType === 'teacher' && styles.userTypeButtonActive,
                  ]}
                  onPress={() => setNewUser(prev => ({...prev, userType: 'teacher'}))}
                >
                  <Ionicons
                    name="people"
                    size={20}
                    color={newUser.userType === 'teacher' ? '#007AFF' : '#8E8E93'}
                  />
                  <Text style={[
                    styles.userTypeText,
                    newUser.userType === 'teacher' && styles.userTypeTextActive,
                  ]}>
                    Преподаватель
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.userTypeButton,
                    newUser.userType === 'admin' && styles.userTypeButtonActive,
                  ]}
                  onPress={() => setNewUser(prev => ({...prev, userType: 'admin'}))}
                >
                  <Ionicons
                    name="shield"
                    size={20}
                    color={newUser.userType === 'admin' ? '#007AFF' : '#8E8E93'}
                  />
                  <Text style={[
                    styles.userTypeText,
                    newUser.userType === 'admin' && styles.userTypeTextActive,
                  ]}>
                    Админ
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {newUser.userType === 'student' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Группа <Text style={styles.requiredStar}>*</Text></Text>
                <View style={styles.suggestionsContainer}>
                  <TextInput
                    style={[styles.formInput, errors.group && styles.inputError]}
                    placeholder="Например: 2211-0101.1"
                    value={newUser.group}
                    onChangeText={(text) => {
                      setNewUser(prev => ({...prev, group: text}));
                      filterGroups(text);
                      clearError('group');
                    }}
                    onFocus={() => filterGroups(newUser.group)}
                    onBlur={() => setTimeout(() => setShowGroupSuggestions(false), 200)}
                  />
                  {showGroupSuggestions && (
                    <View style={styles.suggestions}>
                      {groupSuggestions.map((group, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setNewUser(prev => ({...prev, group}));
                            setShowGroupSuggestions(false);
                          }}
                        >
                          <Text style={styles.suggestionText}>{group}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                {errors.group && <Text style={styles.errorText}>{errors.group}</Text>}
              </View>
            )}

            {newUser.userType === 'teacher' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Имя преподавателя <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={[styles.formInput, errors.teacher && styles.inputError]}
                  placeholder="Фамилия И.О."
                  value={newUser.teacher}
                  onChangeText={(text) => {
                    setNewUser(prev => ({...prev, teacher: text}));
                    clearError('teacher');
                  }}
                />
                {errors.teacher && <Text style={styles.errorText}>{errors.teacher}</Text>}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Статус</Text>
              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    newUser.status === 'active' && styles.statusButtonActive,
                  ]}
                  onPress={() => setNewUser(prev => ({...prev, status: 'active'}))}
                >
                  <Text style={[
                    styles.statusButtonText,
                    newUser.status === 'active' && styles.statusButtonTextActive,
                  ]}>
                    Активен
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    newUser.status === 'inactive' && styles.statusButtonActive,
                  ]}
                  onPress={() => setNewUser(prev => ({...prev, status: 'inactive'}))}
                >
                  <Text style={[
                    styles.statusButtonText,
                    newUser.status === 'inactive' && styles.statusButtonTextActive,
                  ]}>
                    Неактивен
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    newUser.status === 'blocked' && styles.statusButtonActive,
                  ]}
                  onPress={() => setNewUser(prev => ({...prev, status: 'blocked'}))}
                >
                  <Text style={[
                    styles.statusButtonText,
                    newUser.status === 'blocked' && styles.statusButtonTextActive,
                  ]}>
                    Заблокирован
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={handleCreateUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Создать пользователя</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Delete confirmation modal
  const DeleteConfirmationModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={confirmDeleteVisible}
      onRequestClose={() => setConfirmDeleteVisible(false)}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>Удаление пользователя</Text>
          <Text style={styles.confirmText}>
            Вы уверены, что хотите удалить пользователя {selectedUser?.full_name}?
            Это действие нельзя отменить.
          </Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, styles.cancelButton]}
              onPress={() => setConfirmDeleteVisible(false)}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, styles.deleteConfirmButton]}
              onPress={handleDeleteUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteConfirmText}>Удалить</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
        <TouchableOpacity
          style={styles.headerActionButton}
          onPress={() => setCreateModalVisible(true)}
        >
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
                Попробуйте изменить параметры поиска или создать нового пользователя
              </Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <UserDetailModal />
      <CreateUserModal />
      <DeleteConfirmationModal />
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
    marginBottom: 24,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  formScrollView: {
    maxHeight: '70%',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    color: '#151940',
    fontWeight: '500',
    marginBottom: 8,
  },
  requiredStar: {
    color: '#FF3B30',
  },
  formInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#151940',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userTypeButton: {
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
  userTypeButtonActive: {
    backgroundColor: '#E5F1FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  userTypeText: {
    fontSize: 14,
    color: '#151940',
    marginLeft: 6,
  },
  userTypeTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  statusButtonActive: {
    backgroundColor: '#E5F1FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#151940',
  },
  statusButtonTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  suggestionsContainer: {
    position: 'relative',
    zIndex: 100,
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    maxHeight: 150,
    zIndex: 10,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  suggestionText: {
    fontSize: 14,
    color: '#151940',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    padding: 20,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151940',
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 15,
    color: '#3C3C43',
    marginBottom: 20,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#3C3C43',
    fontWeight: '500',
  },
  deleteConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  deleteConfirmText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});