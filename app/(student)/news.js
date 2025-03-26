// app/(student)/news.js


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
    ScrollView, // хз почему тут отступ, но пусть будет
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api'; // не юзается
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

// скелетон для новостей

const NewsSkeleton = () => {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // анимация прикольная но тяжелая
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

// главный экран новостей

export default function StudentNews() {
  const { user } = useAuth(); // пока не нужен но пусть будет
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState('all'); // можно менять фильтры

  // плейсхолдер для картинок
  // потом перенести в отдельный файл мб
  const NewsImagePlaceholder = ({ category }) => {
    // иконки для категорий

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
        default:
          return 'newspaper'; // для всякого мусора
      }
    };

    // цвета для плейсхолдеров

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
        default:
          return '#8E8E93'; // какой-то серый
      }
    };

    return (
      <View style={[styles.placeholderImage, { backgroundColor: getBackgroundColor() }]}>
        <Ionicons name={getIconName()} size={48} color="#FFFFFF" />
        <Text style={styles.placeholderText}>{category}</Text>
      </View>
    );
  };

  // тестовые новости
  // апишки пока нет
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
      title: 'Изменения в расписании для групп 2211-0101 и 2211-0102',
      content: 'Уважаемые студенты групп 2211-0101 и 2211-0102! Обращаем ваше внимание на изменения в расписании занятий со следующей недели. Лабораторные работы по предмету "Базы данных" переносятся с понедельника на среду (10:10-11:40, ауд. 305). Практические занятия по "Программированию" будут проходить в понедельник с 13:30 до 15:00 в аудитории 412.\n\nПросим учесть данные изменения при планировании своего учебного времени.',
      image: null,
      author: 'Учебный отдел',
      published_at: '2025-03-24T14:30:00',
      category: 'Учеба',
      important: true
    }
  ];

  useEffect(() => {
    loadNews();
  }, [filter]);

  // загрузка новостей

  const loadNews = async () => {
    setIsLoading(true);
    try {
      // пока без апи
      // имитация задержки
      await new Promise(resolve => setTimeout(resolve, 1000));
      // потом убрать

      // фильтруем новости
      let filteredNews = defaultNews;

      if (filter !== 'all') {
        // костыль для категорий
        const categoryMap = {
          'study': ['Учеба', 'Образование'],
          'events': ['События', 'Культура', 'Спорт'],
          'important': ['Информация'] // важное отдельно
        };

        if (filter === 'important') {
          filteredNews = defaultNews.filter(item => item.important === true);
        } else {
          const allowedCategories = categoryMap[filter] || [];
          filteredNews = defaultNews.filter(item => allowedCategories.includes(item.category));
        }
      }

      // тестовые данные
      // TODO: апи
      setNews(filteredNews);

      // кэш на всякий случай

      await AsyncStorage.setItem('cached_news', JSON.stringify(defaultNews));
      setIsOffline(false);
    } catch (error) {
      console.error('Ошибка при загрузке новостей:', error);

      // пробуем из кэша

      try {
        const cachedNews = await AsyncStorage.getItem('cached_news');
        if (cachedNews) {
          setNews(JSON.parse(cachedNews));
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

  // обновление свайпом

  const onRefresh = () => {
    setRefreshing(true);
    loadNews();
  };

  // форматирование даты
  // спасибо что есть dayjs
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

  // просмотр детальной новости
  // пока на алертах, потом нормально сделаю
  const viewNewsDetail = (item) => {
    Alert.alert(
      item.title,
      item.content,
      [{ text: 'Закрыть', style: 'cancel' }]
    );
  };

  // рендер новости
  // можно вынести в отдельный компонент
  const renderNewsItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.newsCard,
        item.important && styles.importantNewsCard
      ]}
      onPress={() => viewNewsDetail(item)}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.newsImage}
          defaultSource={require('../../assets/icon.png')} // если картинка не загрузится
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
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{item.category}</Text>
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Новости</Text>
        {isOffline && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
            <Text style={styles.offlineText}>Офлайн режим</Text>
          </View>
        )}
      </View>

      {/* фильтры для новостей */}
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
              filter === 'study' && styles.activeFilterButton
            ]}
            onPress={() => setFilter('study')}
          >
            <Text style={[
              styles.filterText,
              filter === 'study' && styles.activeFilterText
            ]}>Учеба</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'events' && styles.activeFilterButton
            ]}
            onPress={() => setFilter('events')}
          >
            <Text style={[
              styles.filterText,
              filter === 'events' && styles.activeFilterText
            ]}>События</Text>
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

      {/* контент или скелетон */}
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
              colors={['#007AFF']} // для андроида
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>
                Нет доступных новостей
              </Text>
              <Text style={styles.emptySubtext}>
                Потяните вниз, чтобы обновить
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// стили
// слишком много стилей...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // серый фон
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
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500', // оранжевый
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    position: 'absolute',
    right: 16,
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
    backgroundColor: '#F2F2F7', // серый
    borderRadius: 20,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF', // синий
  },
  importantFilterButton: {
    backgroundColor: '#FF3B30', // красный
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
  },
  newsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // для андроида
    overflow: 'hidden',
    position: 'relative',
  },
  importantNewsCard: {
    borderWidth: 1,
    borderColor: '#FF3B30', // красный
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
    color: '#3C3C43', // серый текст
    lineHeight: 20,
    marginBottom: 12,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTag: {
    backgroundColor: '#E5E5EA', // светло-серый
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 13,
    color: '#3C3C43',
    fontWeight: '500',
  },
  newsDate: {
    fontSize: 13,
    color: '#8E8E93', // бледный текст
  },
  importantBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FF3B30', // красный
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
  // стили скелетона
  // скопировал из другого проекта
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