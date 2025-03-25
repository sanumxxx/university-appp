import logging
import os
import re
from datetime import datetime, timedelta
from functools import wraps
from logging.handlers import RotatingFileHandler
from flask import Flask, request, jsonify, render_template_string, send_file
import jwt
import pymysql
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

# ============================================================
# CONFIGURATION
# ============================================================

# Initialize Flask application
app = Flask(__name__)
CORS(app)

# App configuration
app.config['SECRET_KEY'] = 'your-secret-key'  # Change to real secret key
app.config['JWT_EXPIRATION_DAYS'] = 30
app.config['LOG_FILENAME'] = 'app.log'

# Database configuration
DB_CONFIG = {
    'host': '147.45.153.76',
    'user': 'sanumxxx',
    'password': 'Yandex200515_',
    'db': 'timetable',
    'charset': 'utf8mb4',
    'use_unicode': True,
    'cursorclass': pymysql.cursors.DictCursor
}

# ============================================================
# LOGGING SETUP
# ============================================================

# Setup logging
if not os.path.exists('logs'):
    os.makedirs('logs')

formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')
handler = RotatingFileHandler(f"logs/{app.config['LOG_FILENAME']}", maxBytes=10000000, backupCount=10)
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Server startup')


# ============================================================
# DATABASE FUNCTIONS
# ============================================================

def get_db():
    """Get database connection"""
    return pymysql.connect(**DB_CONFIG)


def init_db():
    """Initialize database tables"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Set encoding
        cursor.execute('SET NAMES utf8mb4')
        cursor.execute('SET CHARACTER SET utf8mb4')
        cursor.execute('SET character_set_connection=utf8mb4')

        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                user_type ENUM('student', 'teacher', 'admin') NOT NULL,
                group_name VARCHAR(255),
                teacher_name VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ''')

        # Create schedule table
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

        # Create notifications table
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

        # Create admin activity log table
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
        app.logger.info('Database initialized successfully')

    except Exception as e:
        app.logger.error(f'Database initialization error: {str(e)}')
        raise e

    finally:
        conn.close()


# ============================================================
# AUTHENTICATION HELPERS
# ============================================================

def generate_token(user_id):
    """Generate JWT token for user authentication"""
    try:
        token = jwt.encode(
            {'user_id': user_id, 'exp': datetime.utcnow() + timedelta(days=app.config['JWT_EXPIRATION_DAYS'])},
            app.config['SECRET_KEY'], algorithm='HS256')
        return token
    except Exception as e:
        app.logger.error(f'Token generation error: {str(e)}')
        raise e


def require_auth(f):
    """Decorator to require authentication for routes"""

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


def require_admin(f):
    """Decorator to require admin authentication for routes"""

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


# ============================================================
# LOGGING HELPERS
# ============================================================

def log_user_action(user_id, action, details=None):
    """Log user actions with details"""
    if details:
        app.logger.info(f"USER ACTION: User {user_id} - {action} - {details}")
    else:
        app.logger.info(f"USER ACTION: User {user_id} - {action}")


def log_admin_activity(admin_id, action, details=None):
    """Log admin activity in database"""
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


def read_logs(tail_lines=100, filter_text=None, log_level=None, start_date=None, end_date=None):
    """
    Read logs with filtering options

    Args:
        tail_lines: Number of lines to return
        filter_text: Text to filter logs by
        log_level: Filter by log level (INFO, WARNING, ERROR)
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    """
    log_path = os.path.join('logs', app.config['LOG_FILENAME'])
    try:
        if not os.path.exists(log_path):
            return ["Logs not found"]

        with open(log_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()

        # Apply filters
        filtered_lines = []
        date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2})')

        for line in lines:
            # Text filter
            if filter_text and filter_text.lower() not in line.lower():
                continue

            # Log level filter
            if log_level:
                if log_level == "ERROR" and "ERROR" not in line:
                    continue
                elif log_level == "WARNING" and "WARNING" not in line and "ERROR" not in line:
                    continue
                elif log_level == "INFO" and "INFO" not in line and "WARNING" not in line and "ERROR" not in line:
                    continue

            # Date filter
            if start_date or end_date:
                date_match = date_pattern.search(line)
                if date_match:
                    line_date = date_match.group(1)
                    if start_date and line_date < start_date:
                        continue
                    if end_date and line_date > end_date:
                        continue

            filtered_lines.append(line)

        # Return only requested number of lines
        return filtered_lines[-tail_lines:] if len(filtered_lines) > tail_lines else filtered_lines

    except Exception as e:
        return [f"Error reading logs: {str(e)}"]


# ============================================================
# USER AUTHENTICATION ROUTES
# ============================================================

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check required fields
        required_fields = ['email', 'password', 'fullName', 'userType']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Check if email already exists
        cursor.execute('SELECT id FROM users WHERE email = %s', (data['email'],))
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 400

        # Hash password
        hashed_password = generate_password_hash(data['password'])

        # Insert user
        cursor.execute('''
            INSERT INTO users (email, password, full_name, user_type, group_name, teacher_name)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (
            data['email'],
            hashed_password,
            data['fullName'],
            data['userType'],
            data.get('group'),
            data.get('teacher')
        ))

        conn.commit()
        user_id = cursor.lastrowid

        token = generate_token(user_id)

        app.logger.info(f'New user registered: {data["email"]}')

        return jsonify({
            'token': token,
            'user': {
                'id': user_id,
                'email': data['email'],
                'fullName': data['fullName'],
                'userType': data['userType'],
                'group': data.get('group'),
                'teacher': data.get('teacher')
            }
        })

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Registration error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    """User login"""
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

        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'fullName': user['full_name'],
                'userType': user['user_type'],
                'group': user['group_name'],
                'teacher': user['teacher_name']
            }
        })

    except Exception as e:
        app.logger.error(f'Login error for {data.get("email", "unknown")}: {str(e)} - IP: {request.remote_addr}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


# ============================================================
# SCHEDULE ROUTES
# ============================================================

@app.route('/api/schedule', methods=['GET'])
@require_auth
def get_schedule(user_id):
    """Get schedule for a specific date"""
    try:
        date = request.args.get('date')
        if not date:
            app.logger.warning(f'SCHEDULE REQUEST ERROR: User {user_id} - Date not specified')
            return jsonify({'error': 'Date is required'}), 400

        conn = get_db()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Get user type, name and filter data
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
            app.logger.warning(f'SCHEDULE REQUEST ERROR: User ID {user_id} not found')
            return jsonify({'error': 'User not found'}), 404

        # Format date for logs in a more readable format
        display_date = datetime.strptime(date, '%Y-%m-%d').strftime('%d.%m.%Y')

        # Enhanced logging with name
        user_type_ru = "преподаватель" if user['user_type'] == 'teacher' else "студент"
        app.logger.info(
            f'SCHEDULE REQUESTED: {user["full_name"]} ({user_type_ru}) requested schedule for {display_date}')

        # Rest of the function remains unchanged
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

        # Additional log about number of classes in schedule
        app.logger.info(f'SCHEDULE DATA: {user["full_name"]} received {len(schedule)} classes for {display_date}')

        return jsonify(schedule)

    except Exception as e:
        app.logger.error(f'Error getting schedule for user {user_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()


@app.route('/api/groups', methods=['GET'])
def get_groups():
    """Get list of all groups"""
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
    """Get list of all teachers"""
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
    """Get all groups for a teacher"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get teacher data
        cursor.execute('SELECT teacher_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or user['user_type'] != 'teacher':
            return jsonify({'error': 'Access denied'}), 403

        # Get all teacher's groups from the schedule
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


# ============================================================
# USER PROFILE ROUTES
# ============================================================

@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile(user_id):
    """Get user profile"""
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


@app.route('/api/profile/details', methods=['GET'])
@require_auth
def get_profile_details(user_id):
    """Get detailed user profile information"""
    try:
        conn = get_db()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Use CONVERT for proper encoding
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

        # Get statistics
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

        # Add statistics to user details
        if stats:
            user_details.update(stats)

        return jsonify(user_details)

    except Exception as e:
        print(f"Profile details error: {str(e)}")
        return jsonify({'error': str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()


@app.route('/api/teachers/my', methods=['GET'])
@require_auth
def get_my_teachers(user_id):
    """Get teachers for a student"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        app.logger.info(f'Getting teachers for student_id: {user_id}')

        # Get student's group
        cursor.execute('SELECT group_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        app.logger.info(f'Found user: {user}')

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user['user_type'] != 'student':
            return jsonify({'error': 'Only students can view teachers'}), 403

        if not user['group_name']:
            return jsonify({'error': 'Student group not found'}), 404

        # Get teachers who teach this group
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
    """Get students for a teacher"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get teacher's name
        cursor.execute('SELECT teacher_name, user_type FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or user['user_type'] != 'teacher':
            return jsonify({'error': 'Access denied'}), 403

        # Get collation of teacher_name column from schedule table
        cursor.execute(
            "SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'schedule' AND COLUMN_NAME = 'teacher_name'")
        result = cursor.fetchone()
        teacher_name_collation = result['COLLATION_NAME'] if result else 'utf8mb4_0900_ai_ci'  # Default if not found

        # Get all students from groups taught by this teacher (all time)
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


# ============================================================
# LOGS VIEWING ROUTE
# ============================================================

@app.route('/logs', methods=['GET'])
def view_logs():
    """View application logs with filtering options"""
    lines = request.args.get('lines', default=100, type=int)
    format_type = request.args.get('format', default='html', type=str)
    filter_text = request.args.get('filter', default=None, type=str)
    log_level = request.args.get('level', default=None, type=str)
    start_date = request.args.get('start_date', default=None, type=str)
    end_date = request.args.get('end_date', default=None, type=str)

    # Download raw log file
    if format_type == 'raw':
        log_path = os.path.join('logs', app.config['LOG_FILENAME'])
        if os.path.exists(log_path):
            return send_file(log_path, mimetype='text/plain')
        return jsonify({'error': 'Log file not found'}), 404

    # For JSON format
    if format_type == 'json':
        logs = read_logs(lines, filter_text, log_level, start_date, end_date)
        return jsonify(logs)

    # Default: HTML format
    logs = read_logs(lines, filter_text, log_level, start_date, end_date)

    # Calculate statistics
    stats = {
        'total': len(logs),
        'info': sum(1 for log in logs if 'INFO' in log and 'ERROR' not in log and 'WARNING' not in log),
        'warning': sum(1 for log in logs if 'WARNING' in log and 'ERROR' not in log),
        'error': sum(1 for log in logs if 'ERROR' in log)
    }

    # Format logs for displaying user names
    for i, log in enumerate(logs):
        if "SCHEDULE REQUESTED" in log:
            logs[i] = log.replace("SCHEDULE REQUESTED", "<strong>ПРОСМОТР РАСПИСАНИЯ</strong>")

    current_time = datetime.now().strftime("%d.%m.%Y %H:%M:%S")

    # HTML template for viewing logs (long template omitted for brevity)
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>User Activity Log</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* CSS styles omitted for brevity */
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f0f2f5; }
            .container { max-width: 1300px; margin: 0 auto; background-color: white; padding: 25px; border-radius: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
            .logs { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; font-family: monospace; white-space: pre-wrap; overflow-x: auto; max-height: 70vh; overflow-y: auto; }
            .log-line { margin: 8px 0; padding: 10px; border-bottom: 1px solid #eaeaea; border-radius: 4px; }
            .error { color: #e74c3c; font-weight: bold; background-color: #fdeaea; border-left: 5px solid #e74c3c; }
            .warning { color: #e67e22; background-color: #fef5ea; border-left: 5px solid #e67e22; }
            .info { color: #2980b9; background-color: #f0f7fc; border-left: 5px solid #2980b9; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>User Activity Log</h1>

            <!-- Stats -->
            <div class="stat-box">
                <div class="stat-item">
                    <div class="count">{{ stats.total }}</div>
                    <div class="label">Total entries</div>
                </div>
                <div class="stat-item">
                    <div class="count info-stat">{{ stats.info }}</div>
                    <div class="label">Information</div>
                </div>
                <div class="stat-item">
                    <div class="count warning-stat">{{ stats.warning }}</div>
                    <div class="label">Warnings</div>
                </div>
                <div class="stat-item">
                    <div class="count error-stat">{{ stats.error }}</div>
                    <div class="label">Errors</div>
                </div>
            </div>

            <!-- Controls and filters omitted for brevity -->

            <!-- Log display -->
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
            // JavaScript omitted for brevity
        </script>
    </body>
    </html>
    """

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


# ============================================================
# ADMIN ROUTES
# ============================================================

@app.route('/api/admin/dashboard/stats', methods=['GET'])
@require_admin
def admin_dashboard_stats(admin_id):
    """Get admin dashboard statistics"""
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

        stats = {
            'totalStudents': students_count,
            'totalTeachers': teachers_count,
            'totalCourses': courses_count,
            'totalLessons': lessons_count
        }

        # Log admin action
        log_admin_activity(admin_id, "viewed dashboard statistics")

        return jsonify(stats)

    except Exception as e:
        app.logger.error(f'Admin dashboard stats error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/activity-log', methods=['GET'])
@require_admin
def admin_activity_log(admin_id):
    """Get admin activity log"""
    limit = int(request.args.get('limit', 10))
    offset = int(request.args.get('offset', 0))
    conn = get_db()
    cursor = conn.cursor()

    try:
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


@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_get_users(admin_id):
    """Get all users with filtering and pagination"""
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
        log_admin_activity(admin_id, "viewed user list",
                           f"Found {len(users)} users")

        return jsonify(users)

    except Exception as e:
        app.logger.error(f'Admin get users error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
@require_admin
def admin_get_user(admin_id, user_id):
    """Get a single user by ID"""
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
        log_admin_activity(admin_id, "viewed user",
                           f"ID: {user_id}, Email: {user['email']}")

        return jsonify(user)

    except Exception as e:
        app.logger.error(f'Admin get user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users', methods=['POST'])
@require_admin
def admin_create_user(admin_id):
    """Create a new user"""
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
        log_admin_activity(admin_id, "created user",
                           f"ID: {user_id}, Email: {data['email']}, Type: {data['userType']}")

        return jsonify(user)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin create user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@require_admin
def admin_update_user(admin_id, user_id):
    """Update a user"""
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
        log_admin_activity(admin_id, "updated user",
                           f"ID: {user_id}, Changes: {field_changes}")

        return jsonify(updated_user)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin update user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_admin
def admin_delete_user(admin_id, user_id):
    """Delete a user"""
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
        log_admin_activity(admin_id, "deleted user",
                           f"ID: {user_id}, Email: {user['email']}, Name: {user['full_name']}")

        return jsonify({'success': True, 'message': 'User deleted successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin delete user error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedules', methods=['GET'])
@require_admin
def admin_get_schedules(admin_id):
    """Get all schedules with filtering"""
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
        filter_desc = f"Filters: " + ", ".join([
            f"date={date}" if date else "",
            f"from {date_from} to {date_to}" if date_from and date_to else "",
            f"search={search}" if search else ""
        ]).strip(", ")

        log_admin_activity(admin_id, "viewed schedule",
                           f"Found {len(schedules)} entries. {filter_desc}")

        return jsonify(schedules)

    except Exception as e:
        app.logger.error(f'Admin get schedules error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule/<int:schedule_id>', methods=['GET'])
@require_admin
def admin_get_schedule(admin_id, schedule_id):
    """Get a single schedule item"""
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
        log_admin_activity(admin_id, "viewed schedule entry",
                           f"ID: {schedule_id}, Subject: {schedule['subject']}")

        return jsonify(schedule)

    except Exception as e:
        app.logger.error(f'Admin get schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule', methods=['POST'])
@require_admin
def admin_create_schedule(admin_id):
    """Create a new schedule item"""
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
        log_admin_activity(admin_id, "created schedule entry",
                           f"ID: {schedule_id}, Subject: {data['subject']}, Group: {data['group_name']}")

        return jsonify(schedule)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin create schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule/<int:schedule_id>', methods=['PUT'])
@require_admin
def admin_update_schedule(admin_id, schedule_id):
    """Update a schedule item"""
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
        log_admin_activity(admin_id, "updated schedule entry",
                           f"ID: {schedule_id}, Changes: {field_changes}")

        return jsonify(updated_schedule)

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin update schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/schedule/<int:schedule_id>', methods=['DELETE'])
@require_admin
def admin_delete_schedule(admin_id, schedule_id):
    """Delete a schedule item"""
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
        log_admin_activity(admin_id, "deleted schedule entry",
                           f"ID: {schedule_id}, Subject: {schedule['subject']}, Group: {schedule['group_name']}")

        return jsonify({'success': True, 'message': 'Schedule deleted successfully'})

    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin delete schedule error: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        conn.close()


@app.route('/api/admin/analytics/users', methods=['GET'])
@require_admin
def admin_analytics_users(admin_id):
    """Get user analytics for admin dashboard"""
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
        log_admin_activity(admin_id, "viewed user analytics",
                           "Registration statistics and type distribution")

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
    """Get schedule analytics for admin dashboard"""
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
        log_admin_activity(admin_id, "viewed schedule analytics",
                           "Schedule distribution statistics")

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


# ============================================================
# SERVER STARTUP
# ============================================================

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)