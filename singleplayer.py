from flask_socketio import emit
from flask import request # Import request from Flask
import random
import time
import threading
from datetime import datetime
import sqlite3

# Global variable to store the SocketIO instance
socketio_instance = None

class SinglePlayerGame:
    """Single player quiz game with 30 questions"""
    def __init__(self, player_id, player_name):
        """Initialize a single player game"""
        self.player_id = player_id
        self.player_name = player_name
        self.current_question = 0
        self.score = 0
        self.start_time = datetime.now()
        self.question_duration = 10
        self.timer_thread = None
        self.time_remaining = 0 
        self.current_answer = None
        self.game_state = "playing"
        self.category_choosen = None
        self.questions = []
        self.answered = False
        self.correct_answers = 0
        self.total_questions_answered = 0
    
    def prepare_game(self, load_questions_func): # Renamed from start_game
        """Prepare single player game: load questions and initialize state."""
        # Load questions based on category
        all_questions = load_questions_func(self.category_choosen or 'all') 
        
        if not all_questions:
            print(f"Player {self.player_id} ({self.player_name}): Failed to load questions for category '{self.category_choosen or 'all'}'. No questions returned.")
            return False
        
        if len(all_questions) == 0:
            print(f"Player {self.player_id} ({self.player_name}): No questions found for category '{self.category_choosen or 'all'}'. Question list is empty.")
            return False

        # Select up to 30 random questions
        num_questions_to_sample = min(30, len(all_questions))
        
        # This check is important if, for some reason, sampling 0 is possible with random.sample
        # though len(all_questions) == 0 should catch it.
        if num_questions_to_sample == 0 : 
            print(f"Player {self.player_id} ({self.player_name}): Not enough questions to sample for category '{self.category_choosen or 'all'}'. Available: {len(all_questions)}, Sampling: {num_questions_to_sample}")
            return False
            
        self.questions = random.sample(all_questions, num_questions_to_sample)
        
        # Initialize game state
        self.current_question = 0
        self.score = 0
        self.answered = False
        self.current_answer = None
        self.correct_answers = 0
        self.total_questions_answered = 0
        
        # DO NOT Send first question here
        # DO NOT Start timer here
        
        print(f"Player {self.player_id} ({self.player_name}): Game prepared with {len(self.questions)} questions for category '{self.category_choosen or 'all'}'.")
        return True
    
    def send_question(self):
        """Send current question to player"""
        print(f"Player {self.player_id}: send_question() called for question index {self.current_question}")
        # Check if game has ended
        if self.current_question >= len(self.questions):
            print(f"Player {self.player_id}: send_question() - game ended or current_question out of bounds. Current: {self.current_question}, Total: {len(self.questions)}")
            # self.end_game() # Already handled by next_question, avoid double call if not careful
            return
        
        # Get current question
        question = self.questions[self.current_question]
        print(f"Player {self.player_id}: Preparing question text: '{question.get('question', 'N/A')[:50]}...' for question number {self.current_question + 1}")
        
        # Shuffle answer options
        shuffled_options = random.sample(question['options'], len(question['options']))
        
        # Prepare question data
        question_data = {
            'question_number': self.current_question + 1,
            'total_questions': len(self.questions),
            'question': question['question'],
            'options': shuffled_options,
            'time_limit': self.question_duration,
            'current_score': self.score,
            'category': question.get('category', 'General')
        }
        
        # Reset answered status
        self.answered = False
        self.current_answer = None
        # Emit question to player
        socketio_instance.emit('single_player_question', question_data, room=self.player_id)
        print(f"Player {self.player_id}: Emitted 'single_player_question' for question_number {self.current_question + 1}")
    
    def submit_answer(self, answer):
        """Process answer submission"""
        # Prevent double answers
        if self.answered:
            return
        
        self.answered = True
        self.current_answer = answer
        self.total_questions_answered += 1
        
        # Get current question
        current_question = self.questions[self.current_question]
        
        # Calculate time taken
        time_taken = self.question_duration - self.time_remaining
        
        # Check if answer is correct (handle both 'correct_answer' and 'answer' keys)
        correct_answer = current_question.get('correct_answer', current_question.get('answer', ''))
        is_correct = (answer == correct_answer)
        
        # Calculate points
        points_earned = 0
        if is_correct:
            points_earned = max(0, 1000 - (time_taken * 100))  # 100 points per second
            self.score += points_earned
            self.correct_answers += 1
        
        # Prepare result
        result = {
            'is_correct': is_correct,
            'correct_answer': correct_answer,
            'points_earned': points_earned,
            'total_score': self.score,
            'time_taken': time_taken
        }
        
        # Emit result to player
        socketio_instance.emit('answer_result', result, room=self.player_id)
        
        # Stop current timer
        self.time_remaining = 0
        
        # Schedule next question
        socketio_instance.start_background_task(self._delayed_next_question) # New way

    def _delayed_next_question(self):
        """Helper method to delay calling next_question, run in a background task."""
        print(f"Player {self.player_id}: _delayed_next_question() called. Waiting 3 seconds...")
        time.sleep(3.0)
        print(f"Player {self.player_id}: _delayed_next_question() finished waiting. Calling next_question().")
        self.next_question()
    
    def next_question(self):
        """Move to next question"""
        print(f"Player {self.player_id}: next_question() called. Current question index before increment: {self.current_question}")
        # Increment question counter
        self.current_question += 1
        print(f"Player {self.player_id}: Current question index after increment: {self.current_question}. Total questions: {len(self.questions)}")
        
        # Check if more questions remain
        if self.current_question < len(self.questions):
            print(f"Player {self.player_id}: More questions remain. Sending next question and starting timer.")
            self.send_question()
            self.start_timer()
        else:
            print(f"Player {self.player_id}: No more questions. Ending game.")
            self.end_game()
    
    def start_timer(self):
        """Start question timer"""
        self.time_remaining = self.question_duration
        print(f"Player {self.player_id}: Starting timer for question {self.current_question + 1} (index {self.current_question}) with duration {self.question_duration}s.") # Added log
        
        def countdown():
            while self.time_remaining > 0 and self.game_state == "playing":
                socketio_instance.sleep(1) # Use socketio_instance.sleep for background tasks
                self.time_remaining -= 1
                
                # Emit timer update
                socketio_instance.emit('timer_update', {
                    'time_remaining': self.time_remaining,
                    'question_number': self.current_question + 1 # Good to include context
                }, room=self.player_id)
            
            # Auto-submit if time expires
            if self.time_remaining == 0 and not self.answered and self.game_state == "playing":
                print(f"Player {self.player_id}: Timer expired for question {self.current_question + 1} (index {self.current_question}). Auto-submitting None.") # Added log
                self.submit_answer(None) # Pass None or a specific value for timeout
        
        # Start timer in separate thread
        self.timer_thread = socketio_instance.start_background_task(countdown) # New way
    
    def end_game(self):
        """End single player game and update leaderboard"""
        self.game_state = "finished"
        
        # Calculate final statistics
        accuracy = (self.correct_answers / self.total_questions_answered * 100) if self.total_questions_answered > 0 else 0
        game_duration = (datetime.now() - self.start_time).total_seconds()
        
        # Create leaderboard entry
        leaderboard_entry = {
            'player_name': self.player_name,
            'score': self.score,
            'date': datetime.now().isoformat(),
            'questions_answered': self.total_questions_answered,
            'correct_answers': self.correct_answers,
            'accuracy': accuracy
        }
        
        # Update leaderboard
        leaderboard_manager.add_entry(leaderboard_entry)
        
        # Update player stats
        stats_manager = SinglePlayerStatsManager(db_path=SINGLEPLAYER_DB_PATH) # Use the imported DB_PATH
        stats_manager.update_stats(self.player_name, {
            'score': self.score,
            'questions_answered': self.total_questions_answered,
            'correct_answers': self.correct_answers,
            'game_duration': game_duration
        })
        
        # Get player's position
        position = leaderboard_manager.get_position(self.score)
        
        # Get top 10 leaderboard
        top_10 = leaderboard_manager.get_top_scores(10)
        
        # Emit final results
        socketio_instance.emit('single_player_game_over', {
            'final_score': self.score,
            'questions_answered': self.total_questions_answered,
            'correct_answers': self.correct_answers,
            'accuracy': accuracy,
            'game_duration': game_duration,
            'leaderboard_position': position,
            'top_10_leaderboard': top_10
        }, room=self.player_id)
    
    def pause_game(self):
        """Pause the current game"""
        if self.game_state == "playing":
            self.game_state = "paused"
            socketio_instance.emit('game_paused', {
                'status': 'paused',
                'time_remaining': self.time_remaining
            }, room=self.player_id)
    
    def resume_game(self):
        """Resume a paused game"""
        if self.game_state == "paused":
            self.game_state = "playing"
            # Restart timer with remaining time
            self.start_timer()
            socketio_instance.emit('game_resumed', {
                'status': 'playing',
                'time_remaining': self.time_remaining
            }, room=self.player_id)

# Leaderboard management
class LeaderboardManager:
    """Manage global leaderboard for single player games"""
    def __init__(self, db_path='quiz_questions.db'):
        """Initialize leaderboard manager"""
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize leaderboard table in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS single_player_leaderboard (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_name TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    questions_answered INTEGER,
                    correct_answers INTEGER,
                    accuracy REAL
                )
            ''')
            
            conn.commit()
            conn.close()
        except sqlite3.Error as e:
            print(f"Database initialization error: {e}")
    
    def load_leaderboard(self):
        """Load leaderboard from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT player_name, score, date, questions_answered, correct_answers, accuracy
                FROM single_player_leaderboard
                ORDER BY score DESC
                LIMIT 100
            ''')
            
            results = cursor.fetchall()
            conn.close()
            
            leaderboard = []
            for row in results:
                leaderboard.append({
                    'player_name': row[0],
                    'score': row[1],
                    'date': row[2],
                    'questions_answered': row[3],
                    'correct_answers': row[4],
                    'accuracy': row[5]
                })
            
            return leaderboard
            
        except sqlite3.Error as e:
            print(f"Error loading leaderboard: {e}")
            return []
    
    def add_entry(self, entry):
        """Add a new entry to the leaderboard, ensuring persistence."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO single_player_leaderboard (player_name, score, date, questions_answered, correct_answers, accuracy)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (entry['player_name'], entry['score'], entry['date'], 
                  entry['questions_answered'], entry['correct_answers'], entry['accuracy']))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Error adding to leaderboard: {e}")
        finally:
            conn.close()

    def get_position(self, score):
        """Get player's rank based on score."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT COUNT(*) FROM single_player_leaderboard WHERE score > ?", (score,))
            position = cursor.fetchone()[0] + 1
            return position
        except sqlite3.Error as e:
            print(f"Error getting leaderboard position: {e}")
            return -1 # Indicate error
        finally:
            conn.close()

    def get_top_scores(self, limit=10, category='overall'):
        """Retrieve top scores, potentially filtered by category."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT player_name, score, date FROM single_player_leaderboard ORDER BY score DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving top scores: {e}")
            return []
        finally:
            conn.close()

# Single Player Statistics Management
class SinglePlayerStatsManager:
    """Manage personal statistics for single player games"""
    def __init__(self, db_path='quiz_questions.db'): # Keep default for potential other uses
        """Initialize stats manager"""
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS single_player_stats (
                player_name TEXT PRIMARY KEY,
                total_games_played INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                total_questions_answered INTEGER DEFAULT 0,
                total_correct_answers INTEGER DEFAULT 0,
                average_accuracy REAL DEFAULT 0,
                fastest_game_duration REAL,
                highest_score INTEGER DEFAULT 0,
                last_played TEXT
            )
        """)
        conn.commit()
        conn.close()

    def update_stats(self, player_name, game_stats):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM single_player_stats WHERE player_name = ?", (player_name,))
            current_stats = cursor.fetchone()

            if current_stats:
                new_total_games = current_stats[1] + 1
                new_total_score = current_stats[2] + game_stats['score']
                new_total_questions = current_stats[3] + game_stats['questions_answered']
                new_total_correct = current_stats[4] + game_stats['correct_answers']
                new_avg_accuracy = (new_total_correct / new_total_questions * 100) if new_total_questions > 0 else 0
                
                new_fastest_game = current_stats[6]
                if game_stats.get('game_duration') is not None:
                    if new_fastest_game is None or game_stats['game_duration'] < new_fastest_game:
                        new_fastest_game = game_stats['game_duration']
                
                new_highest_score = max(current_stats[7] or 0, game_stats['score'])

                cursor.execute("""
                    UPDATE single_player_stats
                    SET total_games_played = ?, total_score = ?, total_questions_answered = ?,
                        total_correct_answers = ?, average_accuracy = ?, fastest_game_duration = ?,
                        highest_score = ?, last_played = ?
                    WHERE player_name = ?
                """, (new_total_games, new_total_score, new_total_questions, new_total_correct,
                      new_avg_accuracy, new_fastest_game, new_highest_score, datetime.now().isoformat(), player_name))
            else:
                avg_accuracy = (game_stats['correct_answers'] / game_stats['questions_answered'] * 100) if game_stats['questions_answered'] > 0 else 0
                cursor.execute("""
                    INSERT INTO single_player_stats 
                    (player_name, total_games_played, total_score, total_questions_answered, total_correct_answers, average_accuracy, fastest_game_duration, highest_score, last_played)
                    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
                """, (player_name, game_stats['score'], game_stats['questions_answered'], game_stats['correct_answers'], 
                      avg_accuracy, game_stats.get('game_duration'), game_stats['score'], datetime.now().isoformat()))
            
            conn.commit()
        except sqlite3.Error as e:
            print(f"Error updating single player stats: {e}")
            conn.rollback()
        finally:
            conn.close()

    def get_stats(self, player_name):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM single_player_stats WHERE player_name = ?", (player_name,))
            stats = cursor.fetchone()
            return dict(stats) if stats else None
        except sqlite3.Error as e:
            print(f"Error retrieving single player stats: {e}")
            return None
        finally:
            conn.close()

# Store active single player games
active_single_player_games = {}

def register_single_player_handlers(socketio_app_instance):
    global socketio_instance
    socketio_instance = socketio_app_instance
    
    from server_backend import load_questions # Import here to avoid circular dependency at module load time

    @socketio_instance.on('start_single_player') # Changed from 'start_single_player_game'
    def handle_start_single_player_game(data):
        player_id = request.sid
        player_name = data.get('player_name', 'Anonymous')
        category = data.get('category', 'all')
        
        print(f"Attempting to start single player game for SID: {player_id}, Player: {player_name}, Category: {category}")

        # Clean up any existing game for this session ID before starting a new one.
        if player_id in active_single_player_games:
            print(f"Warning: Existing game found for SID {player_id} during new game start. Cleaning up old game instance.")
            old_game_instance = active_single_player_games.pop(player_id)
            old_game_instance.game_state = "finished" # This should help stop its timers/background tasks.

        game = SinglePlayerGame(player_id, player_name)
        game.category_choosen = category
        
        if game.prepare_game(load_questions_func=load_questions): # Call renamed method
            active_single_player_games[player_id] = game
            print(f"Single player game prepared for SID: {player_id}. Questions loaded: {len(game.questions)}")
            
            # Emit 'single_player_started' first
            socketio_instance.emit('single_player_started', {
                'status': 'success',
                'message': 'Single player game started!',
                'total_questions': len(game.questions)
            }, room=player_id)
            print(f"Emitted 'single_player_started' for SID: {player_id}")

            # Then send the first question and start its timer
            game.send_question()
            print(f"Sent first question for SID: {player_id}")
            # Small delay before starting timer to ensure client processes question first?
            # socketio_instance.sleep(0.1) # Consider if needed, usually not.
            game.start_timer()
            print(f"Started timer for first question for SID: {player_id}")
        else:
            print(f"Failed to prepare single player game for SID: {player_id}. game.prepare_game returned False.")
            socketio_instance.emit('single_player_error', {
                'message': 'Failed to start game: Could not load questions or no questions available for the category.'
            }, room=player_id)

    @socketio_instance.on('submit_single_player_answer')
    def handle_submit_single_player_answer(data):
        player_id = request.sid
        answer = data.get('answer')
        
        if player_id in active_single_player_games:
            game = active_single_player_games[player_id]
            game.submit_answer(answer)
        else:
            socketio_instance.emit('single_player_error', {
                'message': 'Game not found.'
            }, room=player_id)

    @socketio_instance.on('request_leaderboard')
    def handle_request_leaderboard(data):
        limit = data.get('limit', 10)
        category = data.get('category', 'overall') # Example: allow category-specific leaderboards
        
        top_scores = leaderboard_manager.get_top_scores(limit=limit, category=category)
        player_id = request.sid # Correctly uses imported request
        
        socketio_instance.emit('leaderboard_update', {
            'leaderboard': top_scores,
            'category': category
        }, room=player_id)

    @socketio_instance.on('get_single_player_stats')
    def handle_get_single_player_stats(data):
        player_id = request.sid # Correctly uses imported request
        player_name = data.get('player_name', f"Guest_{player_id[:6]}") 
        
        stats_manager = SinglePlayerStatsManager(db_path=SINGLEPLAYER_DB_PATH) # Use the imported DB_PATH
        stats = stats_manager.get_stats(player_name)
        
        if stats:
            socketio_instance.emit('single_player_stats_update', stats, room=player_id)
        else:
            socketio_instance.emit('single_player_stats_update', {
                'message': 'No stats found for this player.'
            }, room=player_id)

    @socketio_instance.on('disconnect')
    def handle_disconnect_single_player(): # Keep it simple, request.sid is available
        player_id = request.sid
        if player_id in active_single_player_games:
            game = active_single_player_games[player_id]
            # The timer loop in start_timer checks game.game_state.
            # Setting it to finished will cause the timer to stop gracefully.
            game.game_state = "finished" 
            # No need to check is_alive() or try to kill the thread directly
            # when using start_background_task, as the task will exit
            # based on game_state.
            del active_single_player_games[player_id]
            print(f"Cleaned up single player game for disconnected player {player_id}. Game state set to finished.")

# Initialize the leaderboard manager
from server_backend import DB_PATH as SINGLEPLAYER_DB_PATH
leaderboard_manager = LeaderboardManager(db_path=SINGLEPLAYER_DB_PATH)