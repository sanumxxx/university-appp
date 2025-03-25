import pymysql


def run_migration():
    """Direct database connection to add the updated_at column"""
    # Connect directly to the database
    connection = pymysql.connect(
        host='147.45.153.76',
        user='sanumxxx',
        password='Yandex200515_',
        database='timetable',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

    try:
        with connection.cursor() as cursor:
            # Check if column already exists to avoid errors
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM information_schema.columns 
                WHERE table_schema = 'timetable'
                AND table_name = 'users' 
                AND column_name = 'updated_at'
            """)
            result = cursor.fetchone()

            if result['count'] == 0:
                # Column doesn't exist, create it with CURRENT_TIMESTAMP default and auto update
                cursor.execute("""
                    ALTER TABLE users
                    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                """)
                print("Migration completed: Added 'updated_at' column to users table")
            else:
                print("Column 'updated_at' already exists in users table")

        # Commit the changes
        connection.commit()

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        connection.close()


if __name__ == '__main__':
    run_migration()