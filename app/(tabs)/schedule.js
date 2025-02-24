import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useAuth } from '../../context/auth';
import api from '../../utils/api';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

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

  const translateX = useSharedValue(0);

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

  useEffect(() => {
    loadWeekSchedule();
  }, []);

  useEffect(() => {
    if (weekSchedule[currentDate.format('YYYY-MM-DD')]) {
      processSchedule(weekSchedule[currentDate.format('YYYY-MM-DD')]);
    } else {
      loadSchedule();
    }
  }, [currentDate]);

  const loadWeekSchedule = async () => {
    setIsLoading(true);
    const startOfWeek = currentDate.startOf('week');
    const dates = Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day'));

    try {
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
      setWeekSchedule(newWeekSchedule);
      processSchedule(newWeekSchedule[currentDate.format('YYYY-MM-DD')]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const response = await api.get('/schedule', {
        params: { date: currentDate.format('YYYY-MM-DD') },
      });
      processSchedule(response.data);
    } catch (error) {
      setSchedule([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWeekSchedule();
    setRefreshing(false);
  };

  const goToNextDay = () => setCurrentDate((prev) => prev.add(1, 'day'));
  const goToPrevDay = () => setCurrentDate((prev) => prev.subtract(1, 'day'));

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
          </View>
          <TouchableOpacity style={styles.navButton} onPress={goToNextDay}>
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.scheduleContainer, animatedStyle]}>
            {isLoading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Загрузка расписания...</Text>
              </View>
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
                    <Ionicons name="calendar-outline" size={48} color="#8E8E93" />
                    <Text style={styles.emptyText}>Нет занятий на этот день</Text>
                    <Text style={styles.emptySubText}>
                      Наслаждайтесь свободным временем!
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC', // Мягкий серо-голубой фон
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
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
});