import sqlite3
import os

# Construct the absolute path to the database file
DATABASE_NAME = 'quiz_questions.db'
# Assuming this script is in the 'backend' directory, and the DB is one level up
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, '..', DATABASE_NAME)

def create_users_table():
    """Creates the users table in the database if it doesn't exist."""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # SQL to create the users table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL, -- Changed from email, still unique and not null
            password_hash TEXT NOT NULL,
            best_singleplayer_score INTEGER DEFAULT 0,
            head_to_head_wins INTEGER DEFAULT 0,
            multiplayer_wins INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        cursor.execute(create_table_sql)
        conn.commit()
        print("Users table created or already exists.")

    except sqlite3.Error as e:
        print(f"Database error during table creation: {e}")
    finally:
        if conn:
            conn.close()

def clear_users_table():
    """Deletes all records from the users table."""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users;")
        conn.commit()
        print("All records deleted from users table.")
    except sqlite3.Error as e:
        print(f"Database error during table clearing: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    print(f"Attempting to create 'users' table in database: {DATABASE_PATH}")
    create_users_table()
    clear_users_table() # Clear the table after ensuring it exists
    # You can add other setup functions here if needed
    print("Database setup script finished.")
