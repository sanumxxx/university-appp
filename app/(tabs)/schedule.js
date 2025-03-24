import { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  FlatList,
  RefreshControl,
  Dimensions,
  Alert,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useAuth } from '../../context/auth';
import api from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

// ========== Служба локального хранения данных ==========

// Ключи для хранения данных
const STORAGE_KEYS = {
  SCHEDULE_DATA: 'schedule_data',
  SCHEDULE_LAST_UPDATE: 'schedule_last_update',
  WEEK_SCHEDULE: 'week_schedule',
};

// Максимальное время действия кэша в минутах
const CACHE_EXPIRATION_TIME = 60; // 1 час

/**
 * Сервис для локального хранения и управления данными расписания
 */
class ScheduleStorageService {
  /**
   * Проверяет, доступна ли сеть
   * @returns {Promise<boolean>} Статус сети
   */
  static async isNetworkAvailable() {
    // Заглушка для проверки сети - в реальном приложении нужно использовать NetInfo
    // Требуется установить: npm install @react-native-community/netinfo
    // import NetInfo from '@react-native-community/netinfo';
    // const networkState = await NetInfo.fetch();
    // return networkState.isConnected && networkState.isInternetReachable;

    // Пробуем сделать простой запрос для проверки соединения
    try {
      const response = await fetch('https://univappschedule.ru/api/groups', {
        method: 'HEAD',
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      console.log('Network check error:', error);
      return false;
    }
  }

  /**
   * Сохраняет данные расписания для указанной даты
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @param {Array} scheduleData - Данные расписания
   */
  static async saveScheduleData(date, scheduleData) {
    try {
      // Получаем существующие данные или инициализируем новый объект
      const existingDataJson = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULE_DATA);
      const scheduleStorage = existingDataJson ? JSON.parse(existingDataJson) : {};

      // Обновляем данные для указанной даты
      scheduleStorage[date] = scheduleData;

      // Сохраняем обновленные данные
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULE_DATA, JSON.stringify(scheduleStorage));

      // Обновляем время последнего обновления
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULE_LAST_UPDATE, dayjs().toISOString());

      console.log(`Расписание для ${date} сохранено локально`);
    } catch (error) {
      console.error('Ошибка при сохранении расписания:', error);
    }
  }

  /**
   * Сохраняет расписание на неделю
   * @param {Object} weekSchedule - Объект с расписанием на неделю
   */
  static async saveWeekSchedule(weekSchedule) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WEEK_SCHEDULE, JSON.stringify(weekSchedule));
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULE_LAST_UPDATE, dayjs().toISOString());
      console.log('Расписание на неделю сохранено локально');
    } catch (error) {
      console.error('Ошибка при сохранении расписания на неделю:', error);
    }
  }

  /**
   * Получает расписание для указанной даты
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @returns {Promise<Array|null>} Расписание или null, если не найдено
   */
  static async getScheduleForDate(date) {
    try {
      const scheduleDataJson = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULE_DATA);
      if (!scheduleDataJson) return null;

      const scheduleData = JSON.parse(scheduleDataJson);
      return scheduleData[date] || null;
    } catch (error) {
      console.error('Ошибка при получении расписания:', error);
      return null;
    }
  }

  /**
   * Получает расписание на неделю
   * @returns {Promise<Object|null>} Расписание на неделю или null
   */
  static async getWeekSchedule() {
    try {
      const weekScheduleJson = await AsyncStorage.getItem(STORAGE_KEYS.WEEK_SCHEDULE);
      return weekScheduleJson ? JSON.parse(weekScheduleJson) : null;
    } catch (error) {
      console.error('Ошибка при получении расписания на неделю:', error);
      return null;
    }
  }

  /**
   * Проверяет, актуален ли кэш расписания
   * @returns {Promise<boolean>} Статус актуальности кэша
   */
  static async isCacheValid() {
    try {
      const lastUpdateJson = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULE_LAST_UPDATE);
      if (!lastUpdateJson) return false;

      const lastUpdate = dayjs(lastUpdateJson);
      const now = dayjs();

      // Проверяем, что кэш не старше заданного времени
      return now.diff(lastUpdate, 'minute') < CACHE_EXPIRATION_TIME;
    } catch (error) {
      console.error('Ошибка при проверке актуальности кэша:', error);
      return false;
    }
  }

  /**
   * Очищает кэш расписания
   */
  static async clearCache() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SCHEDULE_DATA);
      await AsyncStorage.removeItem(STORAGE_KEYS.WEEK_SCHEDULE);
      await AsyncStorage.removeItem(STORAGE_KEYS.SCHEDULE_LAST_UPDATE);
      console.log('Кэш расписания очищен');
    } catch (error) {
      console.error('Ошибка при очистке кэша:', error);
    }
  }
}

// ========== Компонент скелетон-загрузки ==========

/**
 * Скелетон-компонент для экрана расписания
 * Показывает анимированный макет во время загрузки данных
 */
const ScheduleSkeleton = ({ count = 3 }) => {
  // Создаем анимированное значение для эффекта пульсации
  const pulseAnim = useMemo(() => new RNAnimated.Value(0.3), []);

  // Запускаем анимацию пульсации при отображении компонента
  useEffect(() => {
    const pulse = RNAnimated.sequence([
      RNAnimated.timing(pulseAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      RNAnimated.timing(pulseAnim, {
        toValue: 0.3,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    // Бесконечное повторение анимации
    RNAnimated.loop(pulse).start();

    // Останавливаем анимацию при размонтировании компонента
    return () => {
      pulseAnim.stopAnimation();
    };
  }, []);

  // Стиль для анимированных элементов
  const animatedStyle = {
    opacity: pulseAnim,
  };

  // Создаем нужное количество элементов скелетона
  const skeletonItems = Array.from({ length: count }).map((_, index) => (
    <View key={index} style={styles.lessonCard}>
      <View style={styles.timeColumn}>
        <RNAnimated.View style={[styles.skeletonBox, styles.timeBox, animatedStyle]} />
        <RNAnimated.View style={[styles.skeletonBox, styles.timeBox, animatedStyle]} />
      </View>
      <View style={styles.contentColumn}>
        <RNAnimated.View style={[styles.skeletonBox, styles.titleBox, animatedStyle]} />
        <RNAnimated.View style={[styles.skeletonBox, styles.subtitleBox, animatedStyle]} />
        <RNAnimated.View style={[styles.skeletonBox, styles.teacherBox, animatedStyle]} />
      </View>
    </View>
  ));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNAnimated.View style={[styles.skeletonBox, styles.dateBox, animatedStyle]} />
      </View>
      {skeletonItems}
    </View>
  );
};

// ========== Основной компонент расписания ==========

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

dayjs.locale('ru');

const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes || '00'}`;
};

export default function Schedule() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [schedule, setSchedule] = useState([]);
  const [weekSchedule, setWeekSchedule] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const translateX = useSharedValue(0);

  // Обработка данных расписания
  const processSchedule = (data) => {
    if (!data || !Array.isArray(data)) {
      setSchedule([]);
      return;
    }

    const timeSlots = {};
    data.forEach((lesson) => {
      const isTeacherLesson =
        user.userType === 'teacher' && lesson.teacher_name === user.teacher;
      const isStudentLesson =
        user.userType === 'student' &&
        (lesson.subgroup === 0 || lesson.subgroup === user.subgroup || !user.subgroup);

      if (isTeacherLesson || isStudentLesson) {
        const timeKey = `${lesson.time_start}-${lesson.time_end}`;
        if (!timeSlots[timeKey]) {
          timeSlots[timeKey] = {
            id: timeKey,
            timeStart: lesson.time_start,
            timeEnd: lesson.time_end,
            lessons: [],
          };
        }

        if (user.userType === 'teacher') {
          const existingLesson = timeSlots[timeKey].lessons.find(
            (existing) =>
              existing.subject === lesson.subject &&
              existing.lesson_type === lesson.lesson_type &&
              existing.auditory === lesson.auditory
          );
          if (existingLesson) {
            if (!existingLesson.groups) existingLesson.groups = [existingLesson.group_name];
            if (!existingLesson.groups.includes(lesson.group_name))
              existingLesson.groups.push(lesson.group_name);
          } else {
            timeSlots[timeKey].lessons.push({ ...lesson, groups: [lesson.group_name] });
          }
        } else {
          timeSlots[timeKey].lessons.push(lesson);
        }
      }
    });

    const formattedSchedule = Object.entries(timeSlots)
      .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
      .map(([_, slot]) => ({
        ...slot,
        lessons: slot.lessons.sort((a, b) => (a.subgroup ?? 0) - (b.subgroup ?? 0)),
      }))
      .filter((slot) => slot.lessons.length > 0);

    setSchedule(formattedSchedule);
  };

  // Загрузка при первом рендере
  useEffect(() => {
    checkNetworkAndLoadData();
  }, []);

  // Загрузка данных при изменении даты
  useEffect(() => {
    if (weekSchedule[currentDate.format('YYYY-MM-DD')]) {
      processSchedule(weekSchedule[currentDate.format('YYYY-MM-DD')]);
    } else {
      loadSchedule();
    }
  }, [currentDate]);

  // Проверка сети и загрузка данных
  const checkNetworkAndLoadData = async () => {
    const networkAvailable = await ScheduleStorageService.isNetworkAvailable();
    setIsOffline(!networkAvailable);

    if (networkAvailable) {
      // Если есть сеть, загружаем свежие данные
      loadWeekSchedule();
    } else {
      // Если нет сети, пробуем загрузить из локального хранилища
      try {
        const cachedWeekSchedule = await ScheduleStorageService.getWeekSchedule();
        if (cachedWeekSchedule) {
          setWeekSchedule(cachedWeekSchedule);
          processSchedule(cachedWeekSchedule[currentDate.format('YYYY-MM-DD')]);
          setIsLoading(false);
          // Показываем уведомление о работе в офлайн-режиме
          Alert.alert(
            'Офлайн-режим',
            'Вы работаете с сохраненными данными. Подключитесь к интернету для получения актуального расписания.',
            [{ text: 'OK' }]
          );
        } else {
          setIsLoading(false);
          Alert.alert(
            'Нет данных',
            'Не удалось загрузить расписание. Пожалуйста, подключитесь к интернету.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных из кэша:', error);
        setIsLoading(false);
      }
    }
  };

  // Загрузка расписания на неделю с сервера
  const loadWeekSchedule = async () => {
    setIsLoading(true);
    const startOfWeek = currentDate.startOf('week');
    const dates = Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day'));

    try {
      // Проверяем актуальность кэша
      const isCacheValid = await ScheduleStorageService.isCacheValid();
      if (isCacheValid) {
        // Если кэш актуален, используем его
        const cachedWeekSchedule = await ScheduleStorageService.getWeekSchedule();
        if (cachedWeekSchedule) {
          setWeekSchedule(cachedWeekSchedule);
          processSchedule(cachedWeekSchedule[currentDate.format('YYYY-MM-DD')]);
          setIsLoading(false);
          return;
        }
      }

      // Если кэш не актуален или его нет, загружаем данные с сервера
      const results = await Promise.all(
        dates.map((date) =>
          api
            .get('/schedule', { params: { date: date.format('YYYY-MM-DD') } })
            .then((response) => ({ date: date.format('YYYY-MM-DD'), data: response.data }))
            .catch(() => ({ date: date.format('YYYY-MM-DD'), data: [] }))
        )
      );

      const newWeekSchedule = {};
      results.forEach(({ date, data }) => {
        newWeekSchedule[date] = data;
      });

      // Сохраняем данные в локальное хранилище
      await ScheduleStorageService.saveWeekSchedule(newWeekSchedule);

      setWeekSchedule(newWeekSchedule);
      processSchedule(newWeekSchedule[currentDate.format('YYYY-MM-DD')]);
    } catch (error) {
      console.error('Ошибка при загрузке расписания на неделю:', error);
      // Пробуем загрузить из кэша в случае ошибки
      const cachedWeekSchedule = await ScheduleStorageService.getWeekSchedule();
      if (cachedWeekSchedule) {
        setWeekSchedule(cachedWeekSchedule);
        processSchedule(cachedWeekSchedule[currentDate.format('YYYY-MM-DD')]);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Загрузка расписания на конкретную дату
  const loadSchedule = async () => {
    try {
      // Проверяем наличие сети
      const networkAvailable = await ScheduleStorageService.isNetworkAvailable();

      if (networkAvailable) {
        // Если есть сеть, загружаем с сервера
        const response = await api.get('/schedule', {
          params: { date: currentDate.format('YYYY-MM-DD') },
        });

        // Сохраняем полученные данные в локальное хранилище
        await ScheduleStorageService.saveScheduleData(
          currentDate.format('YYYY-MM-DD'),
          response.data
        );

        processSchedule(response.data);
      } else {
        // Если нет сети, пробуем загрузить из кэша
        const cachedData = await ScheduleStorageService.getScheduleForDate(
          currentDate.format('YYYY-MM-DD')
        );

        if (cachedData) {
          processSchedule(cachedData);
          setIsOffline(true);
        } else {
          setSchedule([]);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке расписания:', error);

      // Пробуем загрузить из кэша в случае ошибки
      const cachedData = await ScheduleStorageService.getScheduleForDate(
        currentDate.format('YYYY-MM-DD')
      );

      if (cachedData) {
        processSchedule(cachedData);
      } else {
        setSchedule([]);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Обновление данных при свайпе вниз
  const onRefresh = async () => {
    setRefreshing(true);
    // Проверяем наличие сети перед обновлением
    const networkAvailable = await ScheduleStorageService.isNetworkAvailable();
    if (networkAvailable) {
      setIsOffline(false);
      await loadWeekSchedule();
    } else {
      setIsOffline(true);
      setRefreshing(false);
      Alert.alert(
        'Нет соединения',
        'Не удается обновить расписание. Проверьте подключение к интернету.',
        [{ text: 'OK' }]
      );
    }
  };

  // Навигация по дням
  const goToNextDay = () => setCurrentDate((prev) => prev.add(1, 'day'));
  const goToPrevDay = () => setCurrentDate((prev) => prev.subtract(1, 'day'));

  // Настройка жестов для свайпа между днями
  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        if (e.translationX > 0) runOnJS(goToPrevDay)();
        else runOnJS(goToNextDay)();
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Рендер элемента расписания
  const renderLesson = ({ item }) => (
    <View style={styles.lessonCard}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatTime(item.timeStart)}
        </Text>
        <Text style={styles.timeText}>
          {formatTime(item.timeEnd)}
        </Text>
      </View>
      <View style={styles.lessonsContainer}>
        {item.lessons.map((lesson, index) => (
          <View key={`${lesson.id}-${index}`}>
            {index > 0 && <View style={styles.divider} />}
            <View style={styles.lessonInfo}>
              <Text style={styles.subjectText}>{lesson.subject}</Text>
              <Text style={styles.detailsText}>
                {lesson.lesson_type} • {lesson.auditory}
                {lesson.subgroup > 0 && ` • Подгруппа ${lesson.subgroup}`}
              </Text>
              <Text style={styles.teacherText}>
                {user.userType === 'student'
                  ? lesson.teacher_name
                  : lesson.groups?.join(', ') || lesson.group_name}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.navButton} onPress={goToPrevDay}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.dateText}>
              {currentDate.format('D MMMM, dddd')}
            </Text>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
                <Text style={styles.offlineText}>Офлайн режим</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.navButton} onPress={goToNextDay}>
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.scheduleContainer, animatedStyle]}>
            {isLoading ? (
              <ScheduleSkeleton count={4} />
            ) : (
              <FlatList
                data={schedule}
                renderItem={renderLesson}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
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
                    <Ionicons
                      name={isOffline ? "cloud-offline-outline" : "calendar-outline"}
                      size={48}
                      color="#8E8E93"
                    />
                    <Text style={styles.emptyText}>
                      {isOffline && !weekSchedule[currentDate.format('YYYY-MM-DD')]
                        ? "Нет сохраненных данных на эту дату"
                        : "Нет занятий на этот день"}
                    </Text>
                    <Text style={styles.emptySubText}>
                      {isOffline
                        ? "Подключитесь к интернету для загрузки расписания"
                        : "Наслаждайтесь свободным временем!"}
                    </Text>
                  </View>
                }
              />
            )}
          </Animated.View>
        </GestureDetector>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ========== Общие стили для всех компонентов ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scheduleContainer: {
    flex: 1,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  navButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'capitalize',
    letterSpacing: -0.3,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  offlineText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  lessonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeContainer: {
    width: 80,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  lessonsContainer: {
    flex: 1,
  },
  lessonInfo: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  subjectText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  teacherText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 17,
    color: '#000000',
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
  },

  // Стили для скелетона
  timeColumn: {
    width: 60,
    marginRight: 16,
    justifyContent: 'center',
  },
  contentColumn: {
    flex: 1,
  },
  skeletonBox: {
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
  },
  timeBox: {
    width: 48,
    height: 16,
    marginBottom: 8,
  },
  titleBox: {
    width: '80%',
    height: 20,
    marginBottom: 12,
    borderRadius: 6,
  },
  subtitleBox: {
    width: '60%',
    height: 16,
    marginBottom: 12,
    borderRadius: 6,
  },
  teacherBox: {
    width: '40%',
    height: 16,
    borderRadius: 6,
  },
  dateBox: {
    width: 150,
    height: 24,
    borderRadius: 12,
  },
});