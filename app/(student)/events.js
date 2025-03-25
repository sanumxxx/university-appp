// app/(student)/events.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
    ScrollView,
  Dimensions,
  Animated,
  Alert,
  StatusBar,
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

export default function StudentEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userRegistrations, setUserRegistrations] = useState([]);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);

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
    loadUserRegistrations();
  }, []);

  // Фильтрация мероприятий при изменении категории
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredEvents(events);
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

      // Используем демо-данные
      setEvents(demoEvents);
      setFilteredEvents(demoEvents);

      // Сохраняем в кэш
      await AsyncStorage.setItem('cached_events', JSON.stringify(demoEvents));
    } catch (error) {
      console.error('Ошибка загрузки мероприятий:', error);

      // Пытаемся загрузить из кэша
      try {
        const cachedEvents = await AsyncStorage.getItem('cached_events');
        if (cachedEvents) {
          const parsedEvents = JSON.parse(cachedEvents);
          setEvents(parsedEvents);
          setFilteredEvents(parsedEvents);
        }
      } catch (cacheError) {
        console.error('Ошибка загрузки кэшированных мероприятий:', cacheError);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Загрузка регистраций пользователя
  const loadUserRegistrations = async () => {
    try {
      // В реальном приложении здесь будет API запрос
      const storedRegistrations = await AsyncStorage.getItem(`user_registrations_${user.id}`);
      if (storedRegistrations) {
        setUserRegistrations(JSON.parse(storedRegistrations));
      }
    } catch (error) {
      console.error('Ошибка загрузки регистраций:', error);
    }
  };

  // Проверка, зарегистрирован ли пользователь на мероприятие
  const isUserRegistered = (eventId) => {
    return userRegistrations.includes(eventId);
  };

  // Регистрация на мероприятие
  const registerForEvent = async (eventId) => {
    if (registrationInProgress) return;

    setRegistrationInProgress(true);
    try {
      // В реальном приложении здесь будет API запрос
      await new Promise(resolve => setTimeout(resolve, 500));

      // Обновляем список регистраций
      const updatedRegistrations = [...userRegistrations, eventId];
      setUserRegistrations(updatedRegistrations);

      // Сохраняем в локальное хранилище
      await AsyncStorage.setItem(`user_registrations_${user.id}`, JSON.stringify(updatedRegistrations));

      // Обновляем количество зарегистрированных для мероприятия
      const updatedEvents = events.map(event => {
        if (event.id === eventId) {
          return { ...event, registered: event.registered + 1 };
        }
        return event;
      });

      setEvents(updatedEvents);
      setFilteredEvents(
        selectedCategory === 'all'
          ? updatedEvents
          : updatedEvents.filter(event => event.category === selectedCategory)
      );

      Alert.alert(
        'Успешная регистрация',
        'Вы зарегистрированы на мероприятие. Информация будет доступна в вашем профиле.'
      );
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      Alert.alert('Ошибка', 'Не удалось зарегистрироваться на мероприятие');
    } finally {
      setRegistrationInProgress(false);
    }
  };

  // Отмена регистрации
  const cancelRegistration = async (eventId) => {
    if (registrationInProgress) return;

    setRegistrationInProgress(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Обновляем список регистраций
      const updatedRegistrations = userRegistrations.filter(id => id !== eventId);
      setUserRegistrations(updatedRegistrations);

      // Сохраняем в локальное хранилище
      await AsyncStorage.setItem(`user_registrations_${user.id}`, JSON.stringify(updatedRegistrations));

      // Обновляем количество зарегистрированных для мероприятия
      const updatedEvents = events.map(event => {
        if (event.id === eventId) {
          return { ...event, registered: Math.max(0, event.registered - 1) };
        }
        return event;
      });

      setEvents(updatedEvents);
      setFilteredEvents(
        selectedCategory === 'all'
          ? updatedEvents
          : updatedEvents.filter(event => event.category === selectedCategory)
      );

      Alert.alert(
        'Регистрация отменена',
        'Вы успешно отменили регистрацию на мероприятие'
      );
    } catch (error) {
      console.error('Ошибка при отмене регистрации:', error);
      Alert.alert('Ошибка', 'Не удалось отменить регистрацию');
    } finally {
      setRegistrationInProgress(false);
    }
  };

  // Обработчик обновления (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
    loadUserRegistrations();
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
    const registered = isUserRegistered(event.id);
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
            Alert.alert(
              event.title,
              `${event.description}\n\nДата: ${eventDate.fullDate}, ${eventDate.time}\nМесто: ${event.location}\nОрганизатор: ${event.organizer}\n\nСвободно мест: ${event.capacity - event.registered} из ${event.capacity}`,
              [
                {
                  text: registered ? 'Отменить регистрацию' : 'Зарегистрироваться',
                  onPress: () => registered ? cancelRegistration(event.id) : registerForEvent(event.id)
                },
                { text: 'Закрыть', style: 'cancel' }
              ]
            );
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
                {registered ? (
                  <View style={styles.registeredBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.registeredText}>Вы записаны</Text>
                  </View>
                ) : isFull ? (
                  <View style={styles.fullBadge}>
                    <Text style={styles.fullText}>Мест нет</Text>
                  </View>
                ) : (
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
                      {event.capacity - event.registered} мест
                    </Text>
                  </View>
                )}
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
          : `Нет мероприятий в категории "${getCategoryName(selectedCategory)}"`
        }
      </Text>
      <Text style={styles.emptyText}>
        Пока нет запланированных мероприятий. Загляните позже или выберите другую категорию.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мероприятия университета</Text>
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#151940',
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
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ED573',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  registeredText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  fullBadge: {
    backgroundColor: '#FF4757',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fullText: {
    color: '#FFFFFF',
    fontSize: 12,
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