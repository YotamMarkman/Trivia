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

DB_PATH = 'c:\\\\Users\\\\yotam\\\\OneDrive\\\\Documents\\\\Recihmann\\\\Computer_Science_Yr_2\\\\Sem_2\\\\Idea_To_App\\\\Assignment3\\\\Exercise2\\\\quiz_questions.db'

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

class Player:
    def __init__(self, session_id, name, user_id=None, is_authenticated=False):
        self.session_id = session_id
        self.name = name 
        self.user_id = user_id
        self.is_authenticated = is_authenticated
        self.score = 0
        self.current_answer = None
        self.answered = False
        self.connected = True
        self.timetaken = 0
        self.correct_streak = 0
        self.muted_by_me = set()
        
    def to_dict(self):
        self_dict = {
            'session_id': self.session_id,
            'name': self.name,
            'user_id': self.user_id,
            'is_authenticated': self.is_authenticated,
            'score': self.score,
            'answered': self.answered,
            'connected': self.connected,
            'muted_by_me': list(self.muted_by_me)
        }
        return self_dict
    
    def reset_answer(self):
        self.current_answer = None
        self.answered = False
        
    def submit_answer(self, answer):
        if not self.answered:
            self.current_answer = answer
            self.answered = True
            return True
        return False

class BotPlayer(Player):
    def __init__(self, session_id, name, difficulty="medium"):
        super().__init__(session_id, name)
        self.is_bot = True
        self.difficulty = difficulty
        if self.difficulty == "easy":
            self.accuracy = 0.4
            self.min_response_time = 3.0
            self.max_response_time = 7.0
        elif self.difficulty == "hard":
            self.accuracy = 0.9
            self.min_response_time = 0.5
            self.max_response_time = 2.0
        else:
            self.accuracy = 0.7
            self.min_response_time = 1.5
            self.max_response_time = 4.0
        self.avatar = f"/avatars/bot_{name.lower().replace(' ', '_')}.png"

    def to_dict(self):
        player_dict = super().to_dict()
        player_dict['is_bot'] = True
        player_dict['avatar'] = self.avatar
        return player_dict

    def choose_answer(self, question_options, correct_answer_value):
        response_time = random.uniform(self.min_response_time, self.max_response_time)
        if random.random() < self.accuracy:
            chosen_answer = correct_answer_value
        else:
            incorrect_options = [opt for opt in question_options if opt != correct_answer_value]
            if incorrect_options:
                chosen_answer = random.choice(incorrect_options)
            else:
                chosen_answer = random.choice(question_options)
        return chosen_answer, response_time

class GameRoom:
    def __init__(self, room_id, host_id, num_questions=15, category='all', max_players=8):
        self.room_id = room_id
        self.host_id = host_id
        self.question_duration = 15
        self.max_players = max_players
        self.num_questions = num_questions
        self.timer_thread = None
        self.time_remaining = 0
        self.game_state = "waiting"
        self.current_question_index = -1
        self.players = {}
        self.questions = []
        self.marked_for_deletion = False
        self.category_choosen = category
        self.answer_revealed_for_current_question = False
        self.bot_id_counter = 0
        self.bot_names_pool = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"]
        random.shuffle(self.bot_names_pool)
        self.bot_difficulties = ["easy", "medium", "hard"]
        self.questions = [] 

    def load_questions(self, category_filter):
        conn = None
        try:
            db_path = DB_PATH
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = "SELECT id, question, option1, option2, option3, option4, answer, category FROM questions"
            params = []

            if category_filter != 'all':
                query += " WHERE category = ?"
                params.append(category_filter)
            
            query += " ORDER BY RANDOM() LIMIT ?"
            params.append(self.num_questions)

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

            loaded_questions = []
            for row in rows:
                question_data = {
                    'id': row['id'],
                    'question': row['question'],
                    'options': [row['option1'], row['option2'], row['option3'], row['option4']],
                    'answer': row['answer'],
                    'category': row['category']
                }
                loaded_questions.append(question_data)
            
            if not loaded_questions:
                print(f"Warning: No questions found for category '{category_filter}' with limit {self.num_questions}.")

            return loaded_questions

        except sqlite3.Error as e:
            print(f"Database error while loading questions: {e}")
            emit('error', {'message': f'Database error: {e}'}, room=self.host_id)
            return []
        except Exception as e:
            print(f"An unexpected error occurred while loading questions: {e}")
            emit('error', {'message': f'Unexpected error loading questions: {e}'}, room=self.host_id)
            return []
        finally:
            if conn:
                conn.close()
    
    def add_player(self, player_obj):
        if len(self.players) >= self.max_players:
            emit('error', {'message': 'Room is full.'}, room=player_obj.session_id)
            return False
    
        if player_obj.session_id in self.players:
            emit('error', {'message': 'Player already in this room.'}, room=player_obj.session_id)
            return False
    
        self.players[player_obj.session_id] = player_obj
    
        session_id = player_obj.session_id
        if session_id in player_sessions:
            player_sessions[session_id]['room_id'] = self.room_id
        else:
            print(f"Warning: Player {session_id} added to room {self.room_id} without existing player_sessions entry.")
            player_sessions[session_id] = {
                'sid': session_id,
                'username': player_obj.name,
                'is_authenticated': player_obj.is_authenticated,
                'user_id': player_obj.user_id,
                'room_id': self.room_id,
            }
        
        print(f"Player {player_obj.name} (SID: {session_id}) added to room {self.room_id}. Total players: {len(self.players)}")
        return True
    
    def remove_player(self, session_id):
        if session_id not in self.players:
            print(f"Attempted to remove non-existent player {session_id} from room {self.room_id}")
            return False
        
        player_being_removed = self.players.pop(session_id)
        print(f"Player {player_being_removed.name} (SID: {session_id}) removed from room {self.room_id}. Players left: {len(self.players)}")
        
        if session_id in player_sessions:
            if player_sessions[session_id].get('room_id') == self.room_id:
                player_sessions[session_id].pop('room_id', None)
        
        was_host = (self.host_id == session_id)
        if was_host:
            if self.players:
                new_host = next(iter(self.players.values()))
                self.host_id = new_host.session_id
                emit('new_host', {'host_id': new_host.session_id}, room=self.room_id)
            else:
                self.host_id = None
        
        if len(self.players) == 0:
            self.marked_for_deletion = True
        
        return True
    
    def start_game(self, fill_with_bots=True, default_bot_difficulty=None):
        if self.game_state != "waiting":
            print(f"Room {self.room_id}: Game already started or finished.")
            emit('error', {'message': 'Game already started or finished.'}, room=self.host_id)
            return False

        MIN_GAME_PARTICIPANTS = 1

        num_humans = len([p for p in self.players.values() if not getattr(p, 'is_bot', False)])

        if num_humans == 0:
            print(f"Room {self.room_id}: No human players to start the game.")
            emit('error', {'message': 'Cannot start game without human players.'}, room=self.host_id)
            return False 

        if fill_with_bots:
            bots_to_add = self.max_players - len(self.players)
            if bots_to_add > 0:
                log_difficulty_message = default_bot_difficulty if default_bot_difficulty and default_bot_difficulty in self.bot_difficulties else "Random"
                print(f"Room {self.room_id}: Filling {bots_to_add} empty slots with bots. Host specified difficulty: {log_difficulty_message}")
                
                for i in range(bots_to_add):
                    if len(self.players) >= self.max_players:
                        break
                    bot_id = f"bot_{uuid.uuid4().hex[:6]}"
                    bot_name = random.choice([
                        "RoboQuizzer", "AI Master", "BotBrain", "DataDude", 
                        "LogicLeaper", "QueryBot", "SiliconSage", "SmartyBot"
                    ])
                    
                    bot_difficulty_to_assign = default_bot_difficulty
                    if not bot_difficulty_to_assign or bot_difficulty_to_assign not in self.bot_difficulties:
                        bot_difficulty_to_assign = random.choice(self.bot_difficulties)
                    
                    bot_player = BotPlayer(bot_id, bot_name, difficulty=bot_difficulty_to_assign)
                    self.add_player(bot_player)
        
        if len(self.players) < MIN_GAME_PARTICIPANTS:
            print(f"Room {self.room_id}: Not enough total participants ({len(self.players)}) to start.")
            emit('error', {'message': f'Not enough players to start. Need at least {MIN_GAME_PARTICIPANTS}.'}, room=self.host_id)
            return False
        
        self.game_state = "playing"
        self.current_question_index = -1
        
        self.questions = self.load_questions(self.category_choosen) 
        
        if not self.questions:
            print(f"Room {self.room_id}: No questions loaded, cannot start game.")
            self.game_state = "waiting"
            emit('error', {'message': 'Failed to load questions for the game.'}, room=self.host_id)
            return False

        for player in self.players.values():
            player.score = 0
            player.correct_streak = 0
            player.reset_answer()
            if not hasattr(player, 'muted_by_me'):
                player.muted_by_me = set()

        print(f"Room {self.room_id}: Game starting with {len(self.players)} players. Max players: {self.max_players}. Fill with bots: {fill_with_bots}")
        self.send_current_question()
        return True

    def send_current_question(self):
        self.current_question_index += 1
        
        if self.current_question_index < len(self.questions):
            question_to_send = self.questions[self.current_question_index]
            
            for player in self.players.values():
                player.reset_answer() 

            self.answer_revealed_for_current_question = False
            self.time_remaining = self.question_duration 

            socketio.emit('new_question', {
                'room_id': self.room_id,
                'question_index': self.current_question_index,
                'total_questions': len(self.questions),
                'question_text': question_to_send['question'],
                'options': question_to_send['options'],
                'category': question_to_send['category'],
                'duration': self.question_duration
            }, room=self.room_id)
            print(f"Room {self.room_id}: Sent question {self.current_question_index + 1}/{len(self.questions)}")
            self.start_question_timer()
        else:
            if self.game_state != "finished":
                 print(f"Room {self.room_id}: No more questions to send. Game should have been finalized.")

    def start_question_timer(self):
        if self.timer_thread and self.timer_thread.is_alive():
            self.timer_thread.cancel()

        self.time_remaining = self.question_duration
        
        def timer_tick():
            if self.game_state != "playing" or self.answer_revealed_for_current_question:
                return

            if self.time_remaining > 0:
                socketio.emit('timer_update', {'room_id': self.room_id, 'time_remaining': self.time_remaining}, room=self.room_id)
                self.time_remaining -= 1
                self.timer_thread = threading.Timer(1, timer_tick)
                self.timer_thread.start()
            else:
                socketio.emit('timer_update', {'room_id': self.room_id, 'time_remaining': 0}, room=self.room_id)
                print(f"Room {self.room_id}: Question timer expired for question {self.current_question_index + 1}.")
                if not self.answer_revealed_for_current_question:
                    self._process_answers_and_reveal()
            
        self.timer_thread = threading.Timer(1, timer_tick)
        self.timer_thread.start()

    def _process_answers_and_reveal(self):
        if self.answer_revealed_for_current_question or self.game_state != "playing":
            return

        self.answer_revealed_for_current_question = True
        if self.timer_thread and self.timer_thread.is_alive():
            self.timer_thread.cancel()

        if self.current_question_index < 0 or self.current_question_index >= len(self.questions):
            print(f"Room {self.room_id}: Invalid current_question_index ({self.current_question_index}) in _process_answers_and_reveal.")
            if self.game_state != "finished": self._finalize_game_and_update_stats()
            return

        current_q_data = self.questions[self.current_question_index]
        correct_answer_text = current_q_data['answer']
        question_options = current_q_data['options']

        # Bot Answering Logic
        for p_sid, player_obj in self.players.items():
            if getattr(player_obj, 'is_bot', False) and not player_obj.answered:
                chosen_answer, _ = player_obj.choose_answer(question_options, correct_answer_text)
                player_obj.submit_answer(chosen_answer)
                print(f"Room {self.room_id}: Bot {player_obj.name} chose answer: {chosen_answer}")
        
        round_results = []
        for p_sid, player_obj in self.players.items():
            is_correct = False
            points_earned_this_round = 0
            if player_obj.answered and player_obj.current_answer == correct_answer_text:
                is_correct = True
                points_earned_this_round = 10
                player_obj.score += points_earned_this_round 
                player_obj.correct_streak += 1
            else:
                player_obj.correct_streak = 0
            
            round_results.append({
                'session_id': p_sid, 'name': player_obj.name,
                'answered': player_obj.answered, 'answer_given': player_obj.current_answer,
                'is_correct': is_correct, 'points_earned': points_earned_this_round,
                'current_total_score': player_obj.score, 'correct_streak': player_obj.correct_streak
            })

        socketio.emit('question_result', {
            'room_id': self.room_id, 'question_index': self.current_question_index,
            'correct_answer': correct_answer_text, 'results': round_results,
            'scores': [p.to_dict() for p in self.players.values()]
        }, room=self.room_id)
        print(f"Room {self.room_id}: Revealed answer for Q{self.current_question_index + 1}. Correct: {correct_answer_text}")

        threading.Timer(3.0, self._advance_to_next_stage_or_end_game).start()

    def _advance_to_next_stage_or_end_game(self):
        if self.game_state != "playing":
            return

        if self.current_question_index < len(self.questions) - 1:
            self.send_current_question() 
        else:
            print(f"Room {self.room_id}: All questions processed. Finalizing game.")
            self._finalize_game_and_update_stats()

    def _finalize_game_and_update_stats(self):
        if self.game_state == "finished":
            return
        self.game_state = "finished"
        print(f"Room {self.room_id}: Game finished. Finalizing stats.")

        if self.timer_thread and self.timer_thread.is_alive():
            self.timer_thread.cancel()

        human_players_in_game = [p for p in self.players.values() if not getattr(p, 'is_bot', False) and p.is_authenticated and p.user_id is not None]
        
        winners = []
        if human_players_in_game:
            max_score = -1 
            for player in human_players_in_game:
                if player.score > max_score:
                    max_score = player.score
            
            if max_score > -1:
                winners = [p for p in human_players_in_game if p.score == max_score]

        winner_user_ids = [p.user_id for p in winners]

        for player in self.players.values():
            if player.is_authenticated and player.user_id is not None:
                is_winner = player.user_id in winner_user_ids
                update_player_stats_in_db(player.user_id, player.score, is_winner)

        final_scores_list = []
        for p_obj in self.players.values():
            final_scores_list.append({
                'session_id': p_obj.session_id, 'name': p_obj.name, 'score': p_obj.score,
                'is_bot': getattr(p_obj, 'is_bot', False),
                'is_winner': p_obj.session_id in [w.session_id for w in winners]
            })
        final_scores_list.sort(key=lambda x: x['score'], reverse=True)

        game_over_data = {
            'room_id': self.room_id, 'game_state': self.game_state,
            'final_scores': final_scores_list,
            'winners': [{'session_id': w.session_id, 'name': w.name, 'user_id': w.user_id} for w in winners]
        }
        socketio.emit('game_over', game_over_data, room=self.room_id)
        print(f"Room {self.room_id}: Emitted 'game_over'. Winners: {[w.name for w in winners]}")

@socketio.on('connect')
def handle_connect():
    session_id = request.sid
    auth_args = request.args
    token = auth_args.get('token') if auth_args else None
    
    session_info = {
        'sid': session_id,
        'username': f"Guest_{session_id[:6]}",
        'is_authenticated': False,
        'user_id': None
    }

    if token:
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            user_id = data['user_id']
            username = data['username']
            print(f"Socket.IO: User {username} (ID: {user_id}, SID: {session_id}) authenticated via JWT.")
            session_info.update({
                'user_id': user_id,
                'username': username,
                'is_authenticated': True
            })
        except jwt.ExpiredSignatureError:
            print(f"Socket.IO: JWT token expired for SID {session_id}. Connecting as guest.")
        except jwt.InvalidTokenError:
            print(f"Socket.IO: Invalid JWT token for SID {session_id}. Connecting as guest.")
        except Exception as e:
            print(f"Socket.IO: Error during token verification for SID {session_id}: {str(e)}. Connecting as guest.")
    else:
        print(f"Socket.IO: SID {session_id} connected as guest (no token provided).")

    player_sessions[session_id] = session_info
    print(f"Socket.IO: Session established for SID {session_id}: Auth={session_info['is_authenticated']}, User={session_info['username']}")
    
    emit('connection_ack', {
        'sid': session_id, 
        'is_authenticated': session_info['is_authenticated'], 
        'username': session_info['username'],
        'user_id': session_info['user_id']
    })

@socketio.on('disconnect')
def handle_disconnect():
    session_id = request.sid
    print(f"Socket.IO: Client disconnected (SID: {session_id}).")

    if session_id in player_sessions:
        session_data_for_sid = player_sessions[session_id]
        room_id = session_data_for_sid.get('room_id')

        if room_id and room_id in active_rooms:
            room = active_rooms[room_id]
            if session_id in room.players: 
                player_name = room.players[session_id].name
                print(f"Socket.IO: Removing player {player_name} (SID: {session_id}) from room {room_id} due to disconnect.")
                
                room.remove_player(session_id)
                
                emit('player_left', {'session_id': session_id, 'name': player_name, 'room_id': room_id}, room=room_id)
                
                if room_id in active_rooms:
                     room_state_for_client = {
                         'id': room.room_id,
                         'host_id': room.host_id,
                         'players': [p.to_dict() for p in room.players.values()],
                         'game_state': room.game_state,
                         'max_players': room.max_players,
                         'category': room.category_choosen
                     }
                     emit('room_update', room_state_for_client, room=room_id)
                
                if room.marked_for_deletion and not room.players:
                    print(f"Socket.IO: Deleting empty room {room_id} after player {session_id} disconnected and was removed.")
                    del active_rooms[room_id]
            else:
                print(f"Socket.IO: Info - SID {session_id} was in player_sessions with room_id {room_id}, but not in that room's active player list (already removed or inconsistency).")
        
        del player_sessions[session_id]
        print(f"Socket.IO: Cleaned up player_sessions for SID {session_id}. Remaining sessions: {len(player_sessions)}")
    else:
        print(f"Socket.IO: Disconnected SID {session_id} not found in player_sessions (already cleaned or never fully registered).")

@socketio.on('submit_answer')
def handle_submit_answer(data):
    session_id = request.sid
    if session_id not in player_sessions:
        emit('error', {'message': 'Player session not found.'})
        return

    player_session_data = player_sessions[session_id]
    room_id = player_session_data.get('room_id')
    
    if not room_id or room_id not in active_rooms:
        emit('error', {'message': 'Not in an active room or room not found.'})
        return

    room = active_rooms[room_id]
    if room.game_state != "playing" or room.answer_revealed_for_current_question:
        print(f"Player {session_id} tried to answer when game not active or answer revealed.")
        return

    if session_id not in room.players:
        emit('error', {'message': 'Player not found in this game room.'})
        return
        
    player = room.players[session_id]
    answer = data.get('answer')

    if player.submit_answer(answer):
        print(f"Room {room.room_id}: Player {player.name} submitted answer: {answer}")
        emit('answer_accepted', {'session_id': session_id, 'answer': answer}, room=session_id)
        emit('player_answered_update', {'session_id': session_id, 'name': player.name, 'answered': True}, room=room.room_id)

        all_humans_answered = True
        active_human_players = [p for p in room.players.values() if not getattr(p, 'is_bot', False) and p.connected]
        
        if not active_human_players:
             pass
        else:
            for p_obj in active_human_players:
                if not p_obj.answered:
                    all_humans_answered = False
                    break
            
            if all_humans_answered:
                print(f"Room {room.room_id}: All active human players answered. Processing early.")
                if room.timer_thread and room.timer_thread.is_alive():
                    room.timer_thread.cancel()
                room._process_answers_and_reveal()
    else:
        print(f"Player {session_id} tried to submit answer again or invalidly.")

@socketio.on('start_game')
def handle_start_game(data):
    session_id = request.sid
    fill_with_bots = data.get('fill_with_bots', True) 
    default_bot_difficulty = data.get('default_bot_difficulty')

    if session_id not in player_sessions or not player_sessions[session_id]['room_id']:
        emit('error', {'message': 'Not in a room'})
        return
    
    room_id = player_sessions[session_id]['room_id']
    
    if room_id not in active_rooms:
        emit('error', {'message': 'Room not found'})
        return
    
    room = active_rooms[room_id]
    
    if room.host_id != session_id:
        emit('error', {'message': 'Only host can start the game'})
        return

    MIN_HUMANS_IF_NO_BOTS = 1 

    if not fill_with_bots:
        current_human_players = len([p for p in room.players.values() if not getattr(p, 'is_bot', False)])
        if current_human_players < MIN_HUMANS_IF_NO_BOTS:
            emit('error', {'message': f'Need at least {MIN_HUMANS_IF_NO_BOTS} human player(s) to start without bots.'})
            return
    
    if room.start_game(fill_with_bots=fill_with_bots, default_bot_difficulty=default_bot_difficulty):
        emit('game_started', {
            'status': 'started',
            'message': 'Game has started!',
            'total_questions': len(room.questions) if room.questions else 0 
        }, room=room_id)
    else:
        print(f"Room {room_id}: Call to room.start_game failed. Host: {session_id}")

@app.route('/register', methods=['POST'])
def register_user():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'status': 'error', 'message': 'Missing username, email, or password'}), 400

    username = data['username']
    email = data['email']
    password = data['password']

    if len(password) < 8:
        return jsonify({'status': 'error', 'message': 'Password must be at least 8 characters long'}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
        existing_user = cursor.fetchone()
        if existing_user:
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                return jsonify({'status': 'error', 'message': 'Username already exists'}), 409
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                return jsonify({'status': 'error', 'message': 'Email already registered'}), 409
            return jsonify({'status': 'error', 'message': 'Username or email already exists'}), 409

        hashed_password = generate_password_hash(password)
        
        cursor.execute("""
            INSERT INTO users (username, email, password_hash, registration_date)
            VALUES (?, ?, ?, ?)
        """, (username, email, hashed_password, datetime.utcnow()))
        
        user_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO player_profiles (user_id)
            VALUES (?)
        """, (user_id,))
        
        conn.commit()
        return jsonify({'status': 'success', 'message': 'User registered successfully', 'user_id': user_id}), 201

    except sqlite3.IntegrityError as e:
        conn_check = sqlite3.connect(DB_PATH)
        cursor_check = conn_check.cursor()
        cursor_check.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor_check.fetchone():
            conn_check.close()
            return jsonify({'status': 'error', 'message': 'Username already exists'}), 409
        cursor_check.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor_check.fetchone():
            conn_check.close()
            return jsonify({'status': 'error', 'message': 'Email already registered'}), 409
        conn_check.close()
        return jsonify({'status': 'error', 'message': 'Username or email already exists (Integrity Error)'}), 409
    except Exception as e:
        print(f"Error during registration: {e}")
        return jsonify({'status': 'error', 'message': f'An internal error occurred: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login_user():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Request body must be JSON'}), 400

    login_identifier = data.get('login_identifier')
    password = data.get('password')

    if not login_identifier or not password:
        return jsonify({'status': 'error', 'message': 'Missing username/email or password'}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM users WHERE username = ? OR email = ?", (login_identifier, login_identifier))
        user = cursor.fetchone()

        if user and check_password_hash(user['password_hash'], password):
            token_payload = {
                'user_id': user['id'],
                'username': user['username'],
                'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES']
            }
            access_token = jwt.encode(token_payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
            
            user_data = {
                'user_id': user['id'],
                'username': user['username'],
                'email': user['email']
            }
            return jsonify({
                'status': 'success',
                'message': 'Login successful',
                'user': user_data,
                'access_token': access_token
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Invalid username/email or password'}), 401

    except Exception as e:
        print(f"Error during login: {e}")
        return jsonify({'status': 'error', 'message': f'An internal error occurred: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/protected_example', methods=['GET'])
@token_required
def protected_example(current_user):
    return jsonify({'message': 'This is a protected route!', 'user': current_user})

@app.route('/profile', methods=['GET'])
@token_required
def get_own_profile(current_user):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT u.username, u.email, p.games_played, p.wins, p.total_score, p.avatar_url, p.bio, u.registration_date
            FROM users u
            JOIN player_profiles p ON u.id = p.user_id
            WHERE u.id = ?
        """, (current_user['user_id'],))
        profile_data = cursor.fetchone()
        conn.close()

        if profile_data:
            return jsonify({
                'status': 'success',
                'profile': {
                    'username': profile_data[0],
                    'email': profile_data[1],
                    'games_played': profile_data[2],
                    'wins': profile_data[3],
                    'total_score': profile_data[4],
                    'avatar_url': profile_data[5],
                    'bio': profile_data[6],
                    'registration_date': profile_data[7]
                }
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Profile not found'}), 404
    except Exception as e:
        conn.close()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/profile', methods=['PUT'])
@token_required
def update_own_profile(current_user):
    data = request.get_json()
    bio = data.get('bio')
    avatar_url = data.get('avatar_url')

    if bio is None and avatar_url is None:
        return jsonify({'status': 'error', 'message': 'No update data provided (bio or avatar_url required)'}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        if bio is not None:
            cursor.execute("UPDATE player_profiles SET bio = ? WHERE user_id = ?", (bio, current_user['user_id']))
        if avatar_url is not None:
            cursor.execute("UPDATE player_profiles SET avatar_url = ? WHERE user_id = ?", (avatar_url, current_user['user_id']))
        
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Profile updated successfully'}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/profile/<username>', methods=['GET'])
def get_user_profile_by_username(username):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT u.username, p.games_played, p.wins, p.total_score, p.avatar_url, p.bio, u.registration_date
            FROM users u
            JOIN player_profiles p ON u.id = p.user_id
            WHERE u.username = ?
        """, (username,))
        profile_data = cursor.fetchone()
        conn.close()

        if profile_data:
            return jsonify({
                'status': 'success',
                'profile': {
                    'username': profile_data[0],
                    'games_played': profile_data[1],
                    'wins': profile_data[2],
                    'total_score': profile_data[3],
                    'avatar_url': profile_data[4],
                    'bio': profile_data[5],
                    'registration_date': profile_data[6]
                }
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'User profile not found'}), 404
    except Exception as e:
        conn.close()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    limit = 10

    try:
        cursor.execute("""
            SELECT u.username, p.total_score
            FROM player_profiles p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.total_score DESC
            LIMIT ?
        """, (limit,))
        top_scores_rows = cursor.fetchall()
        top_singleplayer_scores = [{'username': row['username'], 'total_score': row['total_score']} for row in top_scores_rows]

        cursor.execute("""
            SELECT u.username, p.wins
            FROM player_profiles p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.wins DESC
            LIMIT ?
        """, (limit,))
        most_wins_rows = cursor.fetchall()
        most_wins = [{'username': row['username'], 'wins': row['wins']} for row in most_wins_rows]
        
        conn.close()

        return jsonify({
            'status': 'success',
            'top_singleplayer_scores': top_singleplayer_scores,
            'most_wins': most_wins
        }), 200

    except Exception as e:
        if conn:
            conn.close()
        print(f"Error fetching leaderboard: {e}")
        return jsonify({'status': 'error', 'message': f'Failed to retrieve leaderboard: {str(e)}'}), 500

if __name__ == '__main__':
    init_db()
    socketio.run(app, debug=True, use_reloader=False)