// app/(admin)/schedule.js - Упрощенная версия
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../utils/api';

// Компонент кастомного выбора даты
const CustomDatePicker = ({ value, onChange }) => {
  // Списки для выбора
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 5);
  const months = [
    { value: 0, label: 'Январь' },
    { value: 1, label: 'Февраль' },
    { value: 2, label: 'Март' },
    { value: 3, label: 'Апрель' },
    { value: 4, label: 'Май' },
    { value: 5, label: 'Июнь' },
    { value: 6, label: 'Июль' },
    { value: 7, label: 'Август' },
    { value: 8, label: 'Сентябрь' },
    { value: 9, label: 'Октябрь' },
    { value: 10, label: 'Ноябрь' },
    { value: 11, label: 'Декабрь' }
  ];

  // Получение числа дней в месяце
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const [selectedDate, setSelectedDate] = useState({
    year: value.getFullYear(),
    month: value.getMonth(),
    day: value.getDate()
  });

  const daysInMonth = getDaysInMonth(selectedDate.year, selectedDate.month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleChange = (field, newValue) => {
    const newDate = { ...selectedDate, [field]: newValue };
    setSelectedDate(newDate);

    // Проверка валидности дня для нового месяца/года
    const maxDays = getDaysInMonth(newDate.year, newDate.month);
    if (newDate.day > maxDays) {
      newDate.day = maxDays;
    }

    // Создание объекта Date и вызов callback
    const dateObj = new Date(newDate.year, newDate.month, newDate.day);
    onChange(dateObj);
  };

  return (
    <View style={styles.datePicker}>
      <View style={styles.datePickerRow}>
        <View style={styles.datePickerColumn}>
          <Text style={styles.datePickerLabel}>День</Text>
          <ScrollView
            style={styles.datePickerScroll}
            showsVerticalScrollIndicator={false}
          >
            {days.map(day => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.datePickerItem,
                  selectedDate.day === day && styles.datePickerItemSelected
                ]}
                onPress={() => handleChange('day', day)}
              >
                <Text
                  style={[
                    styles.datePickerItemText,
                    selectedDate.day === day && styles.datePickerItemTextSelected
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.datePickerColumn}>
          <Text style={styles.datePickerLabel}>Месяц</Text>
          <ScrollView
            style={styles.datePickerScroll}
            showsVerticalScrollIndicator={false}
          >
            {months.map(month => (
              <TouchableOpacity
                key={month.value}
                style={[
                  styles.datePickerItem,
                  selectedDate.month === month.value && styles.datePickerItemSelected
                ]}
                onPress={() => handleChange('month', month.value)}
              >
                <Text
                  style={[
                    styles.datePickerItemText,
                    selectedDate.month === month.value && styles.datePickerItemTextSelected
                  ]}
                >
                  {month.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.datePickerColumn}>
          <Text style={styles.datePickerLabel}>Год</Text>
          <ScrollView
            style={styles.datePickerScroll}
            showsVerticalScrollIndicator={false}
          >
            {years.map(year => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.datePickerItem,
                  selectedDate.year === year && styles.datePickerItemSelected
                ]}
                onPress={() => handleChange('year', year)}
              >
                <Text
                  style={[
                    styles.datePickerItemText,
                    selectedDate.year === year && styles.datePickerItemTextSelected
                  ]}
                >
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export default function ScheduleManagement() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [filteredSchedules, setFilteredSchedules] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Поля для нового расписания
  const [formData, setFormData] = useState({
    date: new Date(),
    groupName: '',
    subject: '',
    lessonType: '',
    timeStart: '08:30',
    timeEnd: '10:00',
    teacherName: '',
    auditory: '',
    subgroup: 0,
  });

  // Демо-данные для расписания
  const demoSchedules = [
    { id: 1, date: '2025-03-25', group_name: '2211-0101.1', subject: 'Математический анализ', lesson_type: 'Лекция', time_start: '08:30', time_end: '10:00', teacher_name: 'Петров П.П.', auditory: '301', subgroup: 0 },
    { id: 2, date: '2025-03-25', group_name: '2211-0101.1', subject: 'Программирование', lesson_type: 'Практика', time_start: '10:15', time_end: '11:45', teacher_name: 'Сидорова А.В.', auditory: '215', subgroup: 1 },
    { id: 3, date: '2025-03-25', group_name: '2211-0102.1', subject: 'Физика', lesson_type: 'Лабораторная', time_start: '12:00', time_end: '13:30', teacher_name: 'Иванов И.И.', auditory: '105', subgroup: 0 },
    { id: 4, date: '2025-03-26', group_name: '2211-0101.1', subject: 'История', lesson_type: 'Семинар', time_start: '08:30', time_end: '10:00', teacher_name: 'Козлов Д.С.', auditory: '401', subgroup: 0 },
    { id: 5, date: '2025-03-26', group_name: '2212-0101.1', subject: 'Английский язык', lesson_type: 'Практика', time_start: '10:15', time_end: '11:45', teacher_name: 'Смирнова Н.В.', auditory: '318', subgroup: 0 },
    { id: 6, date: '2025-03-27', group_name: '2211-0102.1', subject: 'Информатика', lesson_type: 'Лекция', time_start: '12:00', time_end: '13:30', teacher_name: 'Сидорова А.В.', auditory: '112', subgroup: 0 },
  ];

  useEffect(() => {
    loadSchedules();
  }, []);

  useEffect(() => {
    filterSchedules();
  }, [searchQuery, filter, schedules]);

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      // В реальном приложении здесь будет API запрос
      // const response = await api.get('/admin/schedules');
      // setSchedules(response.data);

      // Используем демо-данные
      setTimeout(() => {
        setSchedules(demoSchedules);
        setIsLoading(false);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setIsLoading(false);
      setRefreshing(false);
      Alert.alert('Ошибка', 'Не удалось загрузить расписание');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedules();
  };

  const filterSchedules = () => {
    let filtered = [...schedules];

    // Фильтрация по периоду
    if (filter !== 'all') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      switch (filter) {
        case 'today':
          filtered = filtered.filter(item => item.date === todayStr);
          break;
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          filtered = filtered.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= weekStart && itemDate <= weekEnd;
          });
          break;
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          filtered = filtered.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= monthStart && itemDate <= monthEnd;
          });
          break;
      }
    }

    // Поиск по тексту
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.group_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.auditory.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredSchedules(filtered);
  };

  const handleCreateSchedule = () => {
    setSelectedSchedule(null);
    setFormData({
      date: new Date(),
      groupName: '',
      subject: '',
      lessonType: '',
      timeStart: '08:30',
      timeEnd: '10:00',
      teacherName: '',
      auditory: '',
      subgroup: 0,
    });
    setModalVisible(true);
  };

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      date: new Date(schedule.date),
      groupName: schedule.group_name,
      subject: schedule.subject,
      lessonType: schedule.lesson_type,
      timeStart: schedule.time_start,
      timeEnd: schedule.time_end,
      teacherName: schedule.teacher_name,
      auditory: schedule.auditory,
      subgroup: schedule.subgroup,
    });
    setModalVisible(true);
  };

  const handleDeleteSchedule = (id) => {
    Alert.alert(
      'Подтверждение',
      'Вы уверены, что хотите удалить это расписание?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              // В реальном приложении здесь будет API запрос
              // await api.delete(`/admin/schedules/${id}`);

              // Обновляем локальный список
              const updatedSchedules = schedules.filter(item => item.id !== id);
              setSchedules(updatedSchedules);

              Alert.alert('Успешно', 'Расписание удалено');
            } catch (error) {
              console.error('Error deleting schedule:', error);
              Alert.alert('Ошибка', 'Не удалось удалить расписание');
            }
          }
        }
      ]
    );
  };

  const handleSaveSchedule = async () => {
    // Валидация формы
    if (!formData.groupName || !formData.subject || !formData.lessonType ||
        !formData.timeStart || !formData.timeEnd || !formData.teacherName || !formData.auditory) {
      Alert.alert('Ошибка', 'Заполните все обязательные поля');
      return;
    }

    try {
      const scheduleData = {
        date: formData.date.toISOString().split('T')[0],
        group_name: formData.groupName,
        subject: formData.subject,
        lesson_type: formData.lessonType,
        time_start: formData.timeStart,
        time_end: formData.timeEnd,
        teacher_name: formData.teacherName,
        auditory: formData.auditory,
        subgroup: parseInt(formData.subgroup) || 0,
      };

      if (selectedSchedule) {
        // Редактирование существующего расписания
        // В реальном приложении здесь будет API запрос
        // await api.put(`/admin/schedules/${selectedSchedule.id}`, scheduleData);

        // Обновляем локальный список
        const updatedSchedules = schedules.map(item =>
          item.id === selectedSchedule.id ? { ...scheduleData, id: item.id } : item
        );
        setSchedules(updatedSchedules);

        Alert.alert('Успешно', 'Расписание обновлено');
      } else {
        // Создание нового расписания
        // В реальном приложении здесь будет API запрос
        // const response = await api.post('/admin/schedules', scheduleData);

        // Обновляем локальный список
        const newSchedule = {
          ...scheduleData,
          id: Math.max(...schedules.map(s => s.id), 0) + 1
        };
        setSchedules([...schedules, newSchedule]);

        Alert.alert('Успешно', 'Расписание создано');
      }

      setModalVisible(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить расписание');
    }
  };

  const handleDateChange = (selectedDate) => {
    setFormData({ ...formData, date: selectedDate });
    setShowDatePicker(false);
  };

  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getLessonTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case 'лекция': return '#3E7BFA';
      case 'практика': return '#34C759';
      case 'лабораторная': return '#FF9500';
      case 'семинар': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  const renderScheduleItem = ({ item }) => (
    <View style={styles.scheduleCard}>
      <View style={styles.scheduleHeader}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{formatDateForDisplay(item.date)}</Text>
        </View>
        <View style={[styles.lessonTypeBadge, { backgroundColor: getLessonTypeColor(item.lesson_type) }]}>
          <Text style={styles.lessonTypeText}>{item.lesson_type}</Text>
        </View>
      </View>

      <View style={styles.scheduleDetails}>
        <Text style={styles.subjectText}>{item.subject}</Text>
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={16} color="#8E8E93" />
          <Text style={styles.timeText}>{item.time_start} - {item.time_end}</Text>
        </View>
      </View>

      <View style={styles.scheduleInfo}>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={16} color="#8E8E93" />
          <Text style={styles.infoText}>{item.group_name}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="person-outline" size={16} color="#8E8E93" />
          <Text style={styles.infoText}>{item.teacher_name}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={16} color="#8E8E93" />
          <Text style={styles.infoText}>Ауд. {item.auditory}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditSchedule(item)}
        >
          <Ionicons name="create-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSchedule(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const ScheduleFormModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedSchedule ? 'Редактирование занятия' : 'Новое занятие'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowDatePicker(false);
                setModalVisible(false);
              }}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Дата</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <Text style={styles.dateValue}>
                  {formData.date.toLocaleDateString('ru-RU')}
                </Text>
                <Ionicons name="calendar" size={20} color="#007AFF" />
              </TouchableOpacity>

              {showDatePicker && (
                <CustomDatePicker
                  value={formData.date}
                  onChange={handleDateChange}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Группа</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Например: 2211-0101.1"
                value={formData.groupName}
                onChangeText={(text) => setFormData({ ...formData, groupName: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Предмет</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Название предмета"
                value={formData.subject}
                onChangeText={(text) => setFormData({ ...formData, subject: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Тип занятия</Text>
              <View style={styles.segmentedButtons}>
                {['Лекция', 'Практика', 'Лабораторная', 'Семинар'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.segmentButton,
                      formData.lessonType === type && styles.activeSegmentButton,
                      formData.lessonType === type && { backgroundColor: getLessonTypeColor(type) }
                    ]}
                    onPress={() => setFormData({ ...formData, lessonType: type })}
                  >
                    <Text style={[
                      styles.segmentButtonText,
                      formData.lessonType === type && styles.activeSegmentButtonText
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Начало</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="HH:MM"
                  value={formData.timeStart}
                  onChangeText={(text) => setFormData({ ...formData, timeStart: text })}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Окончание</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="HH:MM"
                  value={formData.timeEnd}
                  onChangeText={(text) => setFormData({ ...formData, timeEnd: text })}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Преподаватель</Text>
              <TextInput
                style={styles.formInput}
                placeholder="ФИО преподавателя"
                value={formData.teacherName}
                onChangeText={(text) => setFormData({ ...formData, teacherName: text })}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Аудитория</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Номер аудитории"
                  value={formData.auditory}
                  onChangeText={(text) => setFormData({ ...formData, auditory: text })}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Подгруппа</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0 - для всех"
                  value={formData.subgroup.toString()}
                  onChangeText={(text) => setFormData({ ...formData, subgroup: text })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveSchedule}
            >
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </TouchableOpacity>
          </ScrollView>
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
        <Text style={styles.headerTitle}>Управление расписанием</Text>
        <View style={{width: 36}} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по группе, предмету, аудитории"
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
          style={[styles.filterButton, filter === 'today' && styles.activeFilterButton]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterButtonText, filter === 'today' && styles.activeFilterText]}>
            Сегодня
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'week' && styles.activeFilterButton]}
          onPress={() => setFilter('week')}
        >
          <Text style={[styles.filterButtonText, filter === 'week' && styles.activeFilterText]}>
            Неделя
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'month' && styles.activeFilterButton]}
          onPress={() => setFilter('month')}
        >
          <Text style={[styles.filterButtonText, filter === 'month' && styles.activeFilterText]}>
            Месяц
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Загрузка расписания...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSchedules}
          renderItem={renderScheduleItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.schedulesList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#007AFF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>Расписание не найдено</Text>
              <Text style={styles.emptySubtext}>
                Попробуйте изменить параметры поиска или создайте новое расписание
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fabButton}
        onPress={handleCreateSchedule}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <ScheduleFormModal />
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
  schedulesList: {
    padding: 16,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#151940',
  },
  lessonTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lessonTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scheduleDetails: {
    marginBottom: 12,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#151940',
    marginBottom: 6,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
  },
  scheduleInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#151940',
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
    maxHeight: '80%',
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
    color: '#8E8E93',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#151940',
  },
  dateInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateValue: {
    fontSize: 16,
    color: '#151940',
  },
  segmentedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 8,
  },
  activeSegmentButton: {
    backgroundColor: '#007AFF',
  },
  segmentButtonText: {
    fontSize: 14,
    color: '#151940',
    fontWeight: '500',
  },
  activeSegmentButtonText: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Custom DatePicker styles
  datePicker: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePickerColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
  datePickerLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  datePickerScroll: {
    height: 150,
  },
  datePickerItem: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  datePickerItemSelected: {
    backgroundColor: '#007AFF',
  },
  datePickerItemText: {
    fontSize: 16,
    color: '#151940',
  },
  datePickerItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});