import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import api from '../../utils/api';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

// Компонент скелетона для чатов
const ChatListSkeleton = () => {
  const fadeAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const renderSkeletonItem = () => (
    <View style={styles.chatItem}>
      <Animated.View
        style={[styles.avatarPlaceholder, { opacity: fadeAnim }]}
      />
      <View style={styles.chatContent}>
        <Animated.View
          style={[styles.namePlaceholder, { opacity: fadeAnim }]}
        />
        <Animated.View
          style={[styles.messagePlaceholder, { opacity: fadeAnim }]}
        />
      </View>
      <View style={styles.chatMeta}>
        <Animated.View
          style={[styles.timePlaceholder, { opacity: fadeAnim }]}
        />
      </View>
    </View>
  );

  return (
    <View>
      {[1, 2, 3, 4, 5].map((_, index) => (
        <React.Fragment key={index}>
          {renderSkeletonItem()}
        </React.Fragment>
      ))}
    </View>
  );
};

// Компонент для "аватара" с инициалами
const AvatarInitials = ({ name, size = 50, background = '#007AFF' }) => {
  const getInitials = () => {
    if (!name) return '?';
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <View style={[
      styles.avatar,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background
      }
    ]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {getInitials()}
      </Text>
    </View>
  );
};

// Основной компонент экрана сообщений
export default function Messages() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  // Загрузка чатов при монтировании компонента
  useEffect(() => {
    loadChats();
    loadContacts();
  }, []);

  // Фильтрация чатов при изменении поискового запроса
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
      return;
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = chats.filter(chat => {
      // Получаем отображаемое имя с учетом всех правил именования
      const displayName = getChatDisplayName(chat);
      return displayName?.toLowerCase().includes(lowerCaseQuery);
    });

    setFilteredChats(filtered);
  }, [searchQuery, chats]);

  // Функция для форматирования имени чата согласно требованиям
  const getChatDisplayName = (chat) => {
    // Если чата нет, возвращаем пустую строку
    if (!chat) return '';

    // Для личных чатов - просто отображаем имя собеседника
    if (chat.type === 'private') {
      return chat.display_name || 'Чат';
    }

    // Для групповых чатов - логика зависит от роли пользователя
    if (chat.type === 'group') {
      // Для студента: "[ФИО преподавателя] - групповой чат"
      if (user.userType === 'student') {
        // Получаем ФИО преподавателя из chat.name, если оно сохранено при создании чата
        // Либо из сообщений (не реализовано здесь, требуется доработка API)
        const teacherName = chat.name || chat.display_name || 'Преподаватель';
        return `${teacherName} - групповой чат`;
      }
      // Для преподавателя: "Чат группы [название_группы]"
      else {
        const groupName = chat.group_id || 'группы';
        return `Чат группы ${groupName}`;
      }
    }

    // Если ничего не подошло, возвращаем стандартное имя
    return chat.display_name || 'Чат';
  };

  // Загрузка списка чатов
  const loadChats = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/chats');
      console.log('Чаты загружены:', response.data.length);

      // Сортировка чатов по времени последнего сообщения (новые сверху)
      const sortedChats = response.data.sort((a, b) => {
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return new Date(b.last_message_at) - new Date(a.last_message_at);
      });

      setChats(sortedChats);
      setFilteredChats(sortedChats);

      // Сохраняем чаты в локальное хранилище для офлайн-доступа
      await AsyncStorage.setItem('cached_chats', JSON.stringify(sortedChats));
    } catch (error) {
      console.error('Ошибка при загрузке чатов:', error);

      // Пробуем загрузить кэшированные чаты при ошибке
      try {
        const cachedChats = await AsyncStorage.getItem('cached_chats');
        if (cachedChats) {
          const parsedChats = JSON.parse(cachedChats);
          setChats(parsedChats);
          setFilteredChats(parsedChats);
          Alert.alert(
            'Офлайн-режим',
            'Показаны сохраненные чаты. Подключитесь к интернету для получения актуальных данных.'
          );
        }
      } catch (cacheError) {
        console.error('Ошибка при загрузке кэшированных чатов:', cacheError);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Загрузка контактов (преподавателей или студентов)
  const loadContacts = async () => {
    try {
      let response;
      if (user.userType === 'student') {
        response = await api.get('/teachers/my');
      } else {
        response = await api.get('/students/my');
      }

      setContacts(response.data);

      // Кэшируем контакты
      await AsyncStorage.setItem('cached_contacts', JSON.stringify(response.data));
    } catch (error) {
      console.error('Ошибка при загрузке контактов:', error);

      // Пробуем загрузить кэшированные контакты при ошибке
      try {
        const cachedContacts = await AsyncStorage.getItem('cached_contacts');
        if (cachedContacts) {
          setContacts(JSON.parse(cachedContacts));
        }
      } catch (cacheError) {
        console.error('Ошибка при загрузке кэшированных контактов:', cacheError);
      }
    }
  };

  // Обработчик обновления при свайпе вниз
  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    await loadContacts();
  };

  // Создание личного чата
  const createPrivateChat = async (userId) => {
    try {
      const response = await api.post('/chats/private', { userId });
      const chatId = response.data.id;

      // Обновляем список чатов и переходим к чату
      await loadChats();
      goToChat(chatId);
    } catch (error) {
      console.error('Ошибка при создании чата:', error);
      Alert.alert('Ошибка', 'Не удалось создать чат. Попробуйте позже.');
    }
  };

  // Создание группового чата (для преподавателей)
  const createGroupChat = async (groupId, students) => {
    if (user.userType !== 'teacher') return;

    try {
      const groupName = groupId;
      const response = await api.post('/chats/group', {
        groupId,
        name: `Чат группы ${groupName}` // Устанавливаем имя для группового чата
      });

      const chatId = response.data.id;
      await loadChats();
      goToChat(chatId);
    } catch (error) {
      console.error('Ошибка при создании группового чата:', error);
      Alert.alert('Ошибка', 'Не удалось создать групповой чат. Попробуйте позже.');
    }
  };

  // Переход к экрану чата
  const goToChat = (chatId) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: chatId }
    });
  };

  // Форматирование времени последнего сообщения
  const formatLastMessageTime = (time) => {
    if (!time) return '';

    const messageDate = dayjs(time);
    const now = dayjs();

    if (now.diff(messageDate, 'day') === 0) {
      // Сегодня - показываем только время
      return messageDate.format('HH:mm');
    } else if (now.diff(messageDate, 'day') === 1) {
      // Вчера
      return 'Вчера';
    } else if (now.diff(messageDate, 'day') < 7) {
      // В течение недели - показываем день недели
      return messageDate.format('dddd');
    } else {
      // Более недели назад - показываем дату
      return messageDate.format('DD.MM.YYYY');
    }
  };

  // Рендер элемента чата
  const renderChatItem = ({ item }) => {
    // Определяем, есть ли непрочитанные сообщения
    const hasUnread = item.unread_count > 0;

    // Получаем отформатированное имя чата по нашим правилам
    const chatDisplayName = getChatDisplayName(item);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => goToChat(item.id)}
      >
        <AvatarInitials
          name={chatDisplayName}
          background={item.type === 'group' ? '#5856D6' : '#007AFF'}
        />

        <View style={styles.chatContent}>
          <View style={styles.chatNameContainer}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatDisplayName}
            </Text>
            {item.type === 'group' && (
              <Ionicons name="people" size={14} color="#8E8E93" style={styles.groupIcon} />
            )}
          </View>

          <Text
            style={[styles.lastMessage, hasUnread && styles.unreadMessage]}
            numberOfLines={1}
          >
            {item.last_message || 'Нет сообщений'}
          </Text>
        </View>

        <View style={styles.chatMeta}>
          <Text style={styles.lastMessageTime}>
            {formatLastMessageTime(item.last_message_at)}
          </Text>

          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Рендер элемента контакта
  const renderContactItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => createPrivateChat(item.id)}
      >
        <AvatarInitials
          name={item.full_name}
          size={40}
          background={user.userType === 'student' ? '#FF9500' : '#34C759'}
        />

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.full_name}</Text>
          <Text style={styles.contactDetails}>
            {user.userType === 'student'
              ? 'Преподаватель'
              : `Группа: ${item.group_name}`}
          </Text>
        </View>

        <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
      </TouchableOpacity>
    );
  };

  // Фильтрация контактов при поиске
  const filteredContacts = contacts.filter(contact =>
    contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Сообщения</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => setShowContacts(!showContacts)}
        >
          <Ionicons
            name={showContacts ? "close" : "create-outline"}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={showContacts ? "Поиск контактов..." : "Поиск чатов..."}
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Переключатель вкладок */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, !showContacts && styles.activeTabButton]}
          onPress={() => setShowContacts(false)}
        >
          <Text style={[styles.tabText, !showContacts && styles.activeTabText]}>
            Чаты
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, showContacts && styles.activeTabButton]}
          onPress={() => setShowContacts(true)}
        >
          <Text style={[styles.tabText, showContacts && styles.activeTabText]}>
            Контакты
          </Text>
        </TouchableOpacity>
      </View>

      {showContacts ? (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
              colors={['#007AFF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Контакты не найдены' : 'Список контактов пуст'}
              </Text>
              <Text style={styles.emptySubText}>
                {searchQuery
                  ? 'Попробуйте изменить запрос'
                  : user.userType === 'student'
                      ? 'У вас пока нет преподавателей'
                      : 'У вас пока нет студентов'
                }
              </Text>
            </View>
          }
        />
      ) : (
        <>
          {isLoading ? (
            <ChatListSkeleton />
          ) : (
            <FlatList
              data={filteredChats}
              renderItem={renderChatItem}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#007AFF"
                  colors={['#007AFF']}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#8E8E93" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'Чаты не найдены' : 'У вас пока нет сообщений'}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {searchQuery
                      ? 'Попробуйте изменить запрос'
                      : 'Начните общение с контактами'}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    flex: 1,
  },
  newChatButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#000000',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
  },
  listContainer: {
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chatContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  chatNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    flex: 1,
  },
  groupIcon: {
    marginLeft: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#8E8E93',
  },
  unreadMessage: {
    color: '#000000',
    fontWeight: '500',
  },
  chatMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
    width: 60,
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  contactDetails: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  // Стили для скелетона
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
  },
  namePlaceholder: {
    width: '70%',
    height: 16,
    borderRadius: 3,
    backgroundColor: '#E5E5EA',
    marginBottom: 8,
  },
  messagePlaceholder: {
    width: '90%',
    height: 14,
    borderRadius: 3,
    backgroundColor: '#E5E5EA',
  },
  timePlaceholder: {
    width: 40,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#E5E5EA',
  },
});