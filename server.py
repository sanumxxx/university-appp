import logging
import os
from datetime import datetime, timedelta
from functools import wraps
from logging.handlers import RotatingFileHandler
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import re
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template_string, send_file
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


# Маршрут для просмотра логов
@app.route('/logs', methods=['GET'])
def view_logs():
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

    # HTML шаблон для просмотра логов
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
            .container {
                max-width: 1300px;
                margin: 0 auto;
                background-color: white;
                padding: 25px;
                border-radius: 8px;
                box-shadow: 0 3px 10px rgba(0,0,0,0.1);
            }
            h1 {
                color: #2c3e50;
                margin-top: 0;
                text-align: center;
                font-size: 32px;
                margin-bottom: 20px;
                border-bottom: 2px solid #eaeaea;
                padding-bottom: 15px;
            }
            .logs {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 20px;
                font-family: 'Courier New', monospace;
                white-space: pre-wrap;
                overflow-x: auto;
                max-height: 70vh;
                overflow-y: auto;
            }
            .log-line {
                margin: 8px 0;
                padding: 10px;
                border-bottom: 1px solid #eaeaea;
                border-radius: 4px;
                font-size: 16px;
                line-height: 1.5;
                transition: background-color 0.2s;
            }
            .log-line:hover {
                background-color: #f1f1f1;
            }
            .error { 
                color: #e74c3c; 
                font-weight: bold; 
                background-color: #fdeaea;
                border-left: 5px solid #e74c3c;
            }
            .warning { 
                color: #e67e22; 
                background-color: #fef5ea;
                border-left: 5px solid #e67e22;
            }
            .info { 
                color: #2980b9; 
                background-color: #f0f7fc;
                border-left: 5px solid #2980b9;
            }
            .controls {
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 15px;
            }
            .control-group {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                align-items: center;
            }
            select, button, input {
                padding: 10px 15px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 15px;
            }
            button {
                background-color: #3498db;
                color: white;
                cursor: pointer;
                border: none;
                font-weight: bold;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: #2980b9;
            }
            button.download {
                background-color: #27ae60;
            }
            button.download:hover {
                background-color: #219653;
            }
            .current-time {
                font-size: 15px;
                color: #7f8c8d;
                background: #f8f9fa;
                padding: 8px 15px;
                border-radius: 6px;
                border: 1px solid #eaeaea;
            }
            .filter-bar {
                margin: 10px 0 20px 0;
                padding: 20px;
                background-color: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #eaeaea;
            }
            .filter-form {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                align-items: center;
            }
            .filter-form label {
                margin-right: 8px;
                font-weight: bold;
                color: #34495e;
            }
            .filter-actions {
                display: flex;
                gap: 15px;
                margin-top: 15px;
            }
            .highlight {
                background-color: #ffeaa7;
                color: #000;
                padding: 2px 4px;
                border-radius: 3px;
                font-weight: bold;
            }
            .stat-box {
                display: flex;
                gap: 20px;
                margin-bottom: 25px;
            }
            .stat-item {
                background-color: #f8f9fa;
                border: 1px solid #eaeaea;
                border-radius: 8px;
                padding: 15px 20px;
                flex: 1;
                text-align: center;
                box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                transition: transform 0.2s;
            }
            .stat-item:hover {
                transform: translateY(-3px);
            }
            .stat-item .count {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 8px;
            }
            .stat-item .label {
                color: #7f8c8d;
                font-size: 16px;
                font-weight: 500;
            }
            .error-stat { color: #e74c3c; }
            .warning-stat { color: #e67e22; }
            .info-stat { color: #2980b9; }
            .schedule-view {
                font-weight: bold;
                background-color: #e8f4fc !important;
            }
            .user-name {
                font-weight: bold;
                color: #8e44ad;
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Журнал действий пользователей</h1>

            <!-- Статистика -->
            <div class="stat-box">
                <div class="stat-item">
                    <div class="count">{{ stats.total }}</div>
                    <div class="label">Всего записей</div>
                </div>
                <div class="stat-item">
                    <div class="count info-stat">{{ stats.info }}</div>
                    <div class="label">Информация</div>
                </div>
                <div class="stat-item">
                    <div class="count warning-stat">{{ stats.warning }}</div>
                    <div class="label">Предупреждения</div>
                </div>
                <div class="stat-item">
                    <div class="count error-stat">{{ stats.error }}</div>
                    <div class="label">Ошибки</div>
                </div>
            </div>

            <!-- Управление -->
            <div class="controls">
                <div class="control-group">
                    <label for="lines">Строк:</label>
                    <select id="lines" onchange="applyFilters()">
                        <option value="50" {{ 'selected' if lines == 50 else '' }}>50</option>
                        <option value="100" {{ 'selected' if lines == 100 else '' }}>100</option>
                        <option value="500" {{ 'selected' if lines == 500 else '' }}>500</option>
                        <option value="1000" {{ 'selected' if lines == 1000 else '' }}>1000</option>
                    </select>
                    <button onclick="refreshLogs()">Обновить</button>
                    <a href="/logs?format=raw" target="_blank">
                        <button type="button" class="download">Скачать файл логов</button>
                    </a>
                </div>
                <div class="current-time">Последнее обновление: {{ current_time }}</div>
            </div>

            <!-- Панель фильтров -->
            <div class="filter-bar">
                <form id="filter-form" class="filter-form" onsubmit="applyFilters(); return false;">
                    <div>
                        <label for="filter-text">Поиск по тексту:</label>
                        <input type="text" id="filter-text" value="{{ filter_text or '' }}" placeholder="Введите текст для поиска...">
                    </div>
                    <div>
                        <label for="log-level">Уровень:</label>
                        <select id="log-level">
                            <option value="" {{ 'selected' if not log_level else '' }}>Все уровни</option>
                            <option value="INFO" {{ 'selected' if log_level == 'INFO' else '' }}>Информация+</option>
                            <option value="WARNING" {{ 'selected' if log_level == 'WARNING' else '' }}>Предупреждения+</option>
                            <option value="ERROR" {{ 'selected' if log_level == 'ERROR' else '' }}>Только ошибки</option>
                        </select>
                    </div>
                    <div>
                        <label for="start-date">С даты:</label>
                        <input type="date" id="start-date" value="{{ start_date or '' }}">
                    </div>
                    <div>
                        <label for="end-date">По дату:</label>
                        <input type="date" id="end-date" value="{{ end_date or '' }}">
                    </div>
                    <div class="filter-actions">
                        <button type="submit">Применить фильтры</button>
                        <button type="button" onclick="clearFilters()">Сбросить фильтры</button>
                    </div>
                </form>
            </div>

            <!-- Отображение логов -->
            <div class="logs">
                {% for log in logs %}
                    <div class="log-line 
                        {% if 'ERROR' in log %}error
                        {% elif 'WARNING' in log %}warning
                        {% elif 'INFO' in log %}info{% endif %}
                        {% if 'SCHEDULE REQUESTED' in log %}schedule-view{% endif %}">
                        {% if filter_text %}
                            {{ log|replace(filter_text, '<span class="highlight">' + filter_text + '</span>')|safe }}
                        {% else %}
                            {{ log|safe }}
                        {% endif %}
                    </div>
                {% endfor %}
            </div>
        </div>

        <script>
            function refreshLogs() {
                location.reload();
            }

            function applyFilters() {
                const lines = document.getElementById('lines').value;
                const filterText = document.getElementById('filter-text').value;
                const logLevel = document.getElementById('log-level').value;
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;

                let url = `/logs?lines=${lines}`;
                if (filterText) url += `&filter=${encodeURIComponent(filterText)}`;
                if (logLevel) url += `&level=${logLevel}`;
                if (startDate) url += `&start_date=${startDate}`;
                if (endDate) url += `&end_date=${endDate}`;

                window.location.href = url;
            }

            function clearFilters() {
                document.getElementById('filter-text').value = '';
                document.getElementById('log-level').value = '';
                document.getElementById('start-date').value = '';
                document.getElementById('end-date').value = '';
                applyFilters();
            }

            // Авто-обновление каждые 30 секунд
            const refreshTimer = setTimeout(() => {
                refreshLogs();
            }, 30000);

            // Прокрутка вниз при загрузке страницы
            window.onload = function() {
                const logsContainer = document.querySelector('.logs');
                logsContainer.scrollTop = logsContainer.scrollHeight;

                // Выделение имен пользователей в строках расписания
                highlightUserNames();
            };

            // Функция выделения имен пользователей
            function highlightUserNames() {
                const logLines = document.querySelectorAll('.log-line');
                const nameRegex = /([А-Яа-яЁё]+ [А-Яа-яЁё]+ [А-Яа-яЁё]+)/g;

                logLines.forEach(line => {
                    if (line.classList.contains('schedule-view')) {
                        line.innerHTML = line.innerHTML.replace(nameRegex, '<span class="user-name">$1</span>');
                    }
                });
            }
        </script>
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


# Add this helper function to log user actions consistently
def log_user_action(user_id, action, details=None):
    """Log user actions with details"""
    if details:
        app.logger.info(f"USER ACTION: User {user_id} - {action} - {details}")
    else:
        app.logger.info(f"USER ACTION: User {user_id} - {action}")


# Optional - Add a scheduled task to rotate logs if they get too large
def setup_log_rotation():
    """Setup scheduled task to check log size and rotate if needed"""

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
        cursor.execute(
            "SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'schedule' AND COLUMN_NAME = 'teacher_name'")
        result = cursor.fetchone()
        teacher_name_collation = result[
            'COLLATION_NAME'] if result else 'utf8mb4_0900_ai_ci'  # По умолчанию, если не удалось получить

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
        # Log login attempt
        app.logger.info(f'LOGIN ATTEMPT: {data.get("email", "unknown")} - IP: {request.remote_addr}')

        cursor.execute('''
            SELECT * FROM users WHERE email = %s
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


@app.route('/api/schedule', methods=['GET'])
@require_auth
def get_schedule(user_id):
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

        # Остальной код функции остается неизменным...
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

        # Дополнительный лог о количестве пар в расписании
        app.logger.info(f'ДАННЫЕ РАСПИСАНИЯ: {user["full_name"]} получил {len(schedule)} пар на {display_date}')

        return jsonify(schedule)

    except Exception as e:
        app.logger.error(f'Ошибка получения расписания для пользователя {user_id}: {str(e)}')
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


# Add these imports if not already present
import re
import json
from datetime import datetime, timedelta, date
import calendar


# Admin authorization middleware
def require_admin(f):
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

            if user['user_type'] != 'admin':
                return jsonify({'error': 'Admin access required'}), 403

            # Log admin access
            app.logger.info(f'ADMIN ACCESS: User ID {user_id} accessed admin API: {request.path}')

            return f(user_id, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            app.logger.error(f'Admin auth error: {str(e)}')
            return jsonify({'error': str(e)}), 500

    return decorated


# Admin Dashboard Statistics
@app.route('/api/admin/dashboard/stats', methods=['GET'])
@require_admin
def admin_dashboard_stats(admin_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get total students count
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE user_type = 'student'")
        students_count = cursor.fetchone()['count']

        # Get total teachers count
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE user_type = 'teacher'")
        teachers_count = cursor.fetchone()['count']

        # Get total courses/subjects count
        cursor.execute("SELECT COUNT(DISTINCT subject) as count FROM schedule")
        courses_count = cursor.fetchone()['count']

        # Get total lessons count
        cursor.execute("SELECT COUNT(*) as count FROM schedule")
        lessons_count = cursor.fetchone()['count']

        # Get active users (users who logged in within the last 24 hours)
        # This would require a separate table to track user logins, for now using a placeholder
        active_users = 0

        # Get pending requests (e.g., new user registrations to approve)
        # This would require additional tables, for now using a placeholder
        pending_requests = 0

        stats = {
            'totalStudents': students_count,
            'totalTeachers': teachers_count,
            'totalCourses': courses_count,
            'totalLessons': lessons_count,
            'activeUsers': active_users,
            'pendingRequests': pending_requests
        }

        # Log admin action
        app.logger.info(f'ADMIN STATS: Admin ID {admin_id} viewed dashboard statistics')

        return jsonify(stats)

    except Exception as e:
        app.logger.error(f'Admin dashboard stats error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Admin Activity Log
@app.route('/api/admin/activity-log', methods=['GET'])
@require_admin
def admin_activity_log(admin_id):
    limit = int(request.args.get('limit', 10))
    offset = int(request.args.get('offset', 0))
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Create activity log table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admin_activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                admin_name VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ''')
        conn.commit()

        # Get activity logs with admin name
        cursor.execute('''
            SELECT al.*, u.full_name as admin_name 
            FROM admin_activity_log al
            JOIN users u ON al.admin_id = u.id
            ORDER BY al.created_at DESC
            LIMIT %s OFFSET %s
        ''', (limit, offset))

        logs = cursor.fetchall()

        return jsonify({'logs': logs})

    except Exception as e:
        app.logger.error(f'Admin activity log error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Helper function to log admin activity
def log_admin_activity(admin_id, action, details=None):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get admin name
        cursor.execute('SELECT full_name FROM users WHERE id = %s', (admin_id,))
        admin = cursor.fetchone()
        admin_name = admin['full_name'] if admin else 'Unknown Admin'

        # Log the activity
        cursor.execute('''
            INSERT INTO admin_activity_log 
            (admin_id, admin_name, action, details) 
            VALUES (%s, %s, %s, %s)
        ''', (admin_id, admin_name, action, details))

        conn.commit()
        app.logger.info(f'ADMIN ACTION: {admin_name} ({admin_id}) {action} {details or ""}')

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Error logging admin activity: {str(e)}')
    finally:
        conn.close()


# Get all users (with filtering and pagination)
@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_get_users(admin_id):
    user_type = request.args.get('type')  # Filter by user type
    search = request.args.get('search')  # Search by name, email, group
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Build the query with optional filters
        query = '''
            SELECT 
                id, email, full_name, user_type, group_name, teacher_name, 
                status, created_at, updated_at
            FROM users
            WHERE 1=1
        '''
        params = []

        # Add user type filter if provided
        if user_type and user_type != 'all':
            query += ' AND user_type = %s'
            params.append(user_type)

        # Add search filter if provided
        if search:
            query += ''' AND (
                full_name LIKE %s OR 
                email LIKE %s OR 
                group_name LIKE %s OR
                teacher_name LIKE %s
            )'''
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param, search_param])

        # Add limit and offset
        query += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cursor.execute(query, params)
        users = cursor.fetchall()

        # Log admin action
        log_admin_activity(admin_id, "просмотр списка пользователей",
                           f"Найдено {len(users)} пользователей")

        return jsonify(users)

    except Exception as e:
        app.logger.error(f'Admin get users error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Get a single user
@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
@require_admin
def admin_get_user(admin_id, user_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT 
                id, email, full_name, user_type, group_name, teacher_name, 
                status, created_at, updated_at
            FROM users
            WHERE id = %s
        ''', (user_id,))

        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Log admin action
        log_admin_activity(admin_id, "просмотр пользователя",
                           f"ID: {user_id}, Email: {user['email']}")

        return jsonify(user)

    except Exception as e:
        app.logger.error(f'Admin get user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Create a new user
@app.route('/api/admin/users', methods=['POST'])
@require_admin
def admin_create_user(admin_id):
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check required fields
        required_fields = ['email', 'password', 'fullName', 'userType']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Field {field} is required'}), 400

        # Check if email already exists
        cursor.execute('SELECT id FROM users WHERE email = %s', (data['email'],))
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 400

        # Hash password
        hashed_password = generate_password_hash(data['password'])

        # Insert user
        cursor.execute('''
            INSERT INTO users 
            (email, password, full_name, user_type, group_name, teacher_name, status)
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
        user_id = cursor.lastrowid

        # Get the created user
        cursor.execute('''
            SELECT 
                id, email, full_name, user_type, group_name, teacher_name, 
                status, created_at, updated_at
            FROM users
            WHERE id = %s
        ''', (user_id,))

        user = cursor.fetchone()

        # Log admin action
        log_admin_activity(admin_id, "создание пользователя",
                           f"ID: {user_id}, Email: {data['email']}, Тип: {data['userType']}")

        return jsonify(user)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin create user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Update a user
@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@require_admin
def admin_update_user(admin_id, user_id):
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if user exists
        cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Build update query
        query = 'UPDATE users SET '
        params = []
        update_fields = []

        # Check each field and add to update if provided
        if 'email' in data:
            # Check if email already exists for another user
            cursor.execute('SELECT id FROM users WHERE email = %s AND id != %s',
                           (data['email'], user_id))
            if cursor.fetchone():
                return jsonify({'error': 'Email already used by another user'}), 400

            update_fields.append('email = %s')
            params.append(data['email'])

        if 'password' in data:
            update_fields.append('password = %s')
            params.append(generate_password_hash(data['password']))

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

        # If no fields to update
        if not update_fields:
            return jsonify({'message': 'No fields to update'}), 200

        # Complete the query
        query += ', '.join(update_fields) + ' WHERE id = %s'
        params.append(user_id)

        # Execute update
        cursor.execute(query, params)
        conn.commit()

        # Get updated user
        cursor.execute('''
            SELECT 
                id, email, full_name, user_type, group_name, teacher_name, 
                status, created_at, updated_at
            FROM users
            WHERE id = %s
        ''', (user_id,))

        updated_user = cursor.fetchone()

        # Log admin action
        field_changes = ', '.join([f"{k}: {v}" for k, v in data.items() if k != 'password'])
        log_admin_activity(admin_id, "обновление пользователя",
                           f"ID: {user_id}, Изменения: {field_changes}")

        return jsonify(updated_user)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin update user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Delete a user
@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_admin
def admin_delete_user(admin_id, user_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if user exists and get email for logging
        cursor.execute('SELECT email, full_name FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Don't allow deleting yourself
        if user_id == admin_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400

        # Delete user
        cursor.execute('DELETE FROM users WHERE id = %s', (user_id,))
        conn.commit()

        # Log admin action
        log_admin_activity(admin_id, "удаление пользователя",
                           f"ID: {user_id}, Email: {user['email']}, ФИО: {user['full_name']}")

        return jsonify({'success': True, 'message': 'User deleted successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin delete user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Get all schedules with filtering
@app.route('/api/admin/schedules', methods=['GET'])
@require_admin
def admin_get_schedules(admin_id):
    # Parse query parameters
    date = request.args.get('date')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    search = request.args.get('search')
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Build the query with optional filters
        query = '''
            SELECT 
                id, semester, week_number, group_name, course, faculty, subject,
                lesson_type, subgroup, DATE_FORMAT(date, '%Y-%m-%d') as date, 
                TIME_FORMAT(time_start, '%H:%i') as time_start, 
                TIME_FORMAT(time_end, '%H:%i') as time_end, 
                weekday, teacher_name, auditory
            FROM schedule
            WHERE 1=1
        '''
        params = []

        # Add date filter if provided
        if date:
            query += ' AND date = %s'
            params.append(date)

        # Add date range filter if provided
        if date_from and date_to:
            query += ' AND date BETWEEN %s AND %s'
            params.extend([date_from, date_to])

        # Add search filter if provided
        if search:
            query += ''' AND (
                group_name LIKE %s OR 
                subject LIKE %s OR 
                teacher_name LIKE %s OR
                auditory LIKE %s
            )'''
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param, search_param])

        # Add ordering and pagination
        query += ' ORDER BY date, time_start LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cursor.execute(query, params)
        schedules = cursor.fetchall()

        # Log admin action
        filter_desc = f"Фильтры: " + ", ".join([
            f"дата={date}" if date else "",
            f"с {date_from} по {date_to}" if date_from and date_to else "",
            f"поиск={search}" if search else ""
        ]).strip(", ")

        log_admin_activity(admin_id, "просмотр расписания",
                           f"Найдено {len(schedules)} записей. {filter_desc}")

        return jsonify(schedules)

    except Exception as e:
        app.logger.error(f'Admin get schedules error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Get a single schedule item
@app.route('/api/admin/schedule/<int:schedule_id>', methods=['GET'])
@require_admin
def admin_get_schedule(admin_id, schedule_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT 
                id, semester, week_number, group_name, course, faculty, subject,
                lesson_type, subgroup, DATE_FORMAT(date, '%Y-%m-%d') as date, 
                TIME_FORMAT(time_start, '%H:%i') as time_start, 
                TIME_FORMAT(time_end, '%H:%i') as time_end, 
                weekday, teacher_name, auditory
            FROM schedule
            WHERE id = %s
        ''', (schedule_id,))

        schedule = cursor.fetchone()

        if not schedule:
            return jsonify({'error': 'Schedule not found'}), 404

        # Log admin action
        log_admin_activity(admin_id, "просмотр записи расписания",
                           f"ID: {schedule_id}, Предмет: {schedule['subject']}")

        return jsonify(schedule)

    except Exception as e:
        app.logger.error(f'Admin get schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Create a new schedule item
@app.route('/api/admin/schedule', methods=['POST'])
@require_admin
def admin_create_schedule(admin_id):
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check required fields
        required_fields = ['date', 'time_start', 'time_end', 'subject',
                           'lesson_type', 'group_name', 'teacher_name', 'auditory']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Field {field} is required'}), 400

        # Insert schedule
        cursor.execute('''
            INSERT INTO schedule (
                date, time_start, time_end, subject, lesson_type, 
                group_name, teacher_name, auditory, subgroup, 
                semester, week_number, course, faculty, weekday
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            data['date'],
            data['time_start'],
            data['time_end'],
            data['subject'],
            data['lesson_type'],
            data['group_name'],
            data['teacher_name'],
            data['auditory'],
            data.get('subgroup', 0),
            data.get('semester'),
            data.get('week_number'),
            data.get('course'),
            data.get('faculty'),
            data.get('weekday', 1)  # Default to Monday if not provided
        ))

        conn.commit()
        schedule_id = cursor.lastrowid

        # Get the created schedule
        cursor.execute('''
            SELECT 
                id, semester, week_number, group_name, course, faculty, subject,
                lesson_type, subgroup, DATE_FORMAT(date, '%Y-%m-%d') as date, 
                TIME_FORMAT(time_start, '%H:%i') as time_start, 
                TIME_FORMAT(time_end, '%H:%i') as time_end, 
                weekday, teacher_name, auditory
            FROM schedule
            WHERE id = %s
        ''', (schedule_id,))

        schedule = cursor.fetchone()

        # Log admin action
        log_admin_activity(admin_id, "создание занятия",
                           f"ID: {schedule_id}, Предмет: {data['subject']}, Группа: {data['group_name']}")

        return jsonify(schedule)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin create schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Update a schedule item
@app.route('/api/admin/schedule/<int:schedule_id>', methods=['PUT'])
@require_admin
def admin_update_schedule(admin_id, schedule_id):
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if schedule exists
        cursor.execute('SELECT * FROM schedule WHERE id = %s', (schedule_id,))
        schedule = cursor.fetchone()

        if not schedule:
            return jsonify({'error': 'Schedule not found'}), 404

        # Build update query
        query = 'UPDATE schedule SET '
        params = []
        update_fields = []

        # Check each field and add to update if provided
        fields = [
            ('date', 'date'),
            ('time_start', 'time_start'),
            ('time_end', 'time_end'),
            ('subject', 'subject'),
            ('lesson_type', 'lesson_type'),
            ('group_name', 'group_name'),
            ('teacher_name', 'teacher_name'),
            ('auditory', 'auditory'),
            ('subgroup', 'subgroup'),
            ('semester', 'semester'),
            ('week_number', 'week_number'),
            ('course', 'course'),
            ('faculty', 'faculty'),
            ('weekday', 'weekday')
        ]

        for api_field, db_field in fields:
            if api_field in data:
                update_fields.append(f'{db_field} = %s')
                params.append(data[api_field])

        # If no fields to update
        if not update_fields:
            return jsonify({'message': 'No fields to update'}), 200

        # Complete the query
        query += ', '.join(update_fields) + ' WHERE id = %s'
        params.append(schedule_id)

        # Execute update
        cursor.execute(query, params)
        conn.commit()

        # Get updated schedule
        cursor.execute('''
            SELECT 
                id, semester, week_number, group_name, course, faculty, subject,
                lesson_type, subgroup, DATE_FORMAT(date, '%Y-%m-%d') as date, 
                TIME_FORMAT(time_start, '%H:%i') as time_start, 
                TIME_FORMAT(time_end, '%H:%i') as time_end, 
                weekday, teacher_name, auditory
            FROM schedule
            WHERE id = %s
        ''', (schedule_id,))

        updated_schedule = cursor.fetchone()

        # Log admin action
        field_changes = ', '.join([f"{k}: {v}" for k, v in data.items()])
        log_admin_activity(admin_id, "обновление занятия",
                           f"ID: {schedule_id}, Изменения: {field_changes}")

        return jsonify(updated_schedule)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin update schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Delete a schedule item
@app.route('/api/admin/schedule/<int:schedule_id>', methods=['DELETE'])
@require_admin
def admin_delete_schedule(admin_id, schedule_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if schedule exists and get info for logging
        cursor.execute('SELECT subject, group_name FROM schedule WHERE id = %s', (schedule_id,))
        schedule = cursor.fetchone()

        if not schedule:
            return jsonify({'error': 'Schedule not found'}), 404

        # Delete schedule
        cursor.execute('DELETE FROM schedule WHERE id = %s', (schedule_id,))
        conn.commit()

        # Log admin action
        log_admin_activity(admin_id, "удаление занятия",
                           f"ID: {schedule_id}, Предмет: {schedule['subject']}, Группа: {schedule['group_name']}")

        return jsonify({'success': True, 'message': 'Schedule deleted successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin delete schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Get requests (placeholder for now, could be admission requests, support tickets, etc.)
@app.route('/api/admin/requests', methods=['GET'])
@require_admin
def admin_get_requests(admin_id):
    # This is a placeholder endpoint
    # In a real application, you would query a table of requests or tickets

    # Log admin action
    log_admin_activity(admin_id, "просмотр запросов",
                       "Просмотр списка запросов пользователей")

    # Return empty list for now
    return jsonify([])


# Analytics endpoints
@app.route('/api/admin/analytics/users', methods=['GET'])
@require_admin
def admin_analytics_users(admin_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get user registration stats by month
        cursor.execute('''
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as count,
                SUM(CASE WHEN user_type = 'student' THEN 1 ELSE 0 END) as students,
                SUM(CASE WHEN user_type = 'teacher' THEN 1 ELSE 0 END) as teachers,
                SUM(CASE WHEN user_type = 'admin' THEN 1 ELSE 0 END) as admins
            FROM users
            GROUP BY month
            ORDER BY month
        ''')

        monthly_registrations = cursor.fetchall()

        # Get user types distribution
        cursor.execute('''
            SELECT 
                user_type,
                COUNT(*) as count
            FROM users
            GROUP BY user_type
        ''')

        user_types = cursor.fetchall()

        # Log admin action
        log_admin_activity(admin_id, "просмотр аналитики пользователей",
                           "Статистика регистраций и распределение по типам")

        return jsonify({
            'monthlyRegistrations': monthly_registrations,
            'userTypes': user_types
        })

    except Exception as e:
        app.logger.error(f'Admin analytics users error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/analytics/schedule', methods=['GET'])
@require_admin
def admin_analytics_schedule(admin_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get schedule distribution by day of week
        cursor.execute('''
            SELECT 
                weekday,
                COUNT(*) as count
            FROM schedule
            GROUP BY weekday
            ORDER BY weekday
        ''')

        weekday_distribution = cursor.fetchall()

        # Get schedule distribution by lesson type
        cursor.execute('''
            SELECT 
                lesson_type,
                COUNT(*) as count
            FROM schedule
            GROUP BY lesson_type
            ORDER BY count DESC
        ''')

        lesson_types = cursor.fetchall()

        # Get top teachers by lesson count
        cursor.execute('''
            SELECT 
                teacher_name,
                COUNT(*) as count
            FROM schedule
            GROUP BY teacher_name
            ORDER BY count DESC
            LIMIT 10
        ''')

        top_teachers = cursor.fetchall()

        # Get top subjects by lesson count
        cursor.execute('''
            SELECT 
                subject,
                COUNT(*) as count
            FROM schedule
            GROUP BY subject
            ORDER BY count DESC
            LIMIT 10
        ''')

        top_subjects = cursor.fetchall()

        # Log admin action
        log_admin_activity(admin_id, "просмотр аналитики расписания",
                           "Статистика распределения занятий")

        return jsonify({
            'weekdayDistribution': weekday_distribution,
            'lessonTypes': lesson_types,
            'topTeachers': top_teachers,
            'topSubjects': top_subjects
        })

    except Exception as e:
        app.logger.error(f'Admin analytics schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# Admin settings endpoints
@app.route('/api/admin/settings', methods=['GET'])
@require_admin
def admin_get_settings(admin_id):
    # Placeholder for system settings
    # In a real application, you would have a settings table

    # Log admin action
    log_admin_activity(admin_id, "просмотр настроек системы",
                       "Просмотр системных настроек")

    # Return placeholder settings
    return jsonify({
        'appName': 'University App',
        'maintenanceMode': False,
        'allowRegistration': True,
        'maxFileSize': 5,  # MB
        'logRetentionDays': 30
    })


@app.route('/api/admin/settings', methods=['PUT'])
@require_admin
def admin_update_settings(admin_id):
    # Placeholder for updating system settings
    data = request.get_json()

    # Log admin action
    settings_changes = ', '.join([f"{k}: {v}" for k, v in data.items()])
    log_admin_activity(admin_id, "обновление настроек системы",
                       f"Изменения: {settings_changes}")

    # In a real application, you would update a settings table
    return jsonify({
        'success': True,
        'message': 'Settings updated successfully'
    })


# Запуск сервера
if __name__ == '__main__':
    init_db()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
