// app/auth.js
import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth';
import api from '../utils/api';
import * as Animatable from 'react-native-animatable';
import { useRouter } from 'expo-router';

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return {
    isValid: password.length >= 6,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

export default function Auth() {
  const { login } = useAuth();
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [showTeacherSuggestions, setShowTeacherSuggestions] = useState(false);
  const [errors, setErrors] = useState({});
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    userType: '',
    group: '',
    teacher: '',
  });

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false)
    );
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      // Загружаем список преподавателей
      const teachersResponse = await api.get('/teachers');
      setTeachers(teachersResponse.data);

      // Загружаем список групп для подсказок
      const groupsResponse = await api.get('/groups');
      setGroups(groupsResponse.data || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Не показываем ошибку пользователю, чтобы не прерывать процесс регистрации
    }
  };

  // Фильтрация групп при вводе
  const filterGroups = (text) => {
    if (!text) {
      setFilteredGroups([]);
      return;
    }

    const filtered = groups.filter(group =>
      group.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 5); // Ограничиваем до 5 результатов

    setFilteredGroups(filtered);
    setShowGroupSuggestions(filtered.length > 0);
  };

  // Фильтрация преподавателей при вводе
  const filterTeachers = (text) => {
    if (!text) {
      setFilteredTeachers([]);
      return;
    }

    const filtered = teachers.filter(teacher =>
      teacher.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 5); // Ограничиваем до 5 результатов

    setFilteredTeachers(filtered);
    setShowTeacherSuggestions(filtered.length > 0);
  };

  useEffect(() => {
    if (!isLoginMode) loadInitialData();
  }, [isLoginMode]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Введите email';
    else if (!validateEmail(formData.email)) newErrors.email = 'Неверный формат';

    if (!formData.password) newErrors.password = 'Введите пароль';
    else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) newErrors.password = 'Минимум 6 символов';
    }

    if (!isLoginMode) {
      if (!formData.fullName) newErrors.fullName = 'Введите ФИО';
      else if (formData.fullName.split(' ').length < 2)
        newErrors.fullName = 'Введите полное ФИО';

      if (!formData.userType) newErrors.userType = 'Выберите тип';
      if (formData.userType === 'student' && !formData.group)
        newErrors.group = 'Введите группу';
      if (formData.userType === 'teacher' && !formData.teacher)
        newErrors.teacher = 'Выберите преподавателя';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Ошибка', 'Исправьте ошибки в форме');
      return;
    }
    try {
      setIsLoading(true);
      const endpoint = isLoginMode ? '/login' : '/register';
      const response = await api.post(endpoint, formData);

      // Получаем правильный маршрут в зависимости от роли
      const redirectPath = await login(response.data.user, response.data.token);
      router.replace(redirectPath);
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Произошла ошибка';
      Alert.alert('Ошибка', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPasswordStrength = () => {
    if (!formData.password || isLoginMode) return null;
    const validation = validatePassword(formData.password);
    const strengthChecks = [
      { label: '6+ символов', isValid: validation.isValid },
      { label: 'A-Z', isValid: validation.hasUpperCase },
      { label: 'a-z', isValid: validation.hasLowerCase },
      { label: '0-9', isValid: validation.hasNumber },
      { label: '!@#$', isValid: validation.hasSpecialChar },
    ];

    return (
      <Animatable.View animation="fadeIn" style={styles.passwordStrengthContainer}>
        {strengthChecks.map((check, index) => (
          <View key={index} style={styles.strengthCheck}>
            <Ionicons
              name={check.isValid ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={check.isValid ? '#34C759' : '#C7C7CC'}
            />
            <Text
              style={[styles.strengthText, check.isValid && styles.strengthTextValid]}
            >
              {check.label}
            </Text>
          </View>
        ))}
      </Animatable.View>
    );
  };

  const getInputStyle = (fieldName) => [
    styles.input,
    errors[fieldName] && styles.inputError,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animatable.View animation="fadeInDown" duration={400} style={styles.header}>
            <Text style={styles.headerTitle}>
              {isLoginMode ? 'Вход' : 'Регистрация'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isLoginMode ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
            </Text>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={600} style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={getInputStyle('email')}
                placeholder="example@domain.com"
                placeholderTextColor="#8E8E93"
                value={formData.email}
                onChangeText={(value) => {
                  setFormData((prev) => ({ ...prev, email: value }));
                  if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Пароль</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[getInputStyle('password'), { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#8E8E93"
                  value={formData.password}
                  onChangeText={(value) => {
                    setFormData((prev) => ({ ...prev, password: value }));
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.passwordIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              {renderPasswordStrength()}
            </View>

            {!isLoginMode && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>ФИО</Text>
                  <TextInput
                    style={getInputStyle('fullName')}
                    placeholder="Иванов Иван Иванович"
                    placeholderTextColor="#8E8E93"
                    value={formData.fullName}
                    onChangeText={(value) => {
                      setFormData((prev) => ({ ...prev, fullName: value }));
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: null }));
                    }}
                  />
                  {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                </View>

                <View style={styles.userTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      formData.userType === 'student' && styles.userTypeButtonActive,
                    ]}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, userType: 'student', teacher: '' }));
                      if (errors.userType) setErrors((prev) => ({ ...prev, userType: null }));
                    }}
                  >
                    <Ionicons
                      name="school-outline"
                      size={24}
                      color={formData.userType === 'student' ? '#007AFF' : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.userTypeText,
                        formData.userType === 'student' && styles.userTypeTextActive,
                      ]}
                    >
                      Студент
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      formData.userType === 'teacher' && styles.userTypeButtonActive,
                    ]}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, userType: 'teacher', group: '' }));
                      if (errors.userType) setErrors((prev) => ({ ...prev, userType: null }));
                    }}
                  >
                    <Ionicons
                      name="person-outline"
                      size={24}
                      color={formData.userType === 'teacher' ? '#007AFF' : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.userTypeText,
                        formData.userType === 'teacher' && styles.userTypeTextActive,
                      ]}
                    >
                      Преподаватель
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      formData.userType === 'admin' && styles.userTypeButtonActive,
                    ]}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, userType: 'admin', group: '', teacher: '' }));
                      if (errors.userType) setErrors((prev) => ({ ...prev, userType: null }));
                    }}
                  >
                    <Ionicons
                      name="shield-outline"
                      size={24}
                      color={formData.userType === 'admin' ? '#007AFF' : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.userTypeText,
                        formData.userType === 'admin' && styles.userTypeTextActive,
                      ]}
                    >
                      Администратор
                    </Text>
                  </TouchableOpacity>
                </View>

                {formData.userType === 'student' && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Группа</Text>
                    <TextInput
                      style={getInputStyle('group')}
                      placeholder="Например: 2211-0101.1"
                      placeholderTextColor="#8E8E93"
                      value={formData.group}
                      onChangeText={(value) => {
                        setFormData((prev) => ({ ...prev, group: value }));
                        if (errors.group) setErrors((prev) => ({ ...prev, group: null }));
                        filterGroups(value);
                      }}
                      onFocus={() => {
                        if (formData.group) filterGroups(formData.group);
                      }}
                      onBlur={() => {
                        // Небольшая задержка, чтобы успеть выбрать элемент
                        setTimeout(() => setShowGroupSuggestions(false), 200);
                      }}
                    />
                    {showGroupSuggestions && filteredGroups.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        {filteredGroups.map((group) => (
                          <TouchableOpacity
                            key={group}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setFormData((prev) => ({ ...prev, group }));
                              setShowGroupSuggestions(false);
                              if (errors.group) setErrors((prev) => ({ ...prev, group: null }));
                              Keyboard.dismiss();
                            }}
                          >
                            <Ionicons name="school-outline" size={18} color="#007AFF" style={styles.suggestionIcon} />
                            <Text style={styles.suggestionText}>{group}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {errors.group && <Text style={styles.errorText}>{errors.group}</Text>}
                  </View>
                )}

                {formData.userType === 'teacher' && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Преподаватель</Text>
                    <TextInput
                      style={getInputStyle('teacher')}
                      placeholder="Фамилия И.О."
                      placeholderTextColor="#8E8E93"
                      value={formData.teacher}
                      onChangeText={(value) => {
                        setFormData((prev) => ({ ...prev, teacher: value }));
                        if (errors.teacher) setErrors((prev) => ({ ...prev, teacher: null }));
                        filterTeachers(value);
                      }}
                      onFocus={() => {
                        if (formData.teacher) filterTeachers(formData.teacher);
                      }}
                      onBlur={() => {
                        // Небольшая задержка, чтобы успеть выбрать элемент
                        setTimeout(() => setShowTeacherSuggestions(false), 200);
                      }}
                    />
                    {showTeacherSuggestions && filteredTeachers.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        {filteredTeachers.map((teacher) => (
                          <TouchableOpacity
                            key={teacher}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setFormData((prev) => ({ ...prev, teacher }));
                              setShowTeacherSuggestions(false);
                              if (errors.teacher) setErrors((prev) => ({ ...prev, teacher: null }));
                              Keyboard.dismiss();
                            }}
                          >
                            <Ionicons name="person-outline" size={18} color="#007AFF" style={styles.suggestionIcon} />
                            <Text style={styles.suggestionText}>{teacher}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {errors.teacher && <Text style={styles.errorText}>{errors.teacher}</Text>}
                  </View>
                )}

                {formData.userType === 'admin' && (
                  <View style={styles.adminNoticeContainer}>
                    <Ionicons name="information-circle" size={24} color="#007AFF" />
                    <Text style={styles.adminNoticeText}>
                      Аккаунты администраторов подлежат обязательной проверке. После регистрации обратитесь в IT-отдел университета.
                    </Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <View style={styles.submitButtonInner}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isLoginMode ? 'Войти' : 'Зарегистрироваться'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                setIsLoginMode(!isLoginMode);
                setFormData({
                  email: '',
                  password: '',
                  fullName: '',
                  userType: '',
                  group: '',
                  teacher: '',
                });
                setErrors({});
              }}
            >
              <Text style={styles.switchModeText}>
                {isLoginMode
                  ? 'Нет аккаунта? Зарегистрируйтесь'
                  : 'Уже есть аккаунт? Войдите'}
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 17,
    color: '#8E8E93',
    marginTop: 8,
    fontWeight: '400',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  passwordIcon: {
    padding: 12,
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 12,
  },
  strengthCheck: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthText: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 4,
    fontWeight: '500',
  },
  strengthTextValid: {
    color: '#34C759',
  },
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userTypeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  userTypeText: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 8,
    fontWeight: '500',
  },
  userTypeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectButtonError: {
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  selectButtonText: {
    fontSize: 17,
    color: '#000000',
    fontWeight: '400',
  },
  placeholderText: {
    color: '#8E8E93',
  },
  submitButton: {
    borderRadius: 14,
    marginTop: 32,
    overflow: 'hidden',
  },
  submitButtonInner: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 10,
  },
  switchModeText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 16,
    color: '#000000',
  },
  adminNoticeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D0E7FF',
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
});