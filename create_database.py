import json
import sqlite3
import os

def create_quiz_db():
    # Check if database already exists
    if os.path.exists('quiz_questions.db'):
        print("Database already exists. Do you want to recreate it? (y/n)")
        response = input().strip().lower()
        if response != 'y':
            print("Database creation skipped.")
            return

    # Connect to database
    conn = sqlite3.connect('quiz_questions.db')
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS quiz_questions (
        id INTEGER PRIMARY KEY,
        question TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        wrong1 TEXT NOT NULL,
        wrong2 TEXT NOT NULL,
        wrong3 TEXT NOT NULL,
        category TEXT NOT NULL
    )
    ''')
    
    # Read JSON data with utf-8 encoding
    try:
        with open('questions.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except UnicodeDecodeError:
        # Try different encodings if utf-8 fails
        try:
            with open('questions.json', 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
        except UnicodeDecodeError:
            # Last resort - try to read as binary and replace problematic characters
            with open('questions.json', 'rb') as f:
                content = f.read()
                # Replace or strip non-utf8 characters
                content = content.decode('utf-8', errors='replace')
                data = json.loads(content)
    
    # Process questions
    for q in data['quiz_questions']:
        question = q['question']
        category = q['category']
        options = q['options']
        
        # The first option will be treated as the correct one
        correct_answer = options[0]
        
        # Rest of the options are wrong answers
        wrong_answers = options[1:4] if len(options) >= 4 else (options[1:] + [''] * (3 - len(options) + 1))
        
        # Check if this question already exists
        cursor.execute('SELECT id FROM quiz_questions WHERE id = ?', (q['id'],))
        if cursor.fetchone() is None:
            # Insert question
            cursor.execute('''
            INSERT INTO quiz_questions (id, question, correct_answer, wrong1, wrong2, wrong3, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (q['id'], question, correct_answer, wrong_answers[0], wrong_answers[1], wrong_answers[2], category))
    
    # Also create required tables for head-to-head and single player
    # Create head-to-head tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS head_to_head_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_name TEXT NOT NULL,
        player2_name TEXT NOT NULL,
        winner_name TEXT,
        date TEXT NOT NULL,
        player1_score INTEGER,
        player2_score INTEGER
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS head_to_head_stats (
        player_name TEXT PRIMARY KEY,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        games_lost INTEGER DEFAULT 0,
        games_tied INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        highest_score INTEGER DEFAULT 0
    )
    ''')
    
    # Create leaderboard table for single player
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        date TEXT NOT NULL,
        questions_answered INTEGER,
        correct_answers INTEGER,
        accuracy REAL
    )
    ''')
    
    # Create player_stats table for single player personal statistics
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS player_stats (
        player_name TEXT PRIMARY KEY,
        games_played INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        highest_score INTEGER DEFAULT 0,
        total_questions_answered INTEGER DEFAULT 0,
        total_correct_answers INTEGER DEFAULT 0,
        total_game_duration REAL DEFAULT 0,
        average_score REAL DEFAULT 0,
        average_accuracy REAL DEFAULT 0,
        last_played_date TEXT
    )
    ''')
    
    # Commit and close
    conn.commit()
    conn.close()
    print("Database created and populated successfully!")

if __name__ == "__main__":
    create_quiz_db()