import logging
import os
from datetime import datetime, timedelta
from functools import wraps
from logging.handlers import RotatingFileHandler
from flask_socketio import SocketIO, emit, join_room, leave_room

import jwt
import pymysql
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

# Инициализация Flask приложения
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)

# Конфигурация
app.config['SECRET_KEY'] = 'your-secret-key'  # Измените на реальный секретный ключ
app.config['JWT_EXPIRATION_DAYS'] = 30
app.config['LOG_FILENAME'] = 'app.log'

# Конфигурация базы данных
DB_CONFIG = {'host': '147.45.153.76', 'user': 'sanumxxx', 'password': 'Yandex200515_',  # Укажите пароль
             'db': 'timetable', 'charset': 'utf8mb4', 'use_unicode': True, 'cursorclass': pymysql.cursors.DictCursor}

# Настройка логирования
if not os.path.exists('logs'):
    os.makedirs('logs')

formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')
handler = RotatingFileHandler(f"logs/{app.config['LOG_FILENAME']}", maxBytes=10000000, backupCount=10)
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Server startup')

def require_auth(f):
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
            cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
            user = cursor.fetchone()
            conn.close()

            if not user:
                return jsonify({'error': 'User not found'}), 401

            return f(user_id, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            app.logger.error(f'Auth error: {str(e)}')
            return jsonify({'error': str(e)}), 500

    return decorated

@socketio.on('connect')
def handle_connect():
    app.logger.info('WebSocket client connected')

@socketio.on('join_chat')
@require_auth
def on_join(user_id, data):
    chat_id = data['chat_id']
    join_room(str(chat_id))
    app.logger.info(f'User {user_id} joined chat {chat_id}')

@socketio.on('leave_chat')
@require_auth
def on_leave(user_id, data):
    chat_id = data['chat_id']
    leave_room(str(chat_id))
    app.logger.info(f'User {user_id} left chat {chat_id}')

@app.route('/api/chats/<int:chat_id>/messages', methods=['POST'])
@require_auth
def send_message(user_id, chat_id):
    data = request.get_json()
    message = data.get('message')

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверяем, является ли пользователь участником чата
        cursor.execute('''
            SELECT 1 FROM chat_members
            WHERE chat_id = %s AND user_id = %s
        ''', (chat_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Access denied'}), 403

        # Добавляем сообщение
        cursor.execute('''
            INSERT INTO chat_messages (chat_id, sender_id, message)
            VALUES (%s, %s, %s)
        ''', (chat_id, user_id, message))

        message_id = cursor.lastrowid

        # Получаем добавленное сообщение
        cursor.execute('''
            SELECT 
                m.id,
                m.message,
                m.created_at,
                m.is_read,
                m.sender_id,
                u.full_name as sender_name
            FROM chat_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = %s
        ''', (message_id,))

        new_message = cursor.fetchone()
        conn.commit()

        # Отправляем сообщение через WebSocket
        socketio.emit('new_message', {
            'chat_id': chat_id,
            'message': new_message['message'],
            'created_at': new_message['created_at'].isoformat(),
            'sender_name': new_message['sender_name'],
        }, room=str(chat_id))

        return jsonify(new_message)

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# Функция подключения к БД
def get_db():
    return pymysql.connect(**DB_CONFIG)


# Инициализация базы данных
def init_db():
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Установка кодировки
        cursor.execute('SET NAMES utf8mb4')
        cursor.execute('SET CHARACTER SET utf8mb4')
        cursor.execute('SET character_set_connection=utf8mb4')

        # Создание таблицы пользователей
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS users (
               id INT AUTO_INCREMENT PRIMARY KEY,
               email VARCHAR(255) UNIQUE NOT NULL,
               password VARCHAR(255) NOT NULL,
               full_name VARCHAR(255) NOT NULL,
               user_type ENUM('student', 'teacher') NOT NULL,
               group_name VARCHAR(255),
               teacher_name VARCHAR(255),
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
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
               INDEX idx_date (date),
               INDEX idx_group (group_name),
               INDEX idx_teacher (teacher_name)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы чатов
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS chats (
               id INT AUTO_INCREMENT PRIMARY KEY,
               name VARCHAR(255),
               type ENUM('private', 'group') NOT NULL,
               created_by INT NOT NULL,
               group_id VARCHAR(255),
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
               FOREIGN KEY (created_by) REFERENCES users(id)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы участников чата
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS chat_members (
               id INT AUTO_INCREMENT PRIMARY KEY,
               chat_id INT NOT NULL,
               user_id INT NOT NULL,
               last_read_at TIMESTAMP,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
               FOREIGN KEY (user_id) REFERENCES users(id),
               UNIQUE KEY unique_chat_member (chat_id, user_id)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
       ''')

        # Создание таблицы сообщений чата
        cursor.execute('''
           CREATE TABLE IF NOT EXISTS chat_messages (
               id INT AUTO_INCREMENT PRIMARY KEY,
               chat_id INT NOT NULL,
               sender_id INT NOT NULL,
               message TEXT NOT NULL,
               is_read BOOLEAN DEFAULT FALSE,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
               FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
               FOREIGN KEY (sender_id) REFERENCES users(id)
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

        conn.commit()
        app.logger.info('Database initialized successfully')

    except Exception as e:
        app.logger.error(f'Database initialization error: {str(e)}')
        raise e

    finally:
        conn.close()


# Декоратор для проверки авторизации
def require_auth(f):
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
            cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
            user = cursor.fetchone()
            conn.close()

            if not user:
                return jsonify({'error': 'User not found'}), 401

            return f(user_id, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            app.logger.error(f'Auth error: {str(e)}')
            return jsonify({'error': str(e)}), 500

    return decorated


# Получение списка чатов пользователя
@app.route('/api/chats', methods=['GET'])
@require_auth
def get_chats(user_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        app.logger.info(f'Getting chats for user_id: {user_id}')

        cursor.execute('''
            SELECT 
                c.id,
                c.name,
                c.type,
                c.created_at,
                c.group_id,
                COALESCE(c.name, 
                    CASE 
                        WHEN c.type = 'private' THEN 
                            (SELECT full_name 
                            FROM users u 
                            JOIN chat_members cm ON u.id = cm.user_id 
                            WHERE cm.chat_id = c.id AND u.id != %s 
                            LIMIT 1)
                        ELSE c.name
                    END
                ) as display_name,
                (
                    SELECT COUNT(*) 
                    FROM chat_messages m 
                    WHERE m.chat_id = c.id 
                    AND m.sender_id != %s 
                    AND m.created_at > COALESCE(
                        (SELECT last_read_at 
                         FROM chat_members 
                         WHERE chat_id = c.id AND user_id = %s),
                        '1970-01-01'
                    )
                ) as unread_count,
                (
                    SELECT message 
                    FROM chat_messages 
                    WHERE chat_id = c.id 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) as last_message,
                (
                    SELECT created_at 
                    FROM chat_messages 
                    WHERE chat_id = c.id 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) as last_message_at,
                EXISTS (
                    SELECT 1 
                    FROM chat_members 
                    WHERE chat_id = c.id 
                    AND user_id = %s
                ) as is_member
            FROM chats c
            JOIN chat_members cm ON c.id = cm.chat_id
            WHERE cm.user_id = %s
            GROUP BY c.id
            ORDER BY CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END, last_message_at DESC
        ''', (user_id, user_id, user_id, user_id, user_id))

        chats = cursor.fetchall()
        app.logger.info(f'Found {len(chats)} chats')

        return jsonify(chats)

    except Exception as e:
        app.logger.error(f'Error in get_chats: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# Получение списка преподавателей для студента
@app.route('/api/teachers/my', methods=['GET'])
@require_auth
def get_my_teachers(user_id):
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

        if user['user_type'] != 'student':
            return jsonify({'error': 'Only students can view teachers'}), 403

        if not user['group_name']:
            return jsonify({'error': 'Student group not found'}), 404

        # Получаем преподавателей, которые ведут предметы у этой группы
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
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Получаем имя преподавателя
        cursor.execute('SELECT teacher_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or user['user_type'] != 'teacher':
            return jsonify({'error': 'Access denied'}), 403

        # Получаем collation столбца teacher_name из таблицы schedule
        cursor.execute("SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'schedule' AND COLUMN_NAME = 'teacher_name'")
        result = cursor.fetchone()
        teacher_name_collation = result['COLLATION_NAME'] if result else 'utf8mb4_0900_ai_ci' # По умолчанию, если не удалось получить

        # Получаем всех студентов из групп, где преподаёт учитель (за всё время)
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
        app.logger.info(f'Found {len(students)} students for teacher {user["teacher_name"]}')

        return jsonify(students)

    except Exception as e:
        app.logger.error(f'Error in get_my_students: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()



# Создание личного чата
@app.route('/api/chats/private', methods=['POST'])
@require_auth
def create_private_chat(user_id):
    data = request.get_json()
    recipient_id = data.get('userId')

    if not recipient_id:
        return jsonify({'error': 'Recipient ID is required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверяем существующий чат
        cursor.execute('''
            SELECT c.id FROM chats c
            JOIN chat_members cm1 ON c.id = cm1.chat_id
            JOIN chat_members cm2 ON c.id = cm2.chat_id
            WHERE c.type = 'private'
            AND cm1.user_id = %s
            AND cm2.user_id = %s
        ''', (user_id, recipient_id))

        existing_chat = cursor.fetchone()
        if existing_chat:
            chat_id = existing_chat['id']
        else:
            # Создаем новый чат
            cursor.execute('''
                INSERT INTO chats (type, created_by)
                VALUES ('private', %s)
            ''', (user_id,))

            chat_id = cursor.lastrowid

            # Добавляем участников
            cursor.execute('''
                INSERT INTO chat_members (chat_id, user_id)
                VALUES (%s, %s), (%s, %s)
            ''', (chat_id, user_id, chat_id, recipient_id))

        # Получаем информацию о чате
        cursor.execute('''
            SELECT 
                c.*,
                (SELECT full_name 
                 FROM users 
                 WHERE id = %s) as recipient_name
            FROM chats c
            WHERE c.id = %s
        ''', (recipient_id, chat_id))

        chat = cursor.fetchone()
        conn.commit()

        return jsonify(chat)

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# Создание группового чата
@app.route('/api/chats/group', methods=['POST'])
@require_auth
def create_group_chat(user_id):
    data = request.get_json()
    group_id = data.get('groupId')
    name = data.get('name')

    if not group_id or not name:
        return jsonify({'error': 'Group ID and name are required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверяем, является ли создатель преподавателем
        cursor.execute('''
            SELECT user_type, teacher_name 
            FROM users 
            WHERE id = %s
        ''', (user_id,))

        user = cursor.fetchone()
        if user['user_type'] != 'teacher':
            return jsonify({'error': 'Only teachers can create group chats'}), 403

        # Создаем групповой чат
        cursor.execute('''
            INSERT INTO chats (name, type, created_by, group_id)
            VALUES (%s, 'group', %s, %s)
        ''', (name, user_id, group_id))

        chat_id = cursor.lastrowid

        # Получаем всех студентов группы
        cursor.execute('''
            SELECT id FROM users
            WHERE group_name = %s AND user_type = 'student'
        ''', (group_id,))

        students = cursor.fetchall()

        # Добавляем всех студентов и создателя в чат
        values = [(chat_id, student['id']) for student in students]
        values.append((chat_id, user_id))

        cursor.executemany('''
            INSERT INTO chat_members (chat_id, user_id)
            VALUES (%s, %s)
        ''', values)

        # Получаем информацию о созданном чате
        cursor.execute('SELECT * FROM chats WHERE id = %s', (chat_id,))
        chat = cursor.fetchone()

        conn.commit()
        return jsonify(chat)

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# Получение сообщений чата
@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@require_auth
def get_chat_messages(user_id, chat_id):
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Проверяем, является ли пользователь участником чата
        cursor.execute('''
            SELECT 1 FROM chat_members
            WHERE chat_id = %s AND user_id = %s
        ''', (chat_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Access denied'}), 403

        # Получаем сообщения
        cursor.execute('''
            SELECT 
                m.id,
                m.message,
                m.created_at,
                m.is_read,
                m.sender_id,
                u.full_name as sender_name
            FROM chat_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = %s
            ORDER BY m.created_at DESC
            LIMIT %s OFFSET %s
        ''', (chat_id, limit, offset))

        messages = cursor.fetchall()
        return jsonify(messages)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# Отправка сообщения


# Отметка сообщений как прочитанных
@app.route('/api/chats/<int:chat_id>/read', methods=['POST'])
@require_auth
def mark_messages_read(user_id, chat_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Обновляем статус сообщений
        cursor.execute('''
            UPDATE chat_messages
            SET is_read = TRUE
            WHERE chat_id = %s
            AND sender_id != %s
            AND is_read = FALSE
        ''', (chat_id, user_id))

        # Обновляем время последнего прочтения
        cursor.execute('''
            UPDATE chat_members
            SET last_read_at = CURRENT_TIMESTAMP
            WHERE chat_id = %s AND user_id = %s
        ''', (chat_id, user_id))

        conn.commit()
        return jsonify({'success': True})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# Генерация JWT токена
def generate_token(user_id):
    try:
        token = jwt.encode(
            {'user_id': user_id, 'exp': datetime.utcnow() + timedelta(days=app.config['JWT_EXPIRATION_DAYS'])},
            app.config['SECRET_KEY'], algorithm='HS256')
        return token
    except Exception as e:
        app.logger.error(f'Token generation error: {str(e)}')
        raise e


# Маршруты API

# Регистрация
@app.route('/api/register', methods=['POST'])
def register():
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


# Авторизация
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT * FROM users WHERE email = %s
        ''', (data['email'],))

        user = cursor.fetchone()
        if not user or not check_password_hash(user['password'], data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401

        token = generate_token(user['id'])

        app.logger.info(f'User logged in: {data["email"]}')

        return jsonify({'token': token,
                        'user': {'id': user['id'], 'email': user['email'], 'fullName': user['full_name'],
                                 'userType': user['user_type'], 'group': user['group_name'],
                                 'teacher': user['teacher_name']}})

    except Exception as e:
        app.logger.error(f'Login error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Получение расписания
@app.route('/api/schedule', methods=['GET'])
@require_auth
def get_schedule(user_id):
    try:
        date = request.args.get('date')
        if not date:
            return jsonify({'error': 'Date is required'}), 400

        conn = get_db()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Получаем тип пользователя и данные для фильтрации
        cursor.execute('''
            SELECT user_type, 
                   CASE 
                       WHEN user_type = 'student' THEN group_name 
                       WHEN user_type = 'teacher' THEN teacher_name 
                   END as filter_value
            FROM users 
            WHERE id = %s
        ''', (user_id,))

        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # В зависимости от типа пользователя делаем разные запросы
        if user['user_type'] == 'student':
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
        return jsonify(schedule)

    except Exception as e:
        print(f"Schedule fetch error: {str(e)}")

        return jsonify({'error': str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()


@app.route('/api/profile/details', methods=['GET'])
@require_auth
def get_profile_details(user_id):
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


# Получение списка групп
@app.route('/api/groups', methods=['GET'])
def get_groups():
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


# Получение списка преподавателей
@app.route('/api/teachers', methods=['GET'])
def get_teachers():
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
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Получаем данные преподавателя
        cursor.execute('SELECT teacher_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or user['user_type'] != 'teacher':
            return jsonify({'error': 'Access denied'}), 403

        # Получаем все группы преподавателя из всего расписания
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


# Получение профиля пользователя
@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile(user_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT id, email, full_name, user_type, group_name, teacher_name
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


# Запуск сервера
if __name__ == '__main__':
    init_db()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
