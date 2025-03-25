import logging
import os
import re
from datetime import datetime, timedelta
from functools import wraps
from logging.handlers import RotatingFileHandler

import jwt
import pymysql
from flask import Flask, request, jsonify, render_template_string, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

# ========== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==========

app = Flask(__name__)
CORS(app)

# Конфигурация
app.config['SECRET_KEY'] = 'your-secret-key'  # Измените на реальный секретный ключ
app.config['JWT_EXPIRATION_DAYS'] = 30
app.config['LOG_FILENAME'] = 'app.log'

# Конфигурация базы данных
DB_CONFIG = {
    'host': '147.45.153.76',
    'user': 'sanumxxx',
    'password': 'Yandex200515_',
    'db': 'timetable',
    'charset': 'utf8mb4',
    'use_unicode': True,
    'cursorclass': pymysql.cursors.DictCursor
}

# ========== НАСТРОЙКА ЛОГИРОВАНИЯ ==========

if not os.path.exists('logs'):
    os.makedirs('logs')

formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')
handler = RotatingFileHandler(f"logs/{app.config['LOG_FILENAME']}", maxBytes=10000000, backupCount=10)
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Server startup')


# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

def get_db():
    """Функция подключения к БД"""
    return pymysql.connect(**DB_CONFIG)


def log_user_action(user_id, action, details=None):
    """Логирование действий пользователя"""
    if details:
        app.logger.info(f"USER ACTION: User {user_id} - {action} - {details}")
    else:
        app.logger.info(f"USER ACTION: User {user_id} - {action}")


def setup_log_rotation():
    """Настройка ротации логов"""

    def check_log_size():
        log_path = os.path.join('logs', app.config['LOG_FILENAME'])
        max_size_mb = 10  # Maximum log size in MB

        if os.path.exists(log_path):
            size_mb = os.path.getsize(log_path) / (1024 * 1024)
            if size_mb > max_size_mb:
                # Rotate logs
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                backup_path = f"{log_path}.{timestamp}"

                try:
                    # Copy current log to backup
                    with open(log_path, 'r', encoding='utf-8') as src:
                        with open(backup_path, 'w', encoding='utf-8') as dst:
                            dst.write(src.read())

                    # Clear current log file
                    with open(log_path, 'w', encoding='utf-8') as f:
                        f.write(f"Log rotated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

                    app.logger.info(f"Log rotated. Previous log saved as {backup_path}")
                except Exception as e:
                    app.logger.error(f"Error rotating log: {str(e)}")


def read_logs(tail_lines=100, filter_text=None, log_level=None, start_date=None, end_date=None):
    """
    Чтение логов с возможностью фильтрации

    Args:
        tail_lines: Количество строк для возврата
        filter_text: Текст для фильтрации логов
        log_level: Фильтр по уровню лога (INFO, WARNING, ERROR)
        start_date: Начальная дата (ГГГГ-ММ-ДД)
        end_date: Конечная дата (ГГГГ-ММ-ДД)
    """
    log_path = os.path.join('logs', app.config['LOG_FILENAME'])
    try:
        if not os.path.exists(log_path):
            return ["Логи не найдены"]

        with open(log_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()

        # Применяем фильтры
        filtered_lines = []
        date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2})')

        for line in lines:
            # Фильтр по тексту
            if filter_text and filter_text.lower() not in line.lower():
                continue

            # Фильтр по уровню лога
            if log_level:
                if log_level == "ERROR" and "ERROR" not in line:
                    continue
                elif log_level == "WARNING" and "WARNING" not in line and "ERROR" not in line:
                    continue
                elif log_level == "INFO" and "INFO" not in line and "WARNING" not in line and "ERROR" not in line:
                    continue

            # Фильтр по дате
            if start_date or end_date:
                date_match = date_pattern.search(line)
                if date_match:
                    line_date = date_match.group(1)
                    if start_date and line_date < start_date:
                        continue
                    if end_date and line_date > end_date:
                        continue

            filtered_lines.append(line)

        # Возвращаем только запрошенное количество строк
        return filtered_lines[-tail_lines:] if len(filtered_lines) > tail_lines else filtered_lines

    except Exception as e:
        return [f"Ошибка чтения логов: {str(e)}"]


# ========== ДЕКОРАТОРЫ И MIDDLEWARE ==========

def require_auth(f):
    """Декоратор для проверки аутентификации пользователя"""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': 'Authorization header is missing'}), 401

        try:
            parts = auth_header.split()
            if parts[0].lower() != 'bearer' or len(parts) != 2:
                return jsonify({'error': 'Invalid authorization format'}), 401

            token = parts[1]
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT id, user_type FROM users WHERE id = %s', (user_id,))
            user = cursor.fetchone()
            conn.close()

            if not user:
                return jsonify({'error': 'User not found'}), 401

            # Добавляем информацию о пользователе в kwargs для использования в функции
            kwargs['user_data'] = user

            return f(user_id, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            app.logger.error(f'Auth error: {str(e)}')
            return jsonify({'error': str(e)}), 500

    return decorated


def require_admin(f):
    """Декоратор для проверки прав администратора"""

    @wraps(f)
    def decorated(user_id, *args, **kwargs):
        try:
            user_data = kwargs.get('user_data')

            # Если информация о пользователе не передана, получим её
            if not user_data:
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('SELECT user_type FROM users WHERE id = %s', (user_id,))
                user_data = cursor.fetchone()
                conn.close()

                if not user_data:
                    return jsonify({'error': 'User not found'}), 401

            # Проверяем, является ли пользователь администратором
            if user_data['user_type'] != 'admin':
                return jsonify({'error': 'Access denied. Admin rights required'}), 403

            return f(user_id, *args, **kwargs)

        except Exception as e:
            app.logger.error(f'Admin rights check error: {str(e)}')
            return jsonify({'error': str(e)}), 500

    return decorated


# ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========

def init_db():
    """Инициализация базы данных и создание необходимых таблиц"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Установка кодировки
        cursor.execute('SET NAMES utf8mb4')
        cursor.execute('SET CHARACTER SET utf8mb4')
        cursor.execute('SET character_set_connection=utf8mb4')

        # Создание таблицы пользователей с поддержкой роли администратора
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS users (
               id INT AUTO_INCREMENT PRIMARY KEY,
               email VARCHAR(255) UNIQUE NOT NULL,
               password VARCHAR(255) NOT NULL,
               full_name VARCHAR(255) NOT NULL,
               user_type ENUM('student', 'teacher', 'admin') NOT NULL,
               group_name VARCHAR(255),
               teacher_name VARCHAR(255),
               status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы расписания
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS schedule (
               id INT AUTO_INCREMENT PRIMARY KEY,
               semester INT,
               week_number INT,
               group_name VARCHAR(255),
               course INT,
               faculty VARCHAR(255),
               subject VARCHAR(255),
               lesson_type VARCHAR(50),
               subgroup INT,
               date DATE,
               time_start TIME,
               time_end TIME,
               weekday INT,
               teacher_name VARCHAR(255),
               auditory VARCHAR(50),
               created_by INT,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
               INDEX idx_date (date),
               INDEX idx_group (group_name),
               INDEX idx_teacher (teacher_name),
               FOREIGN KEY (created_by) REFERENCES users(id)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы уведомлений
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS notifications (
               id INT AUTO_INCREMENT PRIMARY KEY,
               user_id INT NOT NULL,
               type VARCHAR(50) NOT NULL,
               title VARCHAR(255) NOT NULL,
               message TEXT NOT NULL,
               is_read BOOLEAN DEFAULT FALSE,
               data JSON,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы системных настроек
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS system_settings (
               id INT AUTO_INCREMENT PRIMARY KEY,
               key_name VARCHAR(100) UNIQUE NOT NULL,
               value TEXT,
               description VARCHAR(255),
               updated_by INT,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
               FOREIGN KEY (updated_by) REFERENCES users(id)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы для журнала активности администраторов
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS admin_activity_log (
               id INT AUTO_INCREMENT PRIMARY KEY,
               admin_id INT NOT NULL,
               action VARCHAR(100) NOT NULL,
               details TEXT,
               ip_address VARCHAR(45),
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               FOREIGN KEY (admin_id) REFERENCES users(id)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создаем администратора по умолчанию, если его нет
        cursor.execute('SELECT id FROM users WHERE user_type = "admin" LIMIT 1')
        if not cursor.fetchone():
            # Создаем администратора по умолчанию
            admin_password = generate_password_hash('admin123')  # В реальном приложении используйте сильный пароль
            cursor.execute('''
                INSERT INTO users (email, password, full_name, user_type)
                VALUES ('admin@example.com', %s, 'Администратор системы', 'admin')
            ''', (admin_password,))
            app.logger.info('Default admin user created')

        conn.commit()
        app.logger.info('Database initialized successfully')

    except Exception as e:
        app.logger.error(f'Database initialization error: {str(e)}')
        raise e

    finally:
        conn.close()


# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

def generate_token(user_id):
    """Генерация JWT токена для пользователя"""
    try:
        token = jwt.encode(
            {'user_id': user_id, 'exp': datetime.utcnow() + timedelta(days=app.config['JWT_EXPIRATION_DAYS'])},
            app.config['SECRET_KEY'], algorithm='HS256')
        return token
    except Exception as e:
        app.logger.error(f'Token generation error: {str(e)}')
        raise e


def log_admin_activity(admin_id, action, details=None):
    """Логирование действий администратора в базу данных"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        ip_address = request.remote_addr

        cursor.execute('''
            INSERT INTO admin_activity_log (admin_id, action, details, ip_address)
            VALUES (%s, %s, %s, %s)
        ''', (admin_id, action, details, ip_address))

        conn.commit()
    except Exception as e:
        app.logger.error(f'Error logging admin activity: {str(e)}')
    finally:
        if 'conn' in locals():
            conn.close()


# ========== МАРШРУТЫ АУТЕНТИФИКАЦИИ ==========

@app.route('/api/register', methods=['POST'])
def register():
    """Регистрация нового пользователя"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка обязательных полей
        required_fields = ['email', 'password', 'fullName', 'userType']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Проверка существования email
        cursor.execute('SELECT id FROM users WHERE email = %s', (data['email'],))
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 400

        # Хеширование пароля
        hashed_password = generate_password_hash(data['password'])

        # Вставка пользователя
        cursor.execute('''
            INSERT INTO users (email, password, full_name, user_type, group_name, teacher_name)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (
            data['email'], hashed_password, data['fullName'], data['userType'], data.get('group'), data.get('teacher')))

        conn.commit()
        user_id = cursor.lastrowid

        token = generate_token(user_id)

        app.logger.info(f'New user registered: {data["email"]}')

        return jsonify({'token': token, 'user': {'id': user_id, 'email': data['email'], 'fullName': data['fullName'],
                                                 'userType': data['userType'], 'group': data.get('group'),
                                                 'teacher': data.get('teacher')}})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Registration error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    """Авторизация пользователя"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Log login attempt
        app.logger.info(f'LOGIN ATTEMPT: {data.get("email", "unknown")} - IP: {request.remote_addr}')

        cursor.execute('''
            SELECT * FROM users WHERE email = %s AND status != 'blocked'
        ''', (data['email'],))

        user = cursor.fetchone()
        if not user or not check_password_hash(user['password'], data['password']):
            app.logger.warning(
                f'FAILED LOGIN: {data.get("email", "unknown")} - Invalid credentials - IP: {request.remote_addr}')
            return jsonify({'error': 'Invalid email or password'}), 401

        token = generate_token(user['id'])

        # Enhanced logging for successful login
        app.logger.info(
            f'LOGIN SUCCESS: User ID {user["id"]} ({user["email"]}) - Type: {user["user_type"]} - IP: {request.remote_addr}')

        return jsonify({'token': token,
                        'user': {'id': user['id'], 'email': user['email'], 'fullName': user['full_name'],
                                 'userType': user['user_type'], 'group': user['group_name'],
                                 'teacher': user['teacher_name']}})

    except Exception as e:
        app.logger.error(f'Login error for {data.get("email", "unknown")}: {str(e)} - IP: {request.remote_addr}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# ========== МАРШРУТЫ ПРОФИЛЯ ==========

@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile(user_id):
    """Получение профиля пользователя"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT id, email, full_name, user_type, group_name, teacher_name, status
            FROM users WHERE id = %s
        ''', (user_id,))

        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify(user)

    except Exception as e:
        app.logger.error(f'Profile fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/profile/details', methods=['GET'])
@require_auth
def get_profile_details(user_id):
    """Получение детальной информации о профиле пользователя"""
    try:
        conn = get_db()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Используем CONVERT для правильной кодировки
        cursor.execute('''
            SELECT 
                u.id,
                u.email,
                CONVERT(u.full_name USING utf8) as full_name,
                u.user_type,
                u.group_name,
                u.teacher_name,
                u.status,
                CONVERT(
                    CASE 
                        WHEN u.user_type = 'student' THEN 
                            (SELECT faculty FROM schedule WHERE group_name = u.group_name LIMIT 1)
                        ELSE 
                            (SELECT DISTINCT faculty FROM schedule WHERE teacher_name = u.teacher_name LIMIT 1)
                    END
                USING utf8) as faculty,
                CASE 
                    WHEN u.user_type = 'student' THEN 
                        (SELECT course FROM schedule WHERE group_name = u.group_name LIMIT 1)
                    ELSE NULL
                END as course,
                CASE 
                    WHEN u.user_type = 'student' THEN 
                        (SELECT DISTINCT semester FROM schedule WHERE group_name = u.group_name LIMIT 1)
                    ELSE NULL
                END as semester
            FROM users u
            WHERE u.id = %s
        ''', (user_id,))

        user_details = cursor.fetchone()

        if not user_details:
            return jsonify({'error': 'User not found'}), 404

        # Получаем статистику
        if user_details['user_type'] == 'student':
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT subject) as total_subjects,
                    COUNT(DISTINCT date) as total_days,
                    COUNT(*) as total_lessons
                FROM schedule 
                WHERE group_name = %s
                AND semester = (SELECT MAX(semester) FROM schedule WHERE group_name = %s)
            ''', (user_details['group_name'], user_details['group_name']))
        else:
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT subject) as total_subjects,
                    COUNT(DISTINCT group_name) as total_groups,
                    COUNT(*) as total_lessons
                FROM schedule 
                WHERE teacher_name = %s
                AND semester = (SELECT MAX(semester) FROM schedule)
            ''', (user_details['teacher_name'],))

        stats = cursor.fetchone()

        # Добавляем статистику к деталям пользователя
        if stats:
            user_details.update(stats)

        return jsonify(user_details)

    except Exception as e:
        print(f"Profile details error: {str(e)}")
        return jsonify({'error': str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()


# ========== МАРШРУТЫ РАСПИСАНИЯ ==========

@app.route('/api/schedule', methods=['GET'])
@require_auth
def get_schedule(user_id):
    """Получение расписания для пользователя"""
    try:
        date = request.args.get('date')
        if not date:
            app.logger.warning(f'ОШИБКА ЗАПРОСА РАСПИСАНИЯ: Пользователь {user_id} - Не указана дата')
            return jsonify({'error': 'Date is required'}), 400

        conn = get_db()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Получаем тип пользователя, ФИО и данные для фильтрации
        cursor.execute('''
            SELECT 
                user_type, 
                full_name,
                CASE 
                    WHEN user_type = 'student' THEN group_name 
                    WHEN user_type = 'teacher' THEN teacher_name 
                    ELSE NULL
                END as filter_value
            FROM users 
            WHERE id = %s
        ''', (user_id,))

        user = cursor.fetchone()
        if not user:
            app.logger.warning(f'ОШИБКА ЗАПРОСА РАСПИСАНИЯ: Пользователь ID {user_id} не найден')
            return jsonify({'error': 'User not found'}), 404

        # Форматируем дату для логов в более читаемом формате
        display_date = datetime.strptime(date, '%Y-%m-%d').strftime('%d.%m.%Y')

        # Расширенное логирование с ФИО
        user_type_ru = "преподаватель" if user['user_type'] == 'teacher' else "студент"
        app.logger.info(
            f'ПРОСМОТР РАСПИСАНИЯ: {user["full_name"]} ({user_type_ru}) запросил расписание на {display_date}')

        # Выборка расписания в зависимости от типа пользователя
        if user['user_type'] == 'admin':
            # Администратор видит всё расписание
            cursor.execute('''
                SELECT 
                    id,
                    DATE_FORMAT(date, '%%Y-%%m-%%d') as date,
                    TIME_FORMAT(time_start, '%%H:%%i') as time_start,
                    TIME_FORMAT(time_end, '%%H:%%i') as time_end,
                    subject,
                    lesson_type,
                    subgroup,
                    group_name,
                    teacher_name,
                    auditory,
                    semester,
                    week_number,
                    course,
                    faculty,
                    weekday,
                    created_by
                FROM schedule 
                WHERE date = %s 
                ORDER BY time_start
            ''', (date,))
        elif user['user_type'] == 'student':
            # Студент видит расписание для своей группы
            cursor.execute('''
                SELECT 
                    id,
                    DATE_FORMAT(date, '%%Y-%%m-%%d') as date,
                    TIME_FORMAT(time_start, '%%H:%%i') as time_start,
                    TIME_FORMAT(time_end, '%%H:%%i') as time_end,
                    subject,
                    lesson_type,
                    subgroup,
                    group_name,
                    teacher_name,
                    auditory,
                    semester,
                    week_number,
                    course,
                    faculty,
                    weekday
                FROM schedule 
                WHERE date = %s 
                AND group_name = %s 
                ORDER BY time_start
            ''', (date, user['filter_value']))
        else:
            # Преподаватель видит расписание для своих занятий
            cursor.execute('''
                SELECT 
                    id,
                    DATE_FORMAT(date, '%%Y-%%m-%%d') as date,
                    TIME_FORMAT(time_start, '%%H:%%i') as time_start,
                    TIME_FORMAT(time_end, '%%H:%%i') as time_end,
                    subject,
                    lesson_type,
                    subgroup,
                    group_name,
                    teacher_name,
                    auditory,
                    semester,
                    week_number,
                    course,
                    faculty,
                    weekday
                FROM schedule 
                WHERE date = %s 
                AND teacher_name = %s
                ORDER BY time_start
            ''', (date, user['filter_value']))

        schedule = cursor.fetchall()

        # Дополнительный лог о количестве пар в расписании
        app.logger.info(f'ДАННЫЕ РАСПИСАНИЯ: {user["full_name"]} получил {len(schedule)} пар на {display_date}')

        return jsonify(schedule)

    except Exception as e:
        app.logger.error(f'Ошибка получения расписания для пользователя {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()


@app.route('/api/groups', methods=['GET'])
def get_groups():
    """Получение списка всех групп"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT DISTINCT group_name FROM schedule WHERE group_name IS NOT NULL')
        groups = [row['group_name'] for row in cursor.fetchall()]
        return jsonify(groups)

    except Exception as e:
        app.logger.error(f'Groups fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/teachers', methods=['GET'])
def get_teachers():
    """Получение списка всех преподавателей"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT DISTINCT teacher_name FROM schedule WHERE teacher_name IS NOT NULL')
        teachers = [row['teacher_name'] for row in cursor.fetchall()]
        return jsonify(teachers)

    except Exception as e:
        app.logger.error(f'Teachers fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/schedule/groups', methods=['GET'])
@require_auth
def get_teacher_groups(user_id):
    """Получение списка групп для преподавателя"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Получаем данные преподавателя
        cursor.execute('SELECT teacher_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or (user['user_type'] != 'teacher' and user['user_type'] != 'admin'):
            return jsonify({'error': 'Access denied'}), 403

        if user['user_type'] == 'admin':
            # Админ видит все группы
            cursor.execute('''
                SELECT DISTINCT group_name 
                FROM schedule 
                WHERE group_name IS NOT NULL
                ORDER BY group_name
            ''')
        else:
            # Преподаватель видит только свои группы
            cursor.execute('''
                SELECT DISTINCT group_name 
                FROM schedule 
                WHERE teacher_name = %s
                ORDER BY group_name
            ''', (user['teacher_name'],))

        groups = [row['group_name'] for row in cursor.fetchall()]
        return jsonify(groups)

    except Exception as e:
        app.logger.error(f'Error getting teacher groups: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/teachers/my', methods=['GET'])
@require_auth
def get_my_teachers(user_id):
    """Получение списка преподавателей для студента"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        app.logger.info(f'Getting teachers for student_id: {user_id}')

        # Получаем группу студента
        cursor.execute('SELECT group_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        app.logger.info(f'Found user: {user}')

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user['user_type'] != 'student' and user['user_type'] != 'admin':
            return jsonify({'error': 'Only students can view teachers'}), 403

        if user['user_type'] == 'admin':
            # Администраторы видят всех преподавателей
            cursor.execute('''
                SELECT DISTINCT 
                    u.id,
                    u.full_name,
                    u.email,
                    u.teacher_name,
                    u.status
                FROM users u
                WHERE u.user_type = 'teacher'
                ORDER BY u.full_name
            ''')
        else:
            # Студенты видят только своих преподавателей
            if not user['group_name']:
                return jsonify({'error': 'Student group not found'}), 404

            cursor.execute('''
                SELECT DISTINCT 
                    u.id,
                    u.full_name,
                    u.email,
                    u.teacher_name
                FROM users u
                JOIN schedule s ON u.teacher_name = s.teacher_name
                WHERE s.group_name = %s
                AND u.user_type = 'teacher'
                AND u.teacher_name IS NOT NULL
            ''', (user['group_name'],))

        teachers = cursor.fetchall()
        app.logger.info(f'Found {len(teachers)} teachers')

        return jsonify(teachers)

    except Exception as e:
        app.logger.error(f'Error in get_my_teachers: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/students/my', methods=['GET'])
@require_auth
def get_my_students(user_id):
    """Получение списка студентов для преподавателя"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Получаем имя преподавателя
        cursor.execute('SELECT teacher_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or (user['user_type'] != 'teacher' and user['user_type'] != 'admin'):
            return jsonify({'error': 'Access denied'}), 403

        # Получаем collation столбца teacher_name из таблицы schedule
        cursor.execute(
            "SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'schedule' AND COLUMN_NAME = 'teacher_name'")
        result = cursor.fetchone()
        teacher_name_collation = result[
            'COLLATION_NAME'] if result else 'utf8mb4_0900_ai_ci'  # По умолчанию, если не удалось получить

        if user['user_type'] == 'admin':
            # Администраторы видят всех студентов
            cursor.execute('''
                SELECT DISTINCT
                    u.id,
                    u.full_name,
                    u.email,
                    u.group_name,
                    u.status
                FROM users u
                WHERE u.user_type = 'student'
                ORDER BY u.group_name, u.full_name
            ''')
        else:
            # Преподаватели видят студентов из своих групп
            cursor.execute(f'''
                SELECT DISTINCT
                    u.id,
                    u.full_name,
                    u.email,
                    u.group_name
                FROM users u
                WHERE u.group_name IN (
                    SELECT DISTINCT group_name
                    FROM schedule
                    WHERE teacher_name COLLATE {teacher_name_collation} = %s COLLATE {teacher_name_collation}
                )
                AND u.user_type = 'student'
                ORDER BY u.group_name, u.full_name
            ''', (user['teacher_name'],))

        students = cursor.fetchall()
        app.logger.info(f'Found {len(students)} students for teacher {user.get("teacher_name", "admin")}')

        return jsonify(students)

    except Exception as e:
        app.logger.error(f'Error in get_my_students: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ========== АДМИНИСТРАТИВНЫЕ МАРШРУТЫ ==========

@app.route('/api/admin/users', methods=['GET'])
@require_auth
@require_admin
def admin_get_users(user_id):
    """Получение списка всех пользователей (для администратора)"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Логирование действия администратора
        log_admin_activity(user_id, "Просмотр списка пользователей")

        # Параметры фильтрации
        user_type = request.args.get('type')
        status = request.args.get('status')
        search = request.args.get('search')

        # Базовый запрос
        query = '''
            SELECT id, email, full_name, user_type, group_name, teacher_name, status, created_at
            FROM users
            WHERE 1=1
        '''
        params = []

        # Применяем фильтры
        if user_type:
            query += ' AND user_type = %s'
            params.append(user_type)

        if status:
            query += ' AND status = %s'
            params.append(status)

        if search:
            query += ' AND (email LIKE %s OR full_name LIKE %s OR group_name LIKE %s)'
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param])

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        users = cursor.fetchall()

        return jsonify(users)

    except Exception as e:
        app.logger.error(f'Admin users fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users/<int:target_user_id>', methods=['GET'])
@require_auth
@require_admin
def admin_get_user(user_id, target_user_id):
    """Получение информации о конкретном пользователе (для администратора)"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT id, email, full_name, user_type, group_name, teacher_name, status, created_at
            FROM users
            WHERE id = %s
        ''', (target_user_id,))

        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Логирование действия администратора
        log_admin_activity(user_id, "Просмотр информации о пользователе", f"ID: {target_user_id}")

        return jsonify(user)

    except Exception as e:
        app.logger.error(f'Admin user fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users/<int:target_user_id>', methods=['PUT'])
@require_auth
@require_admin
def admin_update_user(user_id, target_user_id):
    """Обновление информации о пользователе (для администратора)"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Получаем текущие данные пользователя
        cursor.execute('SELECT * FROM users WHERE id = %s', (target_user_id,))
        existing_user = cursor.fetchone()

        if not existing_user:
            return jsonify({'error': 'User not found'}), 404

        # Обновляем только предоставленные поля
        update_fields = []
        params = []

        if 'email' in data:
            update_fields.append('email = %s')
            params.append(data['email'])

        if 'fullName' in data:
            update_fields.append('full_name = %s')
            params.append(data['fullName'])

        if 'userType' in data:
            update_fields.append('user_type = %s')
            params.append(data['userType'])

        if 'group' in data:
            update_fields.append('group_name = %s')
            params.append(data['group'])

        if 'teacher' in data:
            update_fields.append('teacher_name = %s')
            params.append(data['teacher'])

        if 'status' in data:
            update_fields.append('status = %s')
            params.append(data['status'])

        if 'password' in data and data['password']:
            update_fields.append('password = %s')
            params.append(generate_password_hash(data['password']))

        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400

        # Выполняем обновление
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
        params.append(target_user_id)

        cursor.execute(query, params)
        conn.commit()

        # Логирование действия администратора
        log_admin_activity(user_id, "Обновление пользователя",
                           f"ID: {target_user_id}, изменены поля: {', '.join(update_fields)}")

        return jsonify({'success': True, 'message': 'User updated successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin user update error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users', methods=['POST'])
@require_auth
@require_admin
def admin_create_user(user_id):
    """Создание нового пользователя администратором"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка обязательных полей
        required_fields = ['email', 'password', 'fullName', 'userType']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Проверка существования email
        cursor.execute('SELECT id FROM users WHERE email = %s', (data['email'],))
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 400

        # Хеширование пароля
        hashed_password = generate_password_hash(data['password'])

        # Вставка пользователя
        cursor.execute('''
            INSERT INTO users (email, password, full_name, user_type, group_name, teacher_name, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            data['email'],
            hashed_password,
            data['fullName'],
            data['userType'],
            data.get('group'),
            data.get('teacher'),
            data.get('status', 'active')
        ))

        conn.commit()
        new_user_id = cursor.lastrowid

        # Логирование действия администратора
        log_admin_activity(user_id, "Создание пользователя",
                           f"ID: {new_user_id}, Email: {data['email']}, Тип: {data['userType']}")

        return jsonify({
            'id': new_user_id,
            'email': data['email'],
            'fullName': data['fullName'],
            'userType': data['userType'],
            'group': data.get('group'),
            'teacher': data.get('teacher'),
            'status': data.get('status', 'active')
        })

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin user creation error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users/<int:target_user_id>', methods=['DELETE'])
@require_auth
@require_admin
def admin_delete_user(user_id, target_user_id):
    """Удаление пользователя (для администратора)"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка существования пользователя
        cursor.execute('SELECT id, email, full_name FROM users WHERE id = %s', (target_user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Удаление пользователя
        cursor.execute('DELETE FROM users WHERE id = %s', (target_user_id,))
        conn.commit()

        # Логирование действия администратора
        log_admin_activity(user_id, "Удаление пользователя",
                           f"ID: {target_user_id}, Email: {user['email']}, Имя: {user['full_name']}")

        return jsonify({'success': True, 'message': 'User deleted successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin user deletion error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule', methods=['POST'])
@require_auth
@require_admin
def admin_create_schedule(user_id):
    """Создание нового расписания администратором"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка обязательных полей
        required_fields = ['date', 'group_name', 'subject', 'lesson_type', 'time_start', 'time_end', 'teacher_name',
                           'auditory']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Вычисление дополнительных полей, если они не предоставлены
        if 'weekday' not in data:
            # Вычисляем день недели из даты (1-7, где 1 - понедельник)
            date_obj = datetime.strptime(data['date'], '%Y-%m-%d')
            data['weekday'] = date_obj.isoweekday()

        # Вставка расписания
        cursor.execute('''
            INSERT INTO schedule (
                date, group_name, subject, lesson_type, time_start, time_end,
                teacher_name, auditory, subgroup, semester, week_number,
                course, faculty, weekday, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            data['date'],
            data['group_name'],
            data['subject'],
            data['lesson_type'],
            data['time_start'],
            data['time_end'],
            data['teacher_name'],
            data['auditory'],
            data.get('subgroup', 0),
            data.get('semester'),
            data.get('week_number'),
            data.get('course'),
            data.get('faculty'),
            data['weekday'],
            user_id
        ))

        conn.commit()
        schedule_id = cursor.lastrowid

        # Логирование действия администратора
        log_admin_activity(
            user_id,
            "Создание расписания",
            f"ID: {schedule_id}, Дата: {data['date']}, Группа: {data['group_name']}, Предмет: {data['subject']}"
        )

        return jsonify({
            'id': schedule_id,
            'message': 'Schedule created successfully'
        })

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin schedule creation error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule/<int:schedule_id>', methods=['PUT'])
@require_auth
@require_admin
def admin_update_schedule(user_id, schedule_id):
    """Обновление расписания администратором"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка существования расписания
        cursor.execute('SELECT id FROM schedule WHERE id = %s', (schedule_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Schedule not found'}), 404

        # Подготовка полей для обновления
        update_fields = []
        params = []

        # Поля, которые могут быть обновлены
        allowed_fields = {
            'date': 'date',
            'group_name': 'group_name',
            'subject': 'subject',
            'lesson_type': 'lesson_type',
            'time_start': 'time_start',
            'time_end': 'time_end',
            'teacher_name': 'teacher_name',
            'auditory': 'auditory',
            'subgroup': 'subgroup',
            'semester': 'semester',
            'week_number': 'week_number',
            'course': 'course',
            'faculty': 'faculty',
            'weekday': 'weekday'
        }

        for key, field in allowed_fields.items():
            if key in data:
                update_fields.append(f'{field} = %s')
                params.append(data[key])

        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400

        # Вычисление дополнительных полей, если обновляется дата
        if 'date' in data and 'weekday' not in data:
            date_obj = datetime.strptime(data['date'], '%Y-%m-%d')
            update_fields.append('weekday = %s')
            params.append(date_obj.isoweekday())

        # Выполняем обновление
        query = f"UPDATE schedule SET {', '.join(update_fields)} WHERE id = %s"
        params.append(schedule_id)

        cursor.execute(query, params)
        conn.commit()

        # Логирование действия администратора
        log_admin_activity(
            user_id,
            "Обновление расписания",
            f"ID: {schedule_id}, изменены поля: {', '.join(update_fields)}"
        )

        return jsonify({'success': True, 'message': 'Schedule updated successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin schedule update error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule/<int:schedule_id>', methods=['DELETE'])
@require_auth
@require_admin
def admin_delete_schedule(user_id, schedule_id):
    """Удаление расписания администратором"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка существования расписания
        cursor.execute('''
            SELECT id, date, group_name, subject 
            FROM schedule 
            WHERE id = %s
        ''', (schedule_id,))

        schedule = cursor.fetchone()
        if not schedule:
            return jsonify({'error': 'Schedule not found'}), 404

        # Удаление расписания
        cursor.execute('DELETE FROM schedule WHERE id = %s', (schedule_id,))
        conn.commit()

        # Логирование действия администратора
        log_admin_activity(
            user_id,
            "Удаление расписания",
            f"ID: {schedule_id}, Дата: {schedule['date']}, Группа: {schedule['group_name']}, Предмет: {schedule['subject']}"
        )

        return jsonify({'success': True, 'message': 'Schedule deleted successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin schedule deletion error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/activity-log', methods=['GET'])
@require_auth
@require_admin
def admin_get_activity_log(user_id):
    """Получение журнала действий администраторов"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Параметры пагинации и фильтрации
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        admin_filter = request.args.get('admin_id')
        action_filter = request.args.get('action')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        # Базовый запрос
        query = '''
            SELECT 
                al.id, 
                al.admin_id, 
                u.full_name as admin_name,
                al.action, 
                al.details, 
                al.ip_address, 
                al.created_at
            FROM admin_activity_log al
            JOIN users u ON al.admin_id = u.id
            WHERE 1=1
        '''
        params = []

        # Применение фильтров
        if admin_filter:
            query += ' AND al.admin_id = %s'
            params.append(admin_filter)

        if action_filter:
            query += ' AND al.action LIKE %s'
            params.append(f'%{action_filter}%')

        if date_from:
            query += ' AND DATE(al.created_at) >= %s'
            params.append(date_from)

        if date_to:
            query += ' AND DATE(al.created_at) <= %s'
            params.append(date_to)

        # Сортировка и пагинация
        query += ' ORDER BY al.created_at DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cursor.execute(query, params)
        logs = cursor.fetchall()

        # Получаем общее количество записей
        count_query = '''
            SELECT COUNT(*) as total FROM admin_activity_log al
            WHERE 1=1
        '''
        count_params = []

        if admin_filter:
            count_query += ' AND al.admin_id = %s'
            count_params.append(admin_filter)

        if action_filter:
            count_query += ' AND al.action LIKE %s'
            count_params.append(f'%{action_filter}%')

        if date_from:
            count_query += ' AND DATE(al.created_at) >= %s'
            count_params.append(date_from)

        if date_to:
            count_query += ' AND DATE(al.created_at) <= %s'
            count_params.append(date_to)

        cursor.execute(count_query, count_params)
        total = cursor.fetchone()['total']

        # Логирование действия администратора
        log_admin_activity(user_id, "Просмотр журнала действий администраторов")

        return jsonify({
            'total': total,
            'limit': limit,
            'offset': offset,
            'logs': logs
        })

    except Exception as e:
        app.logger.error(f'Admin activity log fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/system-settings', methods=['GET'])
@require_auth
@require_admin
def admin_get_system_settings(user_id):
    """Получение системных настроек"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT 
                id, key_name, value, description, updated_by, updated_at,
                (SELECT full_name FROM users WHERE id = updated_by) as updated_by_name
            FROM system_settings
        ''')

        settings = cursor.fetchall()

        # Логирование действия администратора
        log_admin_activity(user_id, "Просмотр системных настроек")

        return jsonify(settings)

    except Exception as e:
        app.logger.error(f'Admin system settings fetch error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/system-settings/<string:key>', methods=['PUT'])
@require_auth
@require_admin
def admin_update_system_setting(user_id, key):
    """Обновление системной настройки"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверка обязательных полей
        if 'value' not in data:
            return jsonify({'error': 'Value is required'}), 400

        # Проверка существования настройки
        cursor.execute('SELECT id FROM system_settings WHERE key_name = %s', (key,))
        setting = cursor.fetchone()

        if setting:
            # Обновление существующей настройки
            cursor.execute('''
                UPDATE system_settings
                SET value = %s, updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE key_name = %s
            ''', (data['value'], user_id, key))
        else:
            # Создание новой настройки
            description = data.get('description', '')
            cursor.execute('''
                INSERT INTO system_settings (key_name, value, description, updated_by)
                VALUES (%s, %s, %s, %s)
            ''', (key, data['value'], description, user_id))

        conn.commit()

        # Логирование действия администратора
        log_admin_activity(user_id, "Обновление системной настройки", f"Ключ: {key}, Значение: {data['value']}")

        return jsonify({'success': True, 'message': 'System setting updated successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin system setting update error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# ========== МАРШРУТ ДЛЯ ПРОСМОТРА ЛОГОВ ==========

@app.route('/logs', methods=['GET'])
def view_logs():
    """Просмотр системных логов"""
    lines = request.args.get('lines', default=100, type=int)
    format_type = request.args.get('format', default='html', type=str)
    filter_text = request.args.get('filter', default=None, type=str)
    log_level = request.args.get('level', default=None, type=str)
    start_date = request.args.get('start_date', default=None, type=str)
    end_date = request.args.get('end_date', default=None, type=str)

    # Скачивание сырого лог-файла
    if format_type == 'raw':
        log_path = os.path.join('logs', app.config['LOG_FILENAME'])
        if os.path.exists(log_path):
            return send_file(log_path, mimetype='text/plain')
        return jsonify({'error': 'Файл логов не найден'}), 404

    # Для JSON формата
    if format_type == 'json':
        logs = read_logs(lines, filter_text, log_level, start_date, end_date)
        return jsonify(logs)

    # По умолчанию: HTML формат
    logs = read_logs(lines, filter_text, log_level, start_date, end_date)

    # HTML шаблон для просмотра логов (тот же, что был)
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Журнал действий пользователей</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: 'Segoe UI', Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f0f2f5;
                color: #333;
            }
            /* ... остальные стили ... */
        </style>
    </head>
    <body>
        <!-- ... Остальная часть шаблона ... -->
    </body>
    </html>
    """

    # Рассчитываем статистику
    stats = {
        'total': len(logs),
        'info': sum(1 for log in logs if 'INFO' in log and 'ERROR' not in log and 'WARNING' not in log),
        'warning': sum(1 for log in logs if 'WARNING' in log and 'ERROR' not in log),
        'error': sum(1 for log in logs if 'ERROR' in log)
    }

    # Форматируем логи для отображения ФИО пользователей
    for i, log in enumerate(logs):
        if "SCHEDULE REQUESTED" in log:
            logs[i] = log.replace("SCHEDULE REQUESTED", "<strong>ПРОСМОТР РАСПИСАНИЯ</strong>")

    current_time = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    return render_template_string(
        html_template,
        logs=logs,
        lines=lines,
        current_time=current_time,
        filter_text=filter_text,
        log_level=log_level,
        start_date=start_date,
        end_date=end_date,
        stats=stats
    )


# ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========

if __name__ == '__main__':
    # Инициализация базы данных
    init_db()

    # Запуск сервера
    app.run(debug=True, host='0.0.0.0', port=5000)