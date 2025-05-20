# Patched version of server_backend.py with the fixed load_questions function
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import random
import time
import threading
from datetime import datetime, timedelta
import json
import sqlite3
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import os
from dotenv import load_dotenv
from functools import wraps

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-default-flask-secret-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-default-jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

socketio = SocketIO(app, cors_allowed_origins="*")

DB_PATH = 'c:\\\\Users\\\\yotam\\\\OneDrive\\\\Documents\\\\Recihmann\\\\Computer_Science_Yr_2\\\\Sem_2\\\\Idea_To_App\\\\Assignment3\\\\Exercise2\\\\quiz_questions.sqlite'

active_rooms = {}
player_sessions = {}

def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'status': 'error', 'message': 'Bearer token malformed'}), 401

        if not token:
            return jsonify({'status': 'error', 'message': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (data['user_id'],))
            current_user = cursor.fetchone()
            conn.close()
            if not current_user:
                return jsonify({'status': 'error', 'message': 'Token invalid, user not found'}), 401
            
            kwargs['current_user'] = { 'user_id': current_user['id'], 'username': current_user['username'], 'email': current_user['email'] }

        except jwt.ExpiredSignatureError:
            return jsonify({'status': 'error', 'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'status': 'error', 'message': 'Token is invalid'}), 401
        except Exception as e:
            return jsonify({'status': 'error', 'message': f'Token processing error: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            option1 TEXT NOT NULL,
            option2 TEXT NOT NULL,
            option3 TEXT NOT NULL,
            option4 TEXT NOT NULL,
            answer TEXT NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT DEFAULT 'medium' 
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS player_profiles (
            user_id INTEGER PRIMARY KEY,
            games_played INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0,
            total_score INTEGER DEFAULT 0,
            avatar_url TEXT,
            bio TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
    """)
    conn.commit()
    conn.close()

def load_questions(category_filter='all', limit=30):
    """Load questions from database as standalone function for SinglePlayerGame"""
    conn = None
    try:
        db_path = DB_PATH
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Updated query to use quiz_questions table with its actual column names
        query = "SELECT id, question, correct_answer, wrong1, wrong2, wrong3, category FROM quiz_questions"
        params = []

        if category_filter != 'all':
            query += " WHERE category = ?"
            params.append(category_filter)
        
        query += " ORDER BY RANDOM() LIMIT ?"
        params.append(limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        loaded_questions = []
        for row in rows:
            # Transform data to match expected format
            options = [row['correct_answer'], row['wrong1'], row['wrong2'], row['wrong3']]
            random.shuffle(options)  # Shuffle options to randomize correct answer position
            
            question_data = {
                'id': row['id'],
                'question': row['question'],
                'options': options,
                'correct_answer': row['correct_answer'],  # This is what SinglePlayerGame expects
                'answer': row['correct_answer'],  # This is what GameRoom expects
                'category': row['category']
            }
            loaded_questions.append(question_data)
        
        if not loaded_questions:
            print(f"Warning: No questions found for category '{category_filter}' with limit {limit}.")

        return loaded_questions

    except sqlite3.Error as e:
        print(f"Database error while loading questions: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred while loading questions: {e}")
        return []
    finally:
        if conn:
            conn.close()

def update_player_stats_in_db(user_id, game_score, is_winner):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE player_profiles
            SET games_played = games_played + 1,
                total_score = total_score + ?
            WHERE user_id = ?
        """, (game_score, user_id))

        if is_winner:
            cursor.execute("""
                UPDATE player_profiles
                SET wins = wins + 1
                WHERE user_id = ?
            """, (user_id,))
        
        conn.commit()
        print(f"Stats updated for user_id {user_id}: score_added={game_score}, won={is_winner}")
    except sqlite3.Error as e:
        print(f"DB error updating stats for user_id {user_id}: {e}")
        conn.rollback()
    finally:
        conn.close()

# Note: The duplicate load_questions function is removed
