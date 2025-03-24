import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  Platform,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const LessonDetailsModal = ({ visible, lesson, onClose, userType }) => {
  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.5)).current;

  // Run animations when modal becomes visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();

      // Sequence for icons animation
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
      iconScaleAnim.setValue(0.5);
    }
  }, [visible]);

  // Function to close modal with animation
  const closeWithAnimation = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };

  // Get color based on lesson type
  const getLessonTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'лекция':
        return ['#3E7BFA', '#6C9FFF'];
      case 'практика':
      case 'практическое занятие':
        return ['#33C759', '#68E996'];
      case 'лабораторная':
      case 'лабораторная работа':
        return ['#FF9500', '#FFBD59'];
      case 'семинар':
        return ['#AF52DE', '#CD7FF3'];
      case 'экзамен':
      case 'зачет':
        return ['#FF3B30', '#FF6B61'];
      default:
        return ['#5856D6', '#8482DF'];
    }
  };

  // Get icon for lesson type
  const getLessonTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'лекция':
        return 'school';
      case 'практика':
      case 'практическое занятие':
        return 'construct';
      case 'лабораторная':
      case 'лабораторная работа':
        return 'flask';
      case 'семинар':
        return 'people';
      case 'экзамен':
      case 'зачет':
        return 'checkmark-circle';
      default:
        return 'book';
    }
  };

  // Get status of the lesson based on lesson date and time
  const getStatusLabel = () => {
    // Get current date and time
    const now = new Date();

    // Parse lesson date (expected format: YYYY-MM-DD)
    const lessonDate = lesson?.date ? new Date(lesson.date) : null;

    // If we don't have a lesson date, fall back to using just time
    if (!lessonDate) {
      const [hours, minutes] = lesson?.time_start?.split(':') || [0, 0];
      const [endHours, endMinutes] = lesson?.time_end?.split(':') || [0, 0];

      const startTime = new Date();
      startTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);

      const endTime = new Date();
      endTime.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0);

      if (now < startTime) {
        const diff = Math.floor((startTime - now) / (1000 * 60));
        let timeText = '';
        if (diff < 60) {
          timeText = `через ${diff} мин`;
        } else {
          const hours = Math.floor(diff / 60);
          const mins = diff % 60;
          timeText = `через ${hours} ч ${mins > 0 ? mins + ' мин' : ''}`;
        }

        return {
          text: 'Предстоит',
          color: '#34C759',
          icon: 'time-outline',
          timeText
        };
      } else if (now >= startTime && now <= endTime) {
        const diff = Math.floor((endTime - now) / (1000 * 60));
        return {
          text: 'Идет сейчас',
          color: '#FF9500',
          icon: 'radio',
          timeText: `еще ${diff} мин`
        };
      } else {
        return {
          text: 'Завершено',
          color: '#8E8E93',
          icon: 'checkmark-done',
          timeText: ''
        };
      }
    }

    // Create full date-time objects for lesson start and end
    const [hours, minutes] = lesson?.time_start?.split(':') || [0, 0];
    const [endHours, endMinutes] = lesson?.time_end?.split(':') || [0, 0];

    const lessonStartTime = new Date(lessonDate);
    lessonStartTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);

    const lessonEndTime = new Date(lessonDate);
    lessonEndTime.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0);

    // Compare with current date and time
    if (now < lessonStartTime) {
      // Lesson is in the future
      const diff = lessonStartTime - now;
      const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let timeText = '';
      if (diffDays > 0) {
        timeText = `через ${diffDays} ${diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'}`;
      } else if (diffHours > 0) {
        timeText = `через ${diffHours} ч ${diffMinutes > 0 ? diffMinutes + ' мин' : ''}`;
      } else {
        timeText = `через ${diffMinutes} мин`;
      }

      return {
        text: 'Предстоит',
        color: '#34C759',
        icon: 'time-outline',
        timeText
      };
    } else if (now >= lessonStartTime && now <= lessonEndTime) {
      // Lesson is happening now
      const diff = Math.floor((lessonEndTime - now) / (1000 * 60));
      return {
        text: 'Идет сейчас',
        color: '#FF9500',
        icon: 'radio',
        timeText: `еще ${diff} мин`
      };
    } else {
      // Lesson is in the past
      return {
        text: 'Завершено',
        color: '#8E8E93',
        icon: 'checkmark-done',
        timeText: ''
      };
    }
  };

  // Handle share functionality
  const handleShare = async () => {
    try {
      const message = `${lesson.subject}\n${lesson.lesson_type}\n${lesson.time_start} - ${lesson.time_end}\nАудитория: ${lesson.auditory}\nПреподаватель: ${lesson.teacher_name}`;

      await Share.share({
        message,
        title: lesson.subject,
      });
    } catch (error) {
      console.error('Error sharing lesson:', error);
    }
  };

  // Handle "Add to Calendar" functionality (placeholder)
  const handleAddToCalendar = () => {
    // Integration with device calendar would go here
    // For now, just show an alert or feedback
    alert('Функция добавления в календарь будет доступна в следующем обновлении');
  };

  if (!lesson) return null;

  const status = getStatusLabel();
  const lessonTypeColors = getLessonTypeColor(lesson?.lesson_type);
  const lessonTypeIcon = getLessonTypeIcon(lesson?.lesson_type);

  // Determine classroom building from auditory name
  const getClassroomBuilding = (auditory) => {
    if (!auditory) return 'Не указано';

    // Simple logic - this would be replaced with your actual building mapping
    if (auditory.startsWith('1')) return 'Главный корпус';
    if (auditory.startsWith('2')) return 'Лабораторный корпус';
    if (auditory.startsWith('3')) return 'Новый корпус';

    return 'Корпус университета';
  };

  const building = getClassroomBuilding(lesson.auditory);

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={closeWithAnimation}
    >
      <Animated.View
        style={[
          styles.modalOverlay,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={closeWithAnimation}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={lessonTypeColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeWithAnimation}
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.lessonTypeContainer}>
                  <View style={styles.lessonTypeIconContainer}>
                    <Ionicons name={lessonTypeIcon} size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.lessonTypeText}>{lesson.lesson_type}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <Ionicons name={status.icon} size={14} color="#FFFFFF" style={styles.statusIcon} />
                  <Text style={styles.statusText}>{status.text}</Text>
                </View>
              </View>

              {status.timeText && (
                <View style={styles.timeTextContainer}>
                  <Text style={styles.timeText}>{status.timeText}</Text>
                </View>
              )}
            </SafeAreaView>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.subjectTitle}>{lesson.subject}</Text>

            <View style={styles.infoSection}>
              <Animated.View style={[
                styles.infoRow,
                { transform: [{ scale: iconScaleAnim }] }
              ]}>
                <View style={[styles.infoIcon, {backgroundColor: `${lessonTypeColors[0]}20`}]}>
                  <Ionicons name="time-outline" size={24} color={lessonTypeColors[0]} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Время</Text>
                  <Text style={styles.infoValue}>{lesson.time_start} - {lesson.time_end}</Text>
                </View>
              </Animated.View>

              <Animated.View style={[
                styles.infoRow,
                { transform: [{ scale: iconScaleAnim }] }
              ]}>
                <View style={[styles.infoIcon, {backgroundColor: `${lessonTypeColors[0]}20`}]}>
                  <Ionicons name="location-outline" size={24} color={lessonTypeColors[0]} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Аудитория</Text>
                  <Text style={styles.infoValue}>{lesson.auditory}</Text>
                  <Text style={styles.infoSecondary}>{building}</Text>
                </View>
              </Animated.View>

              {userType === 'student' ? (
                <Animated.View style={[
                  styles.infoRow,
                  { transform: [{ scale: iconScaleAnim }] }
                ]}>
                  <View style={[styles.infoIcon, {backgroundColor: `${lessonTypeColors[0]}20`}]}>
                    <Ionicons name="person-outline" size={24} color={lessonTypeColors[0]} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Преподаватель</Text>
                    <Text style={styles.infoValue}>{lesson.teacher_name}</Text>

                    <TouchableOpacity style={styles.contactButton}>
                      <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.contactButtonText}>Написать</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : (
                <Animated.View style={[
                  styles.infoRow,
                  { transform: [{ scale: iconScaleAnim }] }
                ]}>
                  <View style={[styles.infoIcon, {backgroundColor: `${lessonTypeColors[0]}20`}]}>
                    <Ionicons name="people-outline" size={24} color={lessonTypeColors[0]} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Группа</Text>
                    <Text style={styles.infoValue}>{lesson.group_name}</Text>
                    {lesson.subgroup > 0 && (
                      <Text style={styles.subgroupText}>Подгруппа {lesson.subgroup}</Text>
                    )}

                    <TouchableOpacity style={styles.contactButton}>
                      <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.contactButtonText}>Чат группы</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </View>

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, {backgroundColor: lessonTypeColors[0]}]}
                onPress={handleAddToCalendar}
              >
                <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>В календарь</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, {backgroundColor: '#8E8E93'}]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Поделиться</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.additionalInfo}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="information-circle-outline" size={22} color={lessonTypeColors[0]} />
                <Text style={[styles.sectionTitle, {color: lessonTypeColors[0]}]}>
                  Дополнительная информация
                </Text>
              </View>

              <View style={styles.additionalInfoItem}>
                <Text style={styles.additionalInfoLabel}>Факультет</Text>
                <Text style={styles.additionalInfoValue}>{lesson.faculty || 'Не указан'}</Text>
              </View>

              {lesson.course && (
                <View style={styles.additionalInfoItem}>
                  <Text style={styles.additionalInfoLabel}>Курс</Text>
                  <Text style={styles.additionalInfoValue}>{lesson.course}</Text>
                </View>
              )}

              <View style={styles.additionalInfoItem}>
                <Text style={styles.additionalInfoLabel}>Семестр</Text>
                <Text style={styles.additionalInfoValue}>{lesson.semester || 'Не указан'}</Text>
              </View>

              <View style={styles.additionalInfoItem}>
                <Text style={styles.additionalInfoLabel}>Номер недели</Text>
                <Text style={styles.additionalInfoValue}>{lesson.week_number || 'Не указан'}</Text>
              </View>

              <View style={styles.additionalInfoItem}>
                <Text style={styles.additionalInfoLabel}>День недели</Text>
                <Text style={styles.additionalInfoValue}>
                  {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][lesson.weekday - 1] || lesson.weekday}
                </Text>
              </View>
            </View>

            {/* Next upcoming lesson section */}
            <View style={styles.upcomingLessonSection}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="time-outline" size={22} color={lessonTypeColors[0]} />
                <Text style={[styles.sectionTitle, {color: lessonTypeColors[0]}]}>
                  Следующее занятие
                </Text>
              </View>

              <View style={styles.upcomingLessonCard}>
                <View style={styles.upcomingLessonHeader}>
                  <Text style={styles.upcomingLessonDay}>Завтра</Text>
                  <Text style={styles.upcomingLessonTime}>10:00 - 11:30</Text>
                </View>
                <Text style={styles.upcomingLessonTitle}>{lesson.subject}</Text>
                <View style={styles.upcomingLessonDetails}>
                  <View style={styles.upcomingDetailItem}>
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.upcomingDetailText}>{lesson.auditory}</Text>
                  </View>
                  <View style={styles.upcomingDetailItem}>
                    <Ionicons name="school-outline" size={16} color="#8E8E93" />
                    <Text style={styles.upcomingDetailText}>{lesson.lesson_type}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Последнее обновление: {new Date().toLocaleString()}
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 10,
  },
  safeArea: {
    width: '100%',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonTypeContainer: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  lessonTypeIconContainer: {
    marginRight: 8,
  },
  lessonTypeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  timeTextContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subjectTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  infoSecondary: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 8,
  },
  subgroupText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 0,
    marginBottom: 8,
  },

  contactButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  additionalInfo: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  additionalInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  additionalInfoLabel: {
    fontSize: 15,
    color: '#8E8E93',
  },
  additionalInfoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'right',
  },
  upcomingLessonSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  upcomingLessonCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
  },
  upcomingLessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  upcomingLessonDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  upcomingLessonTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  upcomingLessonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  upcomingLessonDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  upcomingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingDetailText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});

export default LessonDetailsModal;