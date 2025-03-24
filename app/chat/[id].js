import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import api from '../../utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import AsyncStorage from '@react-native-async-storage/async-storage';

dayjs.locale('ru');

// Частота обновления сообщений в миллисекундах
const REFRESH_INTERVAL = 2000; // 2 секунды

// Компонент скелетона для сообщений
const MessageSkeleton = () => {
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

  // Генерируем шаблоны сообщений разной длины и с разным выравниванием
  const renderSkeletonItems = () => {
    const items = [];
    for (let i = 0; i < 10; i++) {
      const width = 100 + Math.random() * 200; // Случайная ширина от 100 до 300
      const isRight = i % 3 !== 0; // Каждое третье сообщение слева, остальные справа

      items.push(
        <View
          key={i}
          style={[
            styles.skeletonMessageContainer,
            isRight ? styles.rightMessage : styles.leftMessage
          ]}
        >
          <Animated.View
            style={[
              styles.skeletonMessage,
              { width, opacity: fadeAnim },
              isRight ? styles.skeletonRightMessage : styles.skeletonLeftMessage
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonTime,
              { opacity: fadeAnim },
              isRight ? styles.rightSkeletonTime : styles.leftSkeletonTime
            ]}
          />
        </View>
      );
    }
    return items;
  };

  return <View style={styles.skeletonContainer}>{renderSkeletonItems()}</View>;
};

// Компонент для "аватара" с инициалами
const AvatarInitials = ({ name, size = 36, background = '#007AFF' }) => {
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

export default function ChatScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const chatId = params.id;

  const [chatInfo, setChatInfo] = useState(null);
  const [chatName, setChatName] = useState('');
  const [chatSubtitle, setChatSubtitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [isGroupChat, setIsGroupChat] = useState(false); // Явно отслеживаем, групповой ли это чат

  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef(null);

  // Функция для форматирования имени чата согласно требованиям
  const formatChatName = (chat) => {
    // Если чата нет, возвращаем пустую строку
    if (!chat) {
      setChatName('Чат');
      setChatSubtitle('');
      setIsGroupChat(false);
      return;
    }

    // Устанавливаем флаг группового чата
    setIsGroupChat(chat.type === 'group');

    // Для личных чатов - просто отображаем имя собеседника
    if (chat.type === 'private') {
      setChatName(chat.display_name || 'Чат');
      setChatSubtitle('Личный чат');
    }

    // Для групповых чатов - логика зависит от роли пользователя
    else if (chat.type === 'group') {
      // Для студента: "[ФИО преподавателя] - групповой чат"
      if (user.userType === 'student') {
        // Получаем ФИО преподавателя из chat.name, если оно сохранено при создании чата
        const teacherName = chat.name || chat.display_name || 'Преподаватель';
        setChatName(teacherName);
        setChatSubtitle('Групповой чат');
      }
      // Для преподавателя: "Чат группы [название_группы]"
      else {
        const groupName = chat.group_id || 'группы';
        setChatName(`Чат группы ${groupName}`);
        setChatSubtitle('Групповой чат');
      }
    }
    else {
      setChatName(chat.display_name || 'Чат');
      setChatSubtitle(chat.type === 'group' ? 'Групповой чат' : 'Личный чат');
    }
  };

  // Оптимизированная функция загрузки сообщений
  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await api.get(`/chats/${chatId}/messages`, {
        params: { limit: 20, offset: page * 20 }
      });

      // Извлекаем имя отправителя из первого полученного сообщения, если у нас ещё нет имени чата
      if (!chatName && response.data.length > 0) {
        // Находим сообщение не от текущего пользователя
        const otherUserMessage = response.data.find(msg => msg.sender_id !== user.id);
        if (otherUserMessage && otherUserMessage.sender_name) {
          console.log("Найдено имя из сообщения:", otherUserMessage.sender_name);
          setChatName(otherUserMessage.sender_name);
          setChatSubtitle('Личный чат');
        }
      }

      // Проверяем, есть ли новые сообщения
      let newMessagesReceived = false;
      if (response.data.length > 0) {
        const latestMessageId = response.data[0].id;
        if (lastMessageId === null || latestMessageId !== lastMessageId) {
          setLastMessageId(latestMessageId);
          newMessagesReceived = true;
        }
      }

      // Если это первая загрузка или тихое обновление, заменяем все сообщения
      if (page === 0 || silent) {
        setMessages(response.data.reverse());

        // Прокручиваем к новым сообщениям, если они есть и это тихое обновление
        if (silent && newMessagesReceived) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        // Иначе добавляем сообщения в начало списка
        setMessages(prev => [...response.data.reverse(), ...prev]);
      }

      // Проверяем, есть ли еще сообщения для загрузки
      setHasMoreMessages(response.data.length === 20);

      // Сохраняем сообщения в кэш
      await AsyncStorage.setItem(`chat_messages_${chatId}`, JSON.stringify(response.data));

      // Отмечаем сообщения как прочитанные
      markMessagesAsRead();
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error);

      // Пробуем загрузить кэшированные сообщения
      try {
        const cachedMessages = await AsyncStorage.getItem(`chat_messages_${chatId}`);
        if (cachedMessages && page === 0) {
          const parsedMessages = JSON.parse(cachedMessages).reverse();
          setMessages(parsedMessages);

          // Если нет имени чата, пробуем получить из сообщений
          if (!chatName && parsedMessages.length > 0) {
            const otherUserMessage = parsedMessages.find(msg => msg.sender_id !== user.id);
            if (otherUserMessage && otherUserMessage.sender_name) {
              setChatName(otherUserMessage.sender_name);
              setChatSubtitle('Личный чат');
            }
          }
        }
      } catch (cacheError) {
        console.error('Ошибка при загрузке кэшированных сообщений:', cacheError);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [chatId, page, lastMessageId, chatName, user.id]);

  // Отслеживание состояния приложения для настройки частоты обновлений
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;

      // Если приложение стало активным, сразу обновляем сообщения
      if (nextAppState === 'active') {
        loadMessages(true);

        // Обновляем интервал на более частый, когда приложение активно
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
          loadMessages(true);
        }, REFRESH_INTERVAL);
      } else if (nextAppState.match(/inactive|background/)) {
        // Если приложение неактивно, устанавливаем более редкий интервал обновления
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
          loadMessages(true);
        }, REFRESH_INTERVAL * 5); // Реже обновляем в фоне
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadMessages]);

  useEffect(() => {
    loadChat();
    loadMessages();

    // Отмечаем сообщения как прочитанные при открытии чата
    markMessagesAsRead();

    // Устанавливаем интервал обновления сообщений
    intervalRef.current = setInterval(() => {
      loadMessages(true);
    }, REFRESH_INTERVAL);

    // Очищаем интервал при размонтировании компонента
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [chatId, loadMessages]);

  // Обновляем заголовок чата, когда загружена информация или когда меняется имя чата
  useEffect(() => {
    // Если у нас есть информация о чате, применяем правила форматирования
    if (chatInfo) {
      formatChatName(chatInfo);
    }
  }, [chatInfo]);

  // Загрузка информации о чате
  const loadChat = async () => {
    try {
      // Получение информации о чате из кэшированного списка чатов
      const cachedChatsJson = await AsyncStorage.getItem('cached_chats');
      if (cachedChatsJson) {
        const cachedChats = JSON.parse(cachedChatsJson);
        const chat = cachedChats.find(c => c.id.toString() === chatId.toString());
        if (chat) {
          setChatInfo(chat);
          console.log("Информация о чате загружена:", chat);

          // Применяем правила форматирования имени чата
          formatChatName(chat);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке информации о чате:', error);
    }
  };

  // Загрузка более старых сообщений
  const loadMoreMessages = () => {
    if (hasMoreMessages && !isLoadingMore) {
      setIsLoadingMore(true);
      setPage(prev => prev + 1);
      loadMessages();
    }
  };

  // Отправка нового сообщения
  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await api.post(`/chats/${chatId}/messages`, {
        message: newMessage.trim()
      });

      // Добавляем новое сообщение в список
      setMessages(prev => [...prev, response.data]);

      // Обновляем последний ID сообщения
      setLastMessageId(response.data.id);

      // Очищаем поле ввода
      setNewMessage('');

      // Прокручиваем к новому сообщению
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      alert('Не удалось отправить сообщение. Попробуйте позже.');
    } finally {
      setIsSending(false);
    }
  };

  // Отметка сообщений как прочитанных
  const markMessagesAsRead = async () => {
    try {
      await api.post(`/chats/${chatId}/read`);
    } catch (error) {
      console.error('Ошибка при отметке сообщений как прочитанных:', error);
    }
  };

  // Форматирование времени сообщения
  const formatMessageTime = (time) => {
    if (!time) return '';

    const messageDate = dayjs(time);
    const now = dayjs();

    if (now.diff(messageDate, 'day') === 0) {
      // Сегодня - показываем только время
      return messageDate.format('HH:mm');
    } else if (now.diff(messageDate, 'day') === 1) {
      // Вчера
      return 'Вчера ' + messageDate.format('HH:mm');
    } else {
      // Другие даты
      return messageDate.format('DD.MM.YY HH:mm');
    }
  };

  // Рендер элемента-сообщения
  const renderMessageItem = ({ item, index }) => {
    const isMyMessage = item.sender_id === user.id;

    // В групповом чате всегда показываем имя отправителя для чужих сообщений
    // Упрощенная и более надежная логика
    const showSenderName = !isMyMessage && isGroupChat;

    // Убедимся, что имя отправителя существует
    const senderName = item.sender_name || 'Неизвестный';

    // Определение даты сообщения для разделения по дням
    const messageDate = dayjs(item.created_at).format('YYYY-MM-DD');
    const prevMessageDate = index > 0 ? dayjs(messages[index - 1].created_at).format('YYYY-MM-DD') : '';

    // Показываем разделитель даты, если сообщение первое или если дата изменилась
    const showDateSeparator = index === 0 || messageDate !== prevMessageDate;

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {dayjs(messageDate).format('D MMMM YYYY')}
            </Text>
          </View>
        )}

        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.rightMessage : styles.leftMessage
        ]}>
          {showSenderName && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}

          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
          ]}>
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : null
            ]}>{item.message}</Text>
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : null
            ]}>
              {formatMessageTime(item.created_at)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  // Рендер индикатора загрузки более старых сообщений
  const renderLoadMore = () => {
    if (!hasMoreMessages) return null;

    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={loadMoreMessages}
        disabled={isLoadingMore}
      >
        {isLoadingMore ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Text style={styles.loadMoreText}>Загрузить предыдущие сообщения</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Определяем отображаемое имя чата
  const displayChatName = chatName || 'Чат';
  const displayChatSubtitle = chatSubtitle || (isGroupChat ? 'Групповой чат' : 'Личный чат');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayChatName}
            </Text>

            <Text style={styles.headerSubtitle}>
              {displayChatSubtitle}
            </Text>
          </View>

          <AvatarInitials
            name={displayChatName}
            size={36}
            background={isGroupChat ? '#5856D6' : '#007AFF'}
          />
        </View>

        {isLoading ? (
          <MessageSkeleton />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.messagesList}
            inverted={false}
            ListHeaderComponent={renderLoadMore}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#8E8E93" />
                <Text style={styles.emptyText}>Нет сообщений</Text>
                <Text style={styles.emptySubtext}>
                  Начните общение прямо сейчас
                </Text>
              </View>
            }
            onEndReached={() => {
              // Прокручиваем вниз при первой загрузке, если есть сообщения
              if (messages.length > 0 && page === 0) {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
              }
            }}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Сообщение..."
            placeholderTextColor="#8E8E93"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxHeight={100}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || isSending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  messagesList: {
    paddingVertical: 16,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: 'rgba(229, 229, 234, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageContainer: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  rightMessage: {
    alignItems: 'flex-end',
  },
  leftMessage: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 13,
    color: '#007AFF',
    marginBottom: 2,
    marginLeft: 12,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 24, // Место для времени
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
  },
  otherMessageBubble: {
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#8E8E93',
    position: 'absolute',
    right: 12,
    bottom: 4,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    color: '#000000',
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#007AFF',
  },
  // Стили для скелетона
  skeletonContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonMessageContainer: {
    marginVertical: 8,
  },
  skeletonMessage: {
    height: 34,
    borderRadius: 18,
  },
  skeletonRightMessage: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-end',
  },
  skeletonLeftMessage: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  skeletonTime: {
    height: 10,
    width: 40,
    borderRadius: 5,
    marginTop: 4,
    backgroundColor: '#E5E5EA',
  },
  rightSkeletonTime: {
    alignSelf: 'flex-end',
    marginRight: 12,
  },
  leftSkeletonTime: {
    alignSelf: 'flex-start',
    marginLeft: 12,
  },
});