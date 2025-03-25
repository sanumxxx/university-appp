// app/(teacher)/events.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Animated,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const { width: screenWidth } = Dimensions.get('window');

// Преобразование названий месяцев для карточек событий
const getShortMonth = (month) => {
  const monthNames = {
    'января': 'ЯНВ',
    'февраля': 'ФЕВ',
    'марта': 'МАР',
    'апреля': 'АПР',
    'мая': 'МАЙ',
    'июня': 'ИЮН',
    'июля': 'ИЮЛ',
    'августа': 'АВГ',
    'сентября': 'СЕН',
    'октября': 'ОКТ',
    'ноября': 'НОЯ',
    'декабря': 'ДЕК',
  };

  return monthNames[month] || month.slice(0, 3).toUpperCase();
};

export default function TeacherEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userCreatedEvents, setUserCreatedEvents] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    time: '14:00',
    location: '',
    category: 'education',
    capacity: '30',
    organizer: user?.teacher || user?.fullName || ''
  });

  // Категории мероприятий с цветовой кодировкой
  const eventCategories = [
    { id: 'science', name: 'Наука', color: '#5F66F2' },
    { id: 'culture', name: 'Культура', color: '#FF6C44' },
    { id: 'sport', name: 'Спорт', color: '#37CF73' },
    { id: 'education', name: 'Образование', color: '#2691EE' },
    { id: 'career', name: 'Карьера', color: '#FF4B8A' },
  ];

  // Примерные данные о мероприятиях
  const demoEvents = [
    {
      id: 1,
      title: 'День открытых дверей технического факультета',
      description: 'Приглашаем абитуриентов и их родителей на День открытых дверей технического. Вы познакомитесь с преподавателями, узнаете о программах обучения, перспективах трудоустройства и студенческой жизни.',
      image: 'https://melsu.ru/storage/images/uploads/v11cqwC6vygwkyujV1i7wm49BmY7JxPd8taueS8v/image.webp',
      date: '2025-04-15T14:00:00',
      location: '9.101',
      category: 'education',
      capacity: 100,
      registered: 67,
      organizer: 'Технический факультет'
    },
    {
      id: 2,
      title: 'Мастер-класс "Программирование на Python"',
      description: 'Практический мастер-класс по программированию на языке Python. Участники познакомятся с основами языка, научатся создавать простые программы и решать алгоритмические задачи. Необходим ноутбук с предустановленным Python 3.8 или выше.',
      image: 'https://melsu.ru/storage/images/uploads/gWDQUbUqivllP15xb79fiQH2sRxT7SoAe5d8WL65/image.webp',
      date: '2025-04-10T16:30:00',
      location: '7.202',
      category: 'science',
      capacity: 25,
      registered: 23,
      organizer: 'Кафедра ПМиИТ'
    },
    {
      id: 3,
      title: 'Студенческий квиз "Что? Где? Когда?"',
      description: 'Интеллектуальная игра для студентов всех факультетов. Формируйте команды из 6 человек и проверьте свои знания в различных областях науки, искусства, истории и поп-культуры. Победителей ждут призы!',
      image: 'https://melsu.ru/storage/images/uploads/PNmvmYodOMVkjIS6mIxvMTq5UmXw14xNDAp6zkIG/image.webp',
      date: '2025-04-18T18:00:00',
      location: '9.101',
      category: 'culture',
      capacity: 120,
      registered: 72,
      organizer: 'Технический факультет'
    },
    {
      id: 4,
      title: 'Волейбольный турнир между факультетами',
      description: 'Ежегодный волейбольный турнир между командами факультетов университета. Приглашаются как участники, так и болельщики. Участники должны иметь спортивную форму и сменную обувь.',
      image: 'https://melsu.ru/storage/images/uploads/gWDQUbUqivllP15xb79fiQH2sRxT7SoAe5d8WL65/image.webp',
      date: '2025-04-25T15:00:00',
      location: 'Спортивный комплекс МелГУ',
      category: 'sport',
      capacity: 60,
      registered: 42,
      organizer: 'Кафедра физической культуры'
    },
    {
      id: 5,
      title: 'Ярмарка вакансий "Карьерный старт"',
      description: 'На ярмарке будут представлены ведущие работодатели региона. Студенты и выпускники смогут пообщаться с представителями компаний, оставить резюме и узнать о стажировках и вакансиях. Не забудьте взять с собой резюме!',
      image: 'https://melsu.ru/storage/images/uploads/v11cqwC6vygwkyujV1i7wm49BmY7JxPd8taueS8v/image.webp',
      date: '2025-05-05T12:00:00',
      location: '2 корпус',
      category: 'career',
      capacity: 200,
      registered: 115,
      organizer: 'Центр карьеры МелГУ'
    }
  ];

  useEffect(() => {
    loadEvents();
    loadTeacherCreatedEvents();
  }, []);

  // Фильтрация мероприятий при изменении категории
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredEvents(events);
    } else if (selectedCategory === 'mine') {
      // Фильтр "Мои мероприятия" - показывает только созданные преподавателем
      setFilteredEvents(events.filter(event => event.createdByTeacher === true));
    } else {
      setFilteredEvents(events.filter(event => event.category === selectedCategory));
    }
  }, [selectedCategory, events]);

  // Загрузка мероприятий
  const loadEvents = async () => {
    setIsLoading(true);
    try {
      // В реальном приложении здесь будет API запрос
      await new Promise(resolve => setTimeout(resolve, 800));

      // Загружаем созданные преподавателем мероприятия
      const teacherEvents = await loadTeacherCreatedEvents();

      // Объединяем с демо-данными
      const allEvents = [...demoEvents, ...teacherEvents];

      // Сортируем по дате
      allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

      setEvents(allEvents);
      setFilteredEvents(allEvents);

      // Сохраняем в кэш демо-данные для оффлайн-режима
      await AsyncStorage.setItem('cached_events', JSON.stringify(demoEvents));
    } catch (error) {
      console.error('Ошибка загрузки мероприятий:', error);

      // Пытаемся загрузить из кэша
      try {
        const cachedEvents = await AsyncStorage.getItem('cached_events');
        const teacherEvents = await loadTeacherCreatedEvents();

        if (cachedEvents) {
          const parsedEvents = JSON.parse(cachedEvents);
          const allEvents = [...parsedEvents, ...teacherEvents];
          allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

          setEvents(allEvents);
          setFilteredEvents(allEvents);
        }
      } catch (cacheError) {
        console.error('Ошибка загрузки кэшированных мероприятий:', cacheError);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Загрузка мероприятий, созданных преподавателем
  const loadTeacherCreatedEvents = async () => {
    try {
      // В реальном приложении здесь был бы API запрос
      const storedEvents = await AsyncStorage.getItem(`teacher_events_${user.id}`);
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        setUserCreatedEvents(parsedEvents);
        return parsedEvents;
      }
      return [];
    } catch (error) {
      console.error('Ошибка загрузки созданных мероприятий:', error);
      return [];
    }
  };

  // Создание нового мероприятия
  const createEvent = async () => {
    // Валидация полей
    if (!newEvent.title || !newEvent.description || !newEvent.location || !newEvent.date || !newEvent.time) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);

    try {
      // Создаем объект мероприятия
      const eventDateTime = `${newEvent.date}T${newEvent.time}:00`;
      const event = {
        id: Date.now(), // Используем timestamp как ID
        title: newEvent.title,
        description: newEvent.description,
        date: eventDateTime,
        location: newEvent.location,
        category: newEvent.category,
        capacity: parseInt(newEvent.capacity) || 30,
        registered: 0,
        organizer: newEvent.organizer || user.teacher || user.fullName,
        image: getDefaultImageForCategory(newEvent.category),
        createdByTeacher: true, // Маркер, что создано преподавателем
        createdBy: user.id
      };

      // Загружаем текущие мероприятия преподавателя
      const currentEvents = [...userCreatedEvents];
      currentEvents.push(event);

      // Сохраняем в хранилище
      await AsyncStorage.setItem(`teacher_events_${user.id}`, JSON.stringify(currentEvents));

      // Обновляем локальное состояние
      setUserCreatedEvents(currentEvents);
      setEvents(prev => [...prev, event]);

      // Сортируем по дате
      const updatedEvents = [...events, event].sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(updatedEvents);
      setFilteredEvents(
        selectedCategory === 'all'
          ? updatedEvents
          : updatedEvents.filter(e => e.category === selectedCategory)
      );

      // Сбрасываем форму и закрываем модальное окно
      setNewEvent({
        title: '',
        description: '',
        date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        time: '14:00',
        location: '',
        category: 'education',
        capacity: '30',
        organizer: user?.teacher || user?.fullName || ''
      });

      setShowCreateModal(false);

      Alert.alert('Успешно', 'Мероприятие создано и опубликовано');

    } catch (error) {
      console.error('Ошибка при создании мероприятия:', error);
      Alert.alert('Ошибка', 'Не удалось создать мероприятие. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Получаем дефолтное изображение для категории
  const getDefaultImageForCategory = (categoryId) => {
    switch (categoryId) {
      case 'science':
        return 'https://melsu.ru/storage/images/uploads/gWDQUbUqivllP15xb79fiQH2sRxT7SoAe5d8WL65/image.webp';
      case 'education':
        return 'https://melsu.ru/storage/images/uploads/v11cqwC6vygwkyujV1i7wm49BmY7JxPd8taueS8v/image.webp';
      case 'culture':
        return 'https://melsu.ru/storage/images/uploads/PNmvmYodOMVkjIS6mIxvMTq5UmXw14xNDAp6zkIG/image.webp';
      default:
        return 'https://melsu.ru/storage/images/uploads/v11cqwC6vygwkyujV1i7wm49BmY7JxPd8taueS8v/image.webp';
    }
  };

  // Удаление мероприятия
  const deleteEvent = async (eventId) => {
    try {
      // Загружаем текущие мероприятия преподавателя
      const updatedEvents = userCreatedEvents.filter(event => event.id !== eventId);

      // Сохраняем в хранилище
      await AsyncStorage.setItem(`teacher_events_${user.id}`, JSON.stringify(updatedEvents));

      // Обновляем локальное состояние
      setUserCreatedEvents(updatedEvents);
      setEvents(prev => prev.filter(event => event.id !== eventId));
      setFilteredEvents(prev => prev.filter(event => event.id !== eventId));

      Alert.alert('Успешно', 'Мероприятие удалено');
    } catch (error) {
      console.error('Ошибка при удалении мероприятия:', error);
      Alert.alert('Ошибка', 'Не удалось удалить мероприятие');
    }
  };

  // Показ статистики мероприятия
  const showEventStats = (event) => {
    // Расчет процента заполненности
    const fillPercentage = Math.round((event.registered / event.capacity) * 100);

    Alert.alert(
      'Статистика мероприятия',
      `Название: ${event.title}\n\nКоличество зарегистрированных: ${event.registered} из ${event.capacity}\n\nЗаполненность: ${fillPercentage}%\n\nОрганизатор: ${event.organizer}`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  // Обработчик обновления (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  // Форматирование даты
  const formatEventDate = (dateString) => {
    const date = dayjs(dateString);
    return {
      day: date.format('D'),
      month: date.format('MMMM'),
      shortMonth: getShortMonth(date.format('MMMM')),
      weekday: date.format('dddd'),
      time: date.format('HH:mm'),
      fullDate: date.format('D MMMM'),
    };
  };

  // Получаем цвет категории
  const getCategoryColor = (categoryId) => {
    const category = eventCategories.find(cat => cat.id === categoryId);
    return category ? category.color : '#007AFF';
  };

  // Получаем название категории
  const getCategoryName = (categoryId) => {
    const category = eventCategories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Другое';
  };

  // Компонент фильтра категорий
  const CategoryFilters = () => (
    <View style={styles.filtersContainer}>
      <TouchableOpacity
        style={[
          styles.filterPill,
          selectedCategory === 'all' && styles.activeFilterPill
        ]}
        onPress={() => setSelectedCategory('all')}
      >
        <Text style={[
          styles.filterText,
          selectedCategory === 'all' && styles.activeFilterText
        ]}>Все</Text>
      </TouchableOpacity>

      {/* Специальный фильтр для преподавателя - показать только свои мероприятия */}
      <TouchableOpacity
        style={[
          styles.filterPill,
          selectedCategory === 'mine' && styles.activeFilterPill,
          selectedCategory === 'mine' && { backgroundColor: '#FF9500' }
        ]}
        onPress={() => setSelectedCategory('mine')}
      >
        <Text style={[
          styles.filterText,
          selectedCategory === 'mine' && styles.activeFilterText
        ]}>Мои мероприятия</Text>
      </TouchableOpacity>

      {eventCategories.map(category => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.filterPill,
            selectedCategory === category.id && styles.activeFilterPill,
            selectedCategory === category.id && { backgroundColor: category.color }
          ]}
          onPress={() => setSelectedCategory(category.id)}
        >
          <Text style={[
            styles.filterText,
            selectedCategory === category.id && styles.activeFilterText
          ]}>{category.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Компонент карточки мероприятия
  const EventCard = ({ event }) => {
    const eventDate = formatEventDate(event.date);
    const isCreatedByCurrentTeacher = event.createdByTeacher && event.createdBy === user.id;
    const isFull = event.registered >= event.capacity;
    const categoryColor = getCategoryColor(event.category);
    const categoryName = getCategoryName(event.category);

    // Рассчитываем процент заполнения
    const fillPercentage = Math.min(100, Math.round((event.registered / event.capacity) * 100));
    const isCritical = fillPercentage > 90;

    return (
      <View style={styles.eventCard}>
        <TouchableOpacity
          style={styles.cardTouchable}
          activeOpacity={0.9}
          onPress={() => {
            // Действия зависят от того, создал ли преподаватель это мероприятие
            if (isCreatedByCurrentTeacher) {
              Alert.alert(
                event.title,
                `${event.description}\n\nДата: ${eventDate.fullDate}, ${eventDate.time}\nМесто: ${event.location}\nОрганизатор: ${event.organizer}`,
                [
                  {
                    text: 'Посмотреть статистику',
                    onPress: () => showEventStats(event)
                  },
                  {
                    text: 'Удалить мероприятие',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Подтверждение',
                        'Вы уверены, что хотите удалить это мероприятие?',
                        [
                          { text: 'Отмена', style: 'cancel' },
                          {
                            text: 'Удалить',
                            style: 'destructive',
                            onPress: () => deleteEvent(event.id)
                          }
                        ]
                      );
                    }
                  },
                  { text: 'Закрыть', style: 'cancel' }
                ]
              );
            } else {
              // Обычный просмотр информации о мероприятии
              Alert.alert(
                event.title,
                `${event.description}\n\nДата: ${eventDate.fullDate}, ${eventDate.time}\nМесто: ${event.location}\nОрганизатор: ${event.organizer}\n\nЗарегистрировано: ${event.registered} из ${event.capacity}`,
                [
                  {
                    text: 'Посмотреть статистику',
                    onPress: () => showEventStats(event)
                  },
                  { text: 'Закрыть', style: 'cancel' }
                ]
              );
            }
          }}
        >
          <Image
            source={{ uri: event.image }}
            style={styles.eventImage}
            defaultSource={require('../../assets/icon.png')}
          />

          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
            style={styles.imageGradient}
          />

          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={styles.categoryText}>{categoryName}</Text>
          </View>

          <View style={styles.dateCircle}>
            <Text style={styles.dateDay}>{eventDate.day}</Text>
            <Text style={styles.dateMonth}>{eventDate.shortMonth}</Text>
          </View>

          {isCreatedByCurrentTeacher && (
            <View style={styles.createdByMeBadge}>
              <Ionicons name="create" size={14} color="#FFFFFF" />
              <Text style={styles.createdByMeText}>Ваше мероприятие</Text>
            </View>
          )}

          <View style={styles.eventContent}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>

            <View style={styles.eventDetails}>
              <View style={styles.eventInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="#8F9BB3" />
                  <Text style={styles.infoText}>{eventDate.time}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#8F9BB3" />
                  <Text style={styles.infoText} numberOfLines={1}>{event.location}</Text>
                </View>
              </View>

              <View style={styles.registrationStatus}>
                <View style={styles.capacityContainer}>
                  <View style={styles.capacityBar}>
                    <View
                      style={[
                        styles.capacityFill,
                        isCritical && styles.criticalFill,
                        { width: `${fillPercentage}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.capacityText}>
                    {event.registered}/{event.capacity} мест
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Компонент анимированного скелетона загрузки
  const EventSkeleton = () => {
    const pulseAnim = useState(new Animated.Value(0.3))[0];

    useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );

      pulse.start();
      return () => pulse.stop();
    }, []);

    return (
      <View style={styles.skeletonCard}>
        <Animated.View
          style={[styles.skeletonImage, { opacity: pulseAnim }]}
        />
        <View style={styles.skeletonContent}>
          <Animated.View
            style={[styles.skeletonTitle, { opacity: pulseAnim }]}
          />
          <Animated.View
            style={[styles.skeletonInfo, { opacity: pulseAnim }]}
          />
          <View style={styles.skeletonFooter}>
            <Animated.View
              style={[styles.skeletonBar, { opacity: pulseAnim }]}
            />
          </View>
        </View>
      </View>
    );
  };

  const LoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      {[1, 2, 3].map(i => <EventSkeleton key={i} />)}
    </View>
  );

  const EmptyEvents = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#C7CADF" />
      <Text style={styles.emptyTitle}>
        {selectedCategory === 'all'
          ? 'Нет предстоящих мероприятий'
          : selectedCategory === 'mine'
            ? 'У вас пока нет созданных мероприятий'
            : `Нет мероприятий в категории "${getCategoryName(selectedCategory)}"`
        }
      </Text>
      <Text style={styles.emptyText}>
        {selectedCategory === 'mine'
          ? 'Создайте новое мероприятие с помощью кнопки "+"'
          : 'Пока нет запланированных мероприятий. Загляните позже или выберите другую категорию.'
        }
      </Text>
    </View>
  );

  // Модальное окно создания мероприятия
  const CreateEventModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showCreateModal}
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Создание мероприятия</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Название мероприятия *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Введите название мероприятия"
                value={newEvent.title}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, title: text }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Описание *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Подробное описание мероприятия"
                value={newEvent.description}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, description: text }))}
                multiline={true}
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Дата *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="ГГГГ-ММ-ДД"
                  value={newEvent.date}
                  onChangeText={(text) => setNewEvent(prev => ({ ...prev, date: text }))}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Время *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="ЧЧ:ММ"
                  value={newEvent.time}
                  onChangeText={(text) => setNewEvent(prev => ({ ...prev, time: text }))}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Место проведения *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Укажите место проведения"
                value={newEvent.location}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, location: text }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Категория</Text>
              <View style={styles.categoryButtonsContainer}>
                {eventCategories.map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      newEvent.category === category.id && { backgroundColor: category.color }
                    ]}
                    onPress={() => setNewEvent(prev => ({ ...prev, category: category.id }))}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      newEvent.category === category.id && { color: '#FFFFFF' }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Вместимость</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Максимальное количество участников"
                value={newEvent.capacity}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, capacity: text }))}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Организатор</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Имя организатора или подразделение"
                value={newEvent.organizer}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, organizer: text }))}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={createEvent}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Создать мероприятие</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мероприятия университета</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#FF9500" />
        </TouchableOpacity>
      </View>

      <CategoryFilters />

      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={({ item }) => <EventCard event={item} />}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.eventsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#5F66F2"
              colors={['#5F66F2', '#2691EE']}
            />
          }
          ListEmptyComponent={<EmptyEvents />}
        />
      )}

      {/* Кнопка создания нового мероприятия */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Модальное окно создания мероприятия */}
      <CreateEventModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#151940',
    flex: 1,
  },
  createButton: {
    padding: 6,
  },
  filtersContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ECEEFE',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 8,
  },
  activeFilterPill: {
    backgroundColor: '#5F66F2',
  },
  filterText: {
    fontSize: 14,
    color: '#5F66F2',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  eventsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#8F9BB3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 300, // Увеличиваем минимальную высоту
  },
  eventImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120, // Увеличиваем высоту градиента
    height: 80,
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#5F66F2',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dateCircle: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#151940',
  },
  dateMonth: {
    fontSize: 10,
    color: '#8F9BB3',
    fontWeight: '600',
  },
  createdByMeBadge: {
    position: 'absolute',
    top: 75,
    right: 16,
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createdByMeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  eventContent: {
    padding: 16,
    minHeight: 120, // Увеличиваем минимальную высоту
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151940',
    marginBottom: 10,
    flexShrink: 1, // Позволяет тексту сжиматься при необходимости
  },
  eventDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6, // Добавляем дополнительный отступ сверху
  },
  eventInfo: {
    flex: 1,
  },
  cardTouchable: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#8F9BB3',
    marginLeft: 6,
    flex: 1,
  },
  registrationStatus: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  capacityContainer: {
    alignItems: 'flex-end',
  },
  capacityBar: {
    width: 80,
    height: 4,
    backgroundColor: '#EDF1F7',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  capacityFill: {
    backgroundColor: '#2ED573',
    height: '100%',
    borderRadius: 2,
  },
  criticalFill: {
    backgroundColor: '#FF4757',
  },
  capacityText: {
    fontSize: 12,
    color: '#8F9BB3',
    fontWeight: '500',
  },

  // FAB кнопка
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Модальное окно
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
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
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#151940',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  categoryButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    margin: 4,
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#151940',
  },
  submitButton: {
    backgroundColor: '#FF9500',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Стили для состояния загрузки
  loadingContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#8F9BB3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 300, // Согласуем с размером карточки
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#EDF1F7',
  },
  skeletonContent: {
    padding: 16,
    height: 120, // Согласуем с высотой контента
  },
  skeletonTitle: {
    height: 18,
    width: '80%',
    backgroundColor: '#EDF1F7',
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonInfo: {
    height: 14,
    width: '60%',
    backgroundColor: '#EDF1F7',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  skeletonBar: {
    height: 24,
    width: 80,
    backgroundColor: '#EDF1F7',
    borderRadius: 12,
  },

  // Стили для пустого списка
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151940',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8F9BB3',
    textAlign: 'center',
    marginTop: 8,
  },
});