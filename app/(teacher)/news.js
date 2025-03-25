// app/(teacher)/news.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
    ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

// Компонент скелетона для новостей
const NewsSkeleton = () => {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
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
    <View style={styles.newsCard}>
      <Animated.View
        style={[styles.skeletonImage, { opacity: fadeAnim }]}
      />
      <View style={styles.newsContent}>
        <Animated.View
          style={[styles.skeletonTitle, { opacity: fadeAnim }]}
        />
        <Animated.View
          style={[styles.skeletonDescription, { opacity: fadeAnim }]}
        />
        <View style={styles.newsFooter}>
          <Animated.View
            style={[styles.skeletonDate, { opacity: fadeAnim }]}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View>
      {[1, 2, 3, 4].map((_, index) => (
        <React.Fragment key={index}>
          {renderSkeletonItem()}
        </React.Fragment>
      ))}
    </View>
  );
};

// Основной компонент экрана новостей для преподавателей
export default function TeacherNews() {
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'department', 'teachers', 'important'
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'Учеба',
    important: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Компонент плейсхолдера для изображений
  const NewsImagePlaceholder = ({ category }) => {
    // Выбираем иконку в зависимости от категории новости
    const getIconName = () => {
      switch (category) {
        case 'Учеба':
          return 'school';
        case 'Наука':
          return 'flask';
        case 'Спорт':
          return 'basketball';
        case 'Информация':
          return 'information-circle';
        case 'Культура':
          return 'color-palette';
        case 'Преподавателям':
          return 'people';
        default:
          return 'newspaper';
      }
    };

    // Выбираем цвет в зависимости от категории
    const getBackgroundColor = () => {
      switch (category) {
        case 'Учеба':
          return '#5856D6';
        case 'Наука':
          return '#007AFF';
        case 'Спорт':
          return '#34C759';
        case 'Информация':
          return '#FF9500';
        case 'Культура':
          return '#FF2D55';
        case 'Преподавателям':
          return '#AF52DE';
        default:
          return '#8E8E93';
      }
    };

    return (
      <View style={[styles.placeholderImage, { backgroundColor: getBackgroundColor() }]}>
        <Ionicons name={getIconName()} size={48} color="#FFFFFF" />
        <Text style={styles.placeholderText}>{category}</Text>
      </View>
    );
  };

  // Дефолтные новости из МелГУ с дополнительными объявлениями для преподавателей
  const defaultNews = [
    {
      id: 1,
      title: 'Интерактивное занятие от кадровой школы "PROдвижение" в МелГУ!',
      content: 'На базе нашего университета состоялось увлекательное интерактивное занятие, организованное представителями кадровой школы "PROдвижение".\nРанее ребята из Краснодара уже презентовали этот проект и рассказали о возможностях, которые предлагает данная школа. Студенты получили уникальную возможность узнать о перспективах, которые открываются перед ними по окончании курса, а также о том, как справляться с различными ситуациями, будучи вожатыми в детском лагере.\nВ игровой форме ребята познакомились со спецификой профессии вожатого, узнали о важных навыках и качествах, которые помогут им в этой роли. Занятие прошло в дружеской атмосфере, где каждый мог активно участвовать и задавать вопросы.',
      image: 'https://melsu.ru/storage/images/uploads/PNmvmYodOMVkjIS6mIxvMTq5UmXw14xNDAp6zkIG/image.webp',
      author: 'Пресс-служба МелГУ',
      published_at: '2025-03-22T10:00:00',
      category: 'События'
    },
    {
      id: 2,
      title: 'Научно-практическое партнёрство: МелГУ и ГБУ «Гидромелиорация» объединяют усилия',
      content: 'Представители МелГУ посетили ГБУ «Гидромелиорация» для обсуждения актуальных вопросов, касающихся совершенствования систем орошения в регионе. Встреча стала важным шагом к объединению научных знаний и практических решений в сфере водного хозяйства.\n\nВ ходе встречи представители МелГУ и ГБУ «Гидромелиорация» выделили ряд ключевых проблем, требующих решения в сфере орошения Запорожской области:\n\n1. Изношенность инфраструктуры – необходимость комплексной оценки технического состояния гидротехнических сооружений и насосных станций.\n2. Устаревшие оросительные системы – требуются современные технологии и материалы для их модернизации, повышения эффективности и сокращения потерь воды.\n3. Ограниченность водных ресурсов – необходимость внедрения капельного орошения, дождевания и других инновационных методов для оптимального использования воды.\n4. Дефицит квалифицированных специалистов – потребность в образовательных программах и стажировках для подготовки кадров в области мелиорации и водного хозяйства.\n5. Поиск альтернативных источников воды – рассмотрение возможности использования очищенных сточных вод и других нестандартных решений с соблюдением экологических норм.\n6. Засоление почв – разработка мер по предотвращению и устранению этой проблемы, включая выбор солеустойчивых сельскохозяйственных культур и проведение мелиоративных мероприятий.',
      image: 'https://melsu.ru/storage/images/uploads/gWDQUbUqivllP15xb79fiQH2sRxT7SoAe5d8WL65/image.webp',
      author: 'Пресс-служба МелГУ',
      published_at: '2025-03-21T13:30:00',
      category: 'Наука'
    },
    {
      id: 3,
      title: 'Круглый стол по вопросам развития педагогического образования!',
      content: 'В рамках IV Всероссийского форума по вопросам развития педагогического образования Российской академии образования на базе Мелитопольского государственного университета прошел онлайн круглый стол, организованный Запорожским научным центром РАО.\nТема обсуждения — «Психолого-педагогические проблемы обеспечения догоняющей и опережающей подготовки обучающихся школ, колледжей и учреждений высшего образования».',
      image: 'https://melsu.ru/storage/images/uploads/v11cqwC6vygwkyujV1i7wm49BmY7JxPd8taueS8v/image.webp',
      author: 'Пресс-служба МелГУ',
      published_at: '2025-03-19T09:15:00',
      category: 'Образование'
    },
    {
      id: 4,
      title: 'Напоминание о сдаче отчетов по научной деятельности',
      content: 'Уважаемые преподаватели! Напоминаем, что до 31 марта необходимо предоставить отчеты о научной деятельности за первый квартал 2025 года. В отчете должны быть отражены публикации, участие в конференциях, научное руководство студентами и аспирантами, а также информация о текущих исследовательских проектах.\n\nОтчеты принимаются в электронном виде через систему ИС "Наука" или на электронную почту science@melgu.edu. По всем вопросам обращайтесь в отдел научно-исследовательской работы (ауд. 412).',
      image: null,
      author: 'Научный отдел',
      published_at: '2025-03-24T15:45:00',
      category: 'Преподавателям',
      important: true
    },
    {
      id: 5,
      title: 'Изменения в процедуре выдачи зачетно-экзаменационных ведомостей',
      content: 'Уважаемые преподаватели! Информируем вас об изменениях в процедуре выдачи и сдачи зачетно-экзаменационных ведомостей. С 1 апреля 2025 года зачетно-экзаменационные ведомости будут формироваться в электронном виде через личный кабинет преподавателя в ИС "Деканат". После заполнения ведомости ее необходимо распечатать, подписать и сдать в деканат в течение 3 рабочих дней после проведения зачета или экзамена.\n\nТакже вводится система электронного дублирования оценок, предполагающая занесение результатов в систему непосредственно в день проведения аттестационного мероприятия. Это позволит оперативно информировать студентов о полученных результатах и формировать статистические отчеты в реальном времени.\n\nВ связи с переходом на новую процедуру, 28 марта в 15:00 в аудитории 305 состоится обучающий семинар по работе с модулем "Ведомости" в ИС "Деканат". Присутствие всех преподавателей обязательно.',
      image: null,
      author: 'Учебный отдел',
      published_at: '2025-03-23T10:30:00',
      category: 'Преподавателям'
    }
  ];

  useEffect(() => {
    loadNews();
  }, [filter]);

  // Функция загрузки новостей
  const loadNews = async () => {
    setIsLoading(true);
    try {
      // В реальном приложении здесь будет API запрос с учетом фильтра
      // Имитируем задержку сети
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Фильтрация новостей согласно выбранному фильтру
      let filteredNews = defaultNews;

      if (filter !== 'all') {
        const categoryMap = {
          'department': ['Образование', 'Учеба'],
          'teachers': ['Преподавателям'],
          'important': ['Информация']
        };

        if (filter === 'important') {
          filteredNews = defaultNews.filter(item => item.important === true);
        } else {
          const allowedCategories = categoryMap[filter] || [];
          filteredNews = defaultNews.filter(item => allowedCategories.includes(item.category));
        }
      }

      // Загружаем сохраненные объявления преподавателя
      const savedAnnouncements = await loadSavedAnnouncements();

      // Добавляем их к общему списку новостей
      const allNews = [...filteredNews, ...savedAnnouncements];

      // Сортируем по дате публикации (от новых к старым)
      allNews.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

      // Используем демо-данные вместо реального API
      setNews(allNews);

      // Сохраняем новости в кэш
      await AsyncStorage.setItem('cached_news', JSON.stringify(defaultNews));
      setIsOffline(false);
    } catch (error) {
      console.error('Ошибка при загрузке новостей:', error);

      // Пытаемся загрузить новости из кэша при ошибке
      try {
        const cachedNews = await AsyncStorage.getItem('cached_news');
        const savedAnnouncements = await loadSavedAnnouncements();

        if (cachedNews) {
          const cachedNewsData = JSON.parse(cachedNews);
          const allNews = [...cachedNewsData, ...savedAnnouncements];
          allNews.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

          setNews(allNews);
          setIsOffline(true);
          Alert.alert(
            'Офлайн-режим',
            'Показаны сохраненные новости. Подключитесь к интернету для получения актуальных данных.'
          );
        }
      } catch (cacheError) {
        console.error('Ошибка при загрузке кэшированных новостей:', cacheError);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Загрузка сохраненных объявлений преподавателя
  const loadSavedAnnouncements = async () => {
    try {
      const savedData = await AsyncStorage.getItem(`teacher_announcements_${user.id}`);
      if (savedData) {
        return JSON.parse(savedData);
      }
      return [];
    } catch (error) {
      console.error('Ошибка при загрузке объявлений:', error);
      return [];
    }
  };

  // Сохранение объявления преподавателя
  const saveAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      Alert.alert('Ошибка', 'Заполните заголовок и текст объявления');
      return;
    }

    setIsSubmitting(true);

    try {
      // Загружаем текущие объявления
      const currentAnnouncements = await loadSavedAnnouncements();

      // Создаем новое объявление
      const announcement = {
        id: Date.now(), // Используем timestamp как уникальный ID
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        category: newAnnouncement.category,
        important: newAnnouncement.important,
        author: user.teacher || user.fullName,
        published_at: new Date().toISOString(),
        createdByTeacher: true // Маркер, что создано преподавателем
      };

      // Добавляем к существующим
      const updatedAnnouncements = [...currentAnnouncements, announcement];

      // Сохраняем в хранилище
      await AsyncStorage.setItem(
        `teacher_announcements_${user.id}`,
        JSON.stringify(updatedAnnouncements)
      );

      // Обновляем список новостей
      setNews(prev => [announcement, ...prev]);

      // Сбрасываем форму и закрываем модальное окно
      setNewAnnouncement({
        title: '',
        content: '',
        category: 'Учеба',
        important: false
      });

      setCreateModalVisible(false);

      Alert.alert('Успешно', 'Объявление опубликовано');

      // Перезагружаем новости
      loadNews();

    } catch (error) {
      console.error('Ошибка при сохранении объявления:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить объявление');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обработчик обновления при свайпе вниз
  const onRefresh = () => {
    setRefreshing(true);
    loadNews();
  };

  // Форматирование даты публикации
  const formatPublishedDate = (dateString) => {
    const date = dayjs(dateString);
    const now = dayjs();

    if (now.diff(date, 'day') === 0) {
      return `Сегодня, ${date.format('HH:mm')}`;
    } else if (now.diff(date, 'day') === 1) {
      return `Вчера, ${date.format('HH:mm')}`;
    } else if (now.diff(date, 'day') < 7) {
      return date.format('dddd, HH:mm');
    } else {
      return date.format('D MMMM YYYY');
    }
  };

  // Просмотр полной новости
  const viewNewsDetail = (item) => {
    // Если новость создана текущим преподавателем, позволяем ее редактировать или удалять
    if (item.createdByTeacher) {
      Alert.alert(
        item.title,
        item.content,
        [
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: () => deleteAnnouncement(item.id)
          },
          { text: 'Закрыть', style: 'cancel' }
        ]
      );
    } else {
      Alert.alert(
        item.title,
        item.content,
        [{ text: 'Закрыть', style: 'cancel' }]
      );
    }
  };

  // Удаление объявления
  const deleteAnnouncement = async (id) => {
    try {
      // Запрашиваем подтверждение
      Alert.alert(
        'Удаление объявления',
        'Вы действительно хотите удалить это объявление?',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              // Загружаем текущие объявления
              const currentAnnouncements = await loadSavedAnnouncements();

              // Удаляем объявление по ID
              const updatedAnnouncements = currentAnnouncements.filter(item => item.id !== id);

              // Сохраняем обновленный список
              await AsyncStorage.setItem(
                `teacher_announcements_${user.id}`,
                JSON.stringify(updatedAnnouncements)
              );

              // Обновляем состояние
              setNews(prev => prev.filter(item => item.id !== id));

              Alert.alert('Успешно', 'Объявление удалено');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Ошибка при удалении объявления:', error);
      Alert.alert('Ошибка', 'Не удалось удалить объявление');
    }
  };

  // Рендер элемента новости
  const renderNewsItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.newsCard,
        item.important && styles.importantNewsCard,
        item.createdByTeacher && styles.teacherCreatedCard
      ]}
      onPress={() => viewNewsDetail(item)}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.newsImage}
          defaultSource={require('../../assets/icon.png')}
          resizeMode="cover"
        />
      ) : (
        <NewsImagePlaceholder category={item.category} />
      )}
      <View style={styles.newsContent}>
        <Text style={styles.newsTitle}>{item.title}</Text>
        <Text style={styles.newsDescription} numberOfLines={2}>
          {item.content}
        </Text>
        <View style={styles.newsFooter}>
          <View style={styles.authorInfoContainer}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {item.author && (
              <Text style={styles.authorText}>Автор: {item.author}</Text>
            )}
          </View>
          <Text style={styles.newsDate}>
            {formatPublishedDate(item.published_at)}
          </Text>
        </View>
      </View>
      {item.important && (
        <View style={styles.importantBadge}>
          <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
          <Text style={styles.importantText}>Важно</Text>
        </View>
      )}
      {item.createdByTeacher && (
        <View style={styles.teacherBadge}>
          <Ionicons name="create" size={16} color="#FFFFFF" />
          <Text style={styles.teacherBadgeText}>Ваше объявление</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Модальное окно создания объявления
  const renderCreateModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={createModalVisible}
      onRequestClose={() => setCreateModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Создание объявления</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCreateModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Заголовок</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Введите заголовок объявления"
              value={newAnnouncement.title}
              onChangeText={(text) => setNewAnnouncement(prev => ({...prev, title: text}))}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Текст объявления</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              placeholder="Введите текст объявления"
              value={newAnnouncement.content}
              onChangeText={(text) => setNewAnnouncement(prev => ({...prev, content: text}))}
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Категория</Text>
            <View style={styles.categoryButtons}>
              {['Учеба', 'Наука', 'Информация', 'Преподавателям'].map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    newAnnouncement.category === category && styles.activeCategoryButton
                  ]}
                  onPress={() => setNewAnnouncement(prev => ({...prev, category}))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    newAnnouncement.category === category && styles.activeCategoryButtonText
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Отметить как важное</Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  newAnnouncement.important && styles.toggleButtonActive
                ]}
                onPress={() => setNewAnnouncement(prev => ({...prev, important: !prev.important}))}
              >
                <View style={[
                  styles.toggleIndicator,
                  newAnnouncement.important && styles.toggleIndicatorActive
                ]} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            onPress={saveAnnouncement}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Опубликовать</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Новости</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
        {isOffline && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
            <Text style={styles.offlineText}>Офлайн режим</Text>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'all' && styles.activeFilterButton
            ]}
            onPress={() => setFilter('all')}
          >
            <Text style={[
              styles.filterText,
              filter === 'all' && styles.activeFilterText
            ]}>Все</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'department' && styles.activeFilterButton
            ]}
            onPress={() => setFilter('department')}
          >
            <Text style={[
              styles.filterText,
              filter === 'department' && styles.activeFilterText
            ]}>Учебная работа</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'teachers' && styles.activeFilterButton
            ]}
            onPress={() => setFilter('teachers')}
          >
            <Text style={[
              styles.filterText,
              filter === 'teachers' && styles.activeFilterText
            ]}>Преподавателям</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'important' && styles.activeFilterButton,
              filter === 'important' && styles.importantFilterButton
            ]}
            onPress={() => setFilter('important')}
          >
            <Ionicons
              name="alert-circle"
              size={14}
              color={filter === 'important' ? "#FFFFFF" : "#FF3B30"}
              style={styles.filterIcon}
            />
            <Text style={[
              styles.filterText,
              filter === 'important' && styles.activeFilterText
            ]}>Важное</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {isLoading ? (
        <NewsSkeleton />
      ) : (
        <FlatList
          data={news}
          renderItem={renderNewsItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
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
              <Ionicons name="newspaper-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>
                Нет доступных новостей
              </Text>
              <Text style={styles.emptySubtext}>
                Потяните вниз, чтобы обновить или создайте объявление
              </Text>
            </View>
          }
        />
      )}

      {/* FAB для создания объявления */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setCreateModalVisible(true)}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Модальное окно создания объявления */}
      {renderCreateModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  createButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    position: 'absolute',
    left: 16,
  },
  offlineText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  importantFilterButton: {
    backgroundColor: '#FF3B30',
  },
  filterText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  filterIcon: {
    marginRight: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 80, // Extra padding for FAB
  },
  newsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  importantNewsCard: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  teacherCreatedCard: {
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  newsImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  newsContent: {
    padding: 16,
  },
  newsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  newsDescription: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 20,
    marginBottom: 12,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  authorInfoContainer: {
    flex: 1,
    marginRight: 8,
  },
  categoryTag: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 13,
    color: '#3C3C43',
    fontWeight: '500',
  },
  authorText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  newsDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  importantBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  importantText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  teacherBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teacherBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
    textAlign: 'center',
  },
  // FAB кнопка
  fabButton: {
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // Модальное окно создания объявления
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
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
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
  },
  activeCategoryButton: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#000000',
  },
  activeCategoryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    color: '#000000',
  },
  toggleButton: {
    width: 51,
    height: 31,
    borderRadius: 31,
    backgroundColor: '#E5E5EA',
    padding: 2,
  },
  toggleButtonActive: {
    backgroundColor: '#34C759',
  },
  toggleIndicator: {
    width: 27,
    height: 27,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  toggleIndicatorActive: {
    transform: [{ translateX: 20 }],
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Стили для скелетона
  skeletonImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E5E5EA',
  },
  skeletonTitle: {
    width: '80%',
    height: 20,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonDescription: {
    width: '100%',
    height: 40,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonDate: {
    width: 100,
    height: 16,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
  },
  placeholderImage: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
});