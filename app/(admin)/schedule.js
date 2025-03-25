import React, { useState, useEffect, useCallback } from 'react';
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
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

// Component for custom date picker
const CustomDatePicker = ({ value, onChange }) => {
  // Generate lists for selection
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

  // Get days in month
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

    // Check day validity for new month/year
    const maxDays = getDaysInMonth(newDate.year, newDate.month);
    if (newDate.day > maxDays) {
      newDate.day = maxDays;
    }

    // Create Date object and call callback
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [showTeacherSuggestions, setShowTeacherSuggestions] = useState(false);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);

  // Form data for new/edit schedule
  const [formData, setFormData] = useState({
    date: new Date(),
    group_name: '',
    subject: '',
    lesson_type: '',
    time_start: '08:30',
    time_end: '10:00',
    teacher_name: '',
    auditory: '',
    subgroup: 0,
    semester: '',
    week_number: '',
    course: '',
    faculty: ''
  });

  // Form validation errors
  const [errors, setErrors] = useState({});

  // Reset form errors for a field
  const clearError = (field) => {
    setErrors(prev => ({...prev, [field]: null}));
  };

  // Filter groups based on input
  const filterGroups = (text) => {
    if (!text) {
      setFilteredGroups([]);
      setShowGroupSuggestions(false);
      return;
    }

    const filtered = groups.filter(group =>
      group.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 5);

    setFilteredGroups(filtered);
    setShowGroupSuggestions(filtered.length > 0);
  };

  // Filter teachers based on input
  const filterTeachers = (text) => {
    if (!text) {
      setFilteredTeachers([]);
      setShowTeacherSuggestions(false);
      return;
    }

    const filtered = teachers.filter(teacher =>
      teacher.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 5);

    setFilteredTeachers(filtered);
    setShowTeacherSuggestions(filtered.length > 0);
  };

  // Load schedules from API
  const loadSchedules = useCallback(async () => {
    try {
      setIsLoading(true);

      // Prepare query parameters based on filter
      const params = new URLSearchParams();

      // Get current date
      const today = dayjs();

      if (filter === 'today') {
        params.append('date', today.format('YYYY-MM-DD'));
      }
      else if (filter === 'week') {
        // Week filter
        const startOfWeek = today.startOf('week').format('YYYY-MM-DD');
        const endOfWeek = today.endOf('week').format('YYYY-MM-DD');
        params.append('date_from', startOfWeek);
        params.append('date_to', endOfWeek);
      }
      else if (filter === 'month') {
        // Month filter
        const startOfMonth = today.startOf('month').format('YYYY-MM-DD');
        const endOfMonth = today.endOf('month').format('YYYY-MM-DD');
        params.append('date_from', startOfMonth);
        params.append('date_to', endOfMonth);
      }

      // Add search parameter if provided
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // Fetch schedules
      const response = await api.get(`/admin/schedules?${params.toString()}`);

      if (response.data) {
        setSchedules(response.data);
        // Also update filtered schedules
        setFilteredSchedules(response.data);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить данные расписания. Проверьте подключение к сети.'
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filter, searchQuery]);

  // Load groups and teachers for form autocomplete
  const loadFormData = async () => {
    try {
      // Load groups
      const groupsResponse = await api.get('/groups');
      if (groupsResponse.data) {
        setGroups(groupsResponse.data);
      }

      // Load teachers
      const teachersResponse = await api.get('/teachers');
      if (teachersResponse.data) {
        setTeachers(teachersResponse.data);
      }
    } catch (error) {
      console.error('Error loading form reference data:', error);
    }
  };

  // Initial data loading
  useEffect(() => {
    loadSchedules();
    loadFormData();
  }, [loadSchedules]);

  // Filter schedules when searchQuery changes
  useEffect(() => {
    if (schedules.length === 0) return;

    let filtered = [...schedules];

    // Filter by text if search query is provided
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        (item.group_name && item.group_name.toLowerCase().includes(query)) ||
        (item.subject && item.subject.toLowerCase().includes(query)) ||
        (item.teacher_name && item.teacher_name.toLowerCase().includes(query)) ||
        (item.auditory && item.auditory.toLowerCase().includes(query))
      );
    }

    setFilteredSchedules(filtered);
  }, [searchQuery, schedules]);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadSchedules();
  };

  // Create new schedule
  const handleCreateSchedule = () => {
    // Reset form data
    setSelectedSchedule(null);
    setFormData({
      date: new Date(),
      group_name: '',
      subject: '',
      lesson_type: '',
      time_start: '08:30',
      time_end: '10:00',
      teacher_name: '',
      auditory: '',
      subgroup: 0,
      semester: '',
      week_number: '',
      course: '',
      faculty: ''
    });
    setErrors({});
    setModalVisible(true);
  };

  // Edit schedule
  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);

    // Convert date string to Date object
    const scheduleDate = schedule.date ? new Date(schedule.date) : new Date();

    setFormData({
      date: scheduleDate,
      group_name: schedule.group_name || '',
      subject: schedule.subject || '',
      lesson_type: schedule.lesson_type || '',
      time_start: schedule.time_start || '08:30',
      time_end: schedule.time_end || '10:00',
      teacher_name: schedule.teacher_name || '',
      auditory: schedule.auditory || '',
      subgroup: schedule.subgroup || 0,
      semester: schedule.semester || '',
      week_number: schedule.week_number || '',
      course: schedule.course || '',
      faculty: schedule.faculty || ''
    });

    setErrors({});
    setModalVisible(true);
  };

  // Delete schedule confirmation
  const handleDeleteSchedule = (id) => {
    const schedule = schedules.find(s => s.id === id);
    if (schedule) {
      setSelectedSchedule(schedule);
      setConfirmDeleteVisible(true);
    }
  };

  // Confirm delete schedule
  const confirmDeleteSchedule = async () => {
    if (!selectedSchedule || isSubmitting) return;

    try {
      setIsSubmitting(true);

      await api.delete(`/admin/schedule/${selectedSchedule.id}`);

      // Update state
      setSchedules(prev => prev.filter(s => s.id !== selectedSchedule.id));
      setFilteredSchedules(prev => prev.filter(s => s.id !== selectedSchedule.id));

      // Close modals
      setConfirmDeleteVisible(false);

      Alert.alert(
        'Успешно',
        'Занятие удалено из расписания'
      );
    } catch (error) {
      console.error('Error deleting schedule:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось удалить занятие. Попробуйте позже.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle save schedule (create/update)
  const handleSaveSchedule = async () => {
    // Validate form
    const validationErrors = {};

    // Required fields
    if (!formData.group_name) validationErrors.group_name = 'Укажите группу';
    if (!formData.subject) validationErrors.subject = 'Укажите предмет';
    if (!formData.lesson_type) validationErrors.lesson_type = 'Выберите тип занятия';
    if (!formData.time_start) validationErrors.time_start = 'Укажите время начала';
    if (!formData.time_end) validationErrors.time_end = 'Укажите время окончания';
    if (!formData.teacher_name) validationErrors.teacher_name = 'Укажите преподавателя';
    if (!formData.auditory) validationErrors.auditory = 'Укажите аудиторию';

    // Show errors if any
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare data for API
      const scheduleData = {
        // Format date as YYYY-MM-DD
        date: dayjs(formData.date).format('YYYY-MM-DD'),
        group_name: formData.group_name,
        subject: formData.subject,
        lesson_type: formData.lesson_type,
        time_start: formData.time_start,
        time_end: formData.time_end,
        teacher_name: formData.teacher_name,
        auditory: formData.auditory,
        subgroup: parseInt(formData.subgroup) || 0,
        semester: formData.semester || null,
        week_number: formData.week_number || null,
        course: formData.course || null,
        faculty: formData.faculty || null,
        // Calculate weekday from date (1-7, where 1 is Monday)
        weekday: dayjs(formData.date).day() || 7 // Adjust for dayjs 0-6 (Sunday-Saturday)
      };

      let response;

      if (selectedSchedule) {
        // Update existing schedule
        response = await api.put(`/admin/schedule/${selectedSchedule.id}`, scheduleData);

        // Update state
        setSchedules(prev => prev.map(s =>
          s.id === selectedSchedule.id ? { ...s, ...scheduleData, id: s.id } : s
        ));

        Alert.alert('Успешно', 'Занятие обновлено');
      } else {
        // Create new schedule
        response = await api.post('/admin/schedule', scheduleData);

        // Update state with new schedule
        if (response.data && response.data.id) {
          setSchedules(prev => [...prev, { ...scheduleData, id: response.data.id }]);
        }

        Alert.alert('Успешно', 'Занятие добавлено в расписание');
      }

      // Close modal
      setModalVisible(false);

      // Refresh schedules list
      loadSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось сохранить занятие. Проверьте введенные данные.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Date change handler
  const handleDateChange = (selectedDate) => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    setShowDatePicker(false);
  };

  // Format date for display
  const formatDateForDisplay = (dateString) => {
    const date = dayjs(dateString);
    return date.format('DD.MM.YYYY');
  };

  // Get lesson type color
  const getLessonTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'лекция': return '#3E7BFA';
      case 'практика': return '#34C759';
      case 'лабораторная': return '#FF9500';
      case 'семинар': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  // Render schedule item
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

  // Schedule Form Modal
  const ScheduleFormModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => {
        setShowDatePicker(false);
        setModalVisible(false);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
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
              <Text style={styles.formLabel}>Дата <Text style={styles.requiredText}>*</Text></Text>
              <TouchableOpacity
                style={[styles.dateInput, errors.date && styles.inputError]}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <Text style={styles.dateValue}>
                  {dayjs(formData.date).format('DD.MM.YYYY')}
                </Text>
                <Ionicons name="calendar" size={20} color="#007AFF" />
              </TouchableOpacity>

              {showDatePicker && (
                <CustomDatePicker
                  value={formData.date}
                  onChange={handleDateChange}
                />
              )}
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Группа <Text style={styles.requiredText}>*</Text></Text>
              <View style={styles.suggestionsContainer}>
                <TextInput
                  style={[styles.formInput, errors.group_name && styles.inputError]}
                  placeholder="Например: 2211-0101.1"
                  value={formData.group_name}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, group_name: text }));
                    filterGroups(text);
                    clearError('group_name');
                  }}
                  onFocus={() => filterGroups(formData.group_name)}
                  onBlur={() => setTimeout(() => setShowGroupSuggestions(false), 200)}
                />
                {showGroupSuggestions && filteredGroups.length > 0 && (
                  <View style={styles.suggestions}>
                    {filteredGroups.map((group, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setFormData(prev => ({ ...prev, group_name: group }));
                          setShowGroupSuggestions(false);
                        }}
                      >
                        <Text style={styles.suggestionText}>{group}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {errors.group_name && <Text style={styles.errorText}>{errors.group_name}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Предмет <Text style={styles.requiredText}>*</Text></Text>
              <TextInput
                style={[styles.formInput, errors.subject && styles.inputError]}
                placeholder="Название предмета"
                value={formData.subject}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, subject: text }));
                  clearError('subject');
                }}
              />
              {errors.subject && <Text style={styles.errorText}>{errors.subject}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Тип занятия <Text style={styles.requiredText}>*</Text></Text>
              <View style={styles.segmentedButtons}>
                {['Лекция', 'Практика', 'Лабораторная', 'Семинар'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.segmentButton,
                      formData.lesson_type === type && styles.activeSegmentButton,
                      formData.lesson_type === type && { backgroundColor: getLessonTypeColor(type) }
                    ]}
                    onPress={() => {
                      setFormData(prev => ({ ...prev, lesson_type: type }));
                      clearError('lesson_type');
                    }}
                  >
                    <Text style={[
                      styles.segmentButtonText,
                      formData.lesson_type === type && styles.activeSegmentButtonText
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.lesson_type && <Text style={styles.errorText}>{errors.lesson_type}</Text>}
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Начало <Text style={styles.requiredText}>*</Text></Text>
                <TextInput
                  style={[styles.formInput, errors.time_start && styles.inputError]}
                  placeholder="ЧЧ:ММ"
                  value={formData.time_start}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, time_start: text }));
                    clearError('time_start');
                  }}
                  keyboardType="numbers-and-punctuation"
                />
                {errors.time_start && <Text style={styles.errorText}>{errors.time_start}</Text>}
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Окончание <Text style={styles.requiredText}>*</Text></Text>
                <TextInput
                  style={[styles.formInput, errors.time_end && styles.inputError]}
                  placeholder="ЧЧ:ММ"
                  value={formData.time_end}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, time_end: text }));
                    clearError('time_end');
                  }}
                  keyboardType="numbers-and-punctuation"
                />
                {errors.time_end && <Text style={styles.errorText}>{errors.time_end}</Text>}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Преподаватель <Text style={styles.requiredText}>*</Text></Text>
              <View style={styles.suggestionsContainer}>
                <TextInput
                  style={[styles.formInput, errors.teacher_name && styles.inputError]}
                  placeholder="ФИО преподавателя"
                  value={formData.teacher_name}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, teacher_name: text }));
                    filterTeachers(text);
                    clearError('teacher_name');
                  }}
                  onFocus={() => filterTeachers(formData.teacher_name)}
                  onBlur={() => setTimeout(() => setShowTeacherSuggestions(false), 200)}
                />
                {showTeacherSuggestions && filteredTeachers.length > 0 && (
                  <View style={styles.suggestions}>
                    {filteredTeachers.map((teacher, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setFormData(prev => ({ ...prev, teacher_name: teacher }));
                          setShowTeacherSuggestions(false);
                        }}
                      >
                        <Text style={styles.suggestionText}>{teacher}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {errors.teacher_name && <Text style={styles.errorText}>{errors.teacher_name}</Text>}
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Аудитория <Text style={styles.requiredText}>*</Text></Text>
                <TextInput
                  style={[styles.formInput, errors.auditory && styles.inputError]}
                  placeholder="Номер аудитории"
                  value={formData.auditory}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, auditory: text }));
                    clearError('auditory');
                  }}
                />
                {errors.auditory && <Text style={styles.errorText}>{errors.auditory}</Text>}
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Подгруппа</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0 - для всех"
                  value={formData.subgroup?.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, subgroup: text }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Дополнительная информация</Text>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formSubLabel}>Семестр</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Семестр"
                    value={formData.semester?.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, semester: text }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formSubLabel}>Неделя</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Номер недели"
                    value={formData.week_number?.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, week_number: text }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formSubLabel}>Курс</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Курс"
                    value={formData.course?.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, course: text }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formSubLabel}>Факультет</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Факультет"
                    value={formData.faculty}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, faculty: text }))}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSubmitting && styles.disabledButton]}
              onPress={handleSaveSchedule}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Сохранить</Text>
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
          <Text style={styles.confirmTitle}>Удаление занятия</Text>
          <Text style={styles.confirmText}>
            Вы уверены, что хотите удалить занятие по предмету "{selectedSchedule?.subject}" для группы {selectedSchedule?.group_name}?
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
              onPress={confirmDeleteSchedule}
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
    color: '#151940',
    fontWeight: '500',
    marginBottom: 8,
  },
  formSubLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 6,
  },
  requiredText: {
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
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
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
  suggestionsContainer: {
    position: 'relative',
    zIndex: 1000,
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
    maxHeight: 180,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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