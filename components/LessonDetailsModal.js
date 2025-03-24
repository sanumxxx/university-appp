import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LessonDetailsModal = ({ visible, lesson, onClose, userType }) => {
  // Определяем цвет фона в зависимости от типа занятия
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

  const getStatusLabel = () => {
    const now = new Date();
    const [hours, minutes] = lesson?.time_start?.split(':') || [0, 0];
    const [endHours, endMinutes] = lesson?.time_end?.split(':') || [0, 0];

    const startTime = new Date();
    startTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);

    const endTime = new Date();
    endTime.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0);

    if (now < startTime) {
      return { text: 'Предстоит', color: '#34C759' };
    } else if (now >= startTime && now <= endTime) {
      return { text: 'Идет сейчас', color: '#FF9500' };
    } else {
      return { text: 'Завершено', color: '#8E8E93' };
    }
  };

  const status = getStatusLabel();
  const lessonTypeColors = getLessonTypeColor(lesson?.lesson_type);

  if (!lesson) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={styles.modalContainer}>
          <LinearGradient
            colors={lessonTypeColors}
            style={styles.header}
          >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.lessonTypeContainer}>
                  <Text style={styles.lessonTypeText}>{lesson.lesson_type}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <View style={[styles.statusIndicator, { backgroundColor: status.color }]} />
                  <Text style={styles.statusText}>{status.text}</Text>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>

          <ScrollView style={styles.content}>
            <Text style={styles.subjectTitle}>{lesson.subject}</Text>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="time-outline" size={24} color={lessonTypeColors[0]} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Время</Text>
                  <Text style={styles.infoValue}>{lesson.time_start} - {lesson.time_end}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="location-outline" size={24} color={lessonTypeColors[0]} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Аудитория</Text>
                  <Text style={styles.infoValue}>{lesson.auditory}</Text>
                </View>
              </View>

              {userType === 'student' ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="person-outline" size={24} color={lessonTypeColors[0]} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Преподаватель</Text>
                    <Text style={styles.infoValue}>{lesson.teacher_name}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="people-outline" size={24} color={lessonTypeColors[0]} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Группа</Text>
                    <Text style={styles.infoValue}>{lesson.group_name}</Text>
                    {lesson.subgroup > 0 && (
                      <Text style={styles.subgroupText}>Подгруппа {lesson.subgroup}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.additionalInfo}>
              <Text style={styles.sectionTitle}>Дополнительная информация</Text>

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
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
    paddingBottom: 20,
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
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subjectTitle: {
    fontSize: 24,
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
    marginBottom: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
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
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  subgroupText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  additionalInfo: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
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
});

export default LessonDetailsModal;