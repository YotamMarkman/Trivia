from flask_socketio import emit
import random
import time
import threading
from datetime import datetime
import sqlite3

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
    
    def start_game(self, load_questions_func):
        """Start single player game with 30 questions"""
        # Load questions based on category
        all_questions = load_questions_func(self.category_choosen or 'all') 
        
        if not all_questions:
            return False
        
        # Select 30 random questions
        self.questions = random.sample(all_questions, min(30, len(all_questions)))
        
        # Initialize game state
        self.current_question = 0
        self.score = 0
        self.answered = False
        self.current_answer = None
        self.correct_answers = 0
        self.total_questions_answered = 0
        
        # Send first question
        self.send_question()
        
        # Start timer
        self.start_timer()
        
        return True
    
    def send_question(self):
        """Send current question to player"""
        # Check if game has ended
        if self.current_question >= len(self.questions):
            self.end_game()
            return
        
        # Get current question
        question = self.questions[self.current_question]
        
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
        emit('single_player_question', question_data, room=self.player_id)
    
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
        
        # Check if answer is correct
        is_correct = (answer == current_question['correct_answer'])
        
        # Calculate points
        points_earned = 0
        if is_correct:
            points_earned = max(0, 1000 - (time_taken * 100))  # 100 points per second
            self.score += points_earned
            self.correct_answers += 1
        
        # Prepare result
        result = {
            'is_correct': is_correct,
            'correct_answer': current_question['correct_answer'],
            'points_earned': points_earned,
            'total_score': self.score,
            'time_taken': time_taken
        }
        
        # Emit result to player
        emit('answer_result', result, room=self.player_id)
        
        # Stop current timer
        self.time_remaining = 0
        
        # Schedule next question
        threading.Timer(3.0, self.next_question).start()
    
    def next_question(self):
        """Move to next question"""
        # Increment question counter
        self.current_question += 1
        
        # Check if more questions remain
        if self.current_question < len(self.questions):
            self.send_question()
            self.start_timer()
        else:
            self.end_game()
    
    def start_timer(self):
        """Start question timer"""
        self.time_remaining = self.question_duration
        
        def countdown():
            while self.time_remaining > 0 and self.game_state == "playing":
                time.sleep(1)
                self.time_remaining -= 1
                
                # Emit timer update
                emit('timer_update', {
                    'time_remaining': self.time_remaining
                }, room=self.player_id)
            
            # Auto-submit if time expires
            if self.time_remaining == 0 and not self.answered and self.game_state == "playing":
                self.submit_answer(None)
        
        # Start timer in separate thread
        self.timer_thread = threading.Thread(target=countdown)
        self.timer_thread.daemon = True
        self.timer_thread.start()
    
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
        stats_manager = SinglePlayerStatsManager() # Use the new manager
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
        emit('single_player_ended', {
            'final_score': self.score,
            'leaderboard_position': position,
            'leaderboard': top_10,
            'total_questions': self.total_questions_answered,
            'correct_answers': self.correct_answers,
            'accuracy': accuracy
        }, room=self.player_id)
    
    def pause_game(self):
        """Pause the current game"""
        if self.game_state == "playing":
            self.game_state = "paused"
            emit('game_paused', {
                'status': 'paused',
                'time_remaining': self.time_remaining
            }, room=self.player_id)
    
    def resume_game(self):
        """Resume a paused game"""
        if self.game_state == "paused":
            self.game_state = "playing"
            # Restart timer with remaining time
            self.start_timer()
            emit('game_resumed', {
                'status': 'playing',
                'time_remaining': self.time_remaining
            }, room=self.player_id)

# Leaderboard management
class LeaderboardManager:
    """Manage global leaderboard for single player games"""
    def __init__(self):
        """Initialize leaderboard manager"""
        self.db_path = 'quiz_questions.db'
        self.init_database()
    
    def init_database(self):
        """Initialize leaderboard table in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
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
                FROM leaderboard
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
    
    def save_leaderboard(self):
        """Not needed with SQL database - data is saved immediately"""
        pass
    
    def add_entry(self, entry):
        """Add new entry to leaderboard"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO leaderboard (player_name, score, date, questions_answered, correct_answers, accuracy)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (entry['player_name'], entry['score'], entry['date'], 
                  entry.get('questions_answered', 0), entry.get('correct_answers', 0), 
                  entry.get('accuracy', 0)))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Error adding entry: {e}")
    
    def get_position(self, score):
        """Get leaderboard position for a score"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT COUNT(*) FROM leaderboard WHERE score > ?
            ''', (score,))
            
            position = cursor.fetchone()[0] + 1
            conn.close()
            
            return position
            
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return 0
    
    def get_top_scores(self, count=10):
        """Get top N scores from leaderboard"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT player_name, score, date, accuracy
                FROM leaderboard
                ORDER BY score DESC
                LIMIT ?
            ''', (count,))
            
            results = cursor.fetchall()
            conn.close()
            
            leaderboard = []
            for i, row in enumerate(results):
                leaderboard.append({
                    'rank': i + 1,
                    'player_name': row[0],
                    'score': row[1],
                    'date': row[2],
                    'accuracy': row[3] if row[3] else 0
                })
            
            return leaderboard
            
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []
    
    def get_player_best(self, player_name):
        """Get player's best score"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT score, date, accuracy
                FROM leaderboard
                WHERE player_name = ?
                ORDER BY score DESC
                LIMIT 1
            ''', (player_name,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                position = self.get_position(result[0])
                return {
                    'score': result[0],
                    'date': result[1],
                    'accuracy': result[2] if result[2] else 0,
                    'position': position
                }
            return None
            
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return None

# Single Player Statistics Management
class SinglePlayerStatsManager:
    """Manage personal statistics for single player games"""
    def __init__(self, db_path='quiz_questions.db'):
        """Initialize stats manager"""
        self.db_path = db_path
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        """Ensure player_stats table exists in the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
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
        conn.commit()
        conn.close()

    def get_stats(self, player_name):
        """Retrieve statistics for a given player"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM player_stats WHERE player_name = ?", (player_name,))
        row = cursor.fetchone()
        conn.close()
        if row:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return None

    def update_stats(self, player_name, game_data):
        """Update player statistics after a game"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        current_stats = self.get_stats(player_name)
        
        if current_stats:
            new_games_played = current_stats['games_played'] + 1
            new_total_score = current_stats['total_score'] + game_data['score']
            new_highest_score = max(current_stats['highest_score'], game_data['score'])
            new_total_questions = current_stats['total_questions_answered'] + game_data['questions_answered']
            new_total_correct = current_stats['total_correct_answers'] + game_data['correct_answers']
            new_total_duration = current_stats['total_game_duration'] + game_data['game_duration']
            
            new_avg_score = new_total_score / new_games_played if new_games_played > 0 else 0
            new_avg_accuracy = (new_total_correct / new_total_questions * 100) if new_total_questions > 0 else 0
            
            cursor.execute('''
                UPDATE player_stats 
                SET games_played = ?, total_score = ?, highest_score = ?, 
                    total_questions_answered = ?, total_correct_answers = ?, total_game_duration = ?, 
                    average_score = ?, average_accuracy = ?, last_played_date = ?
                WHERE player_name = ?
            ''', (new_games_played, new_total_score, new_highest_score, 
                  new_total_questions, new_total_correct, new_total_duration, 
                  new_avg_score, new_avg_accuracy, datetime.now().isoformat(), player_name))
        else:
            # First game for this player
            avg_score = game_data['score']
            avg_accuracy = (game_data['correct_answers'] / game_data['questions_answered'] * 100) if game_data['questions_answered'] > 0 else 0
            cursor.execute('''
                INSERT INTO player_stats (player_name, games_played, total_score, highest_score, 
                                        total_questions_answered, total_correct_answers, total_game_duration, 
                                        average_score, average_accuracy, last_played_date)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (player_name, game_data['score'], game_data['score'], 
                  game_data['questions_answered'], game_data['correct_answers'], game_data['game_duration'],
                  avg_score, avg_accuracy, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()

# Utility functions
def calculate_points(time_taken, is_correct):
    """Calculate points for an answer"""
    if not is_correct:
        return 0
    
    # Calculate: 1000 - (time_taken * 100)
    points = 1000 - (time_taken * 100)
    
    # Ensure minimum of 0 points
    return max(0, points)

def format_time(seconds):
    """Format seconds into MM:SS display"""
    minutes = seconds // 60
    seconds = seconds % 60
    return f"{minutes:02d}:{seconds:02d}"

# Statistics tracking
class SinglePlayerStats:
    """Track statistics for single player games"""
    def __init__(self, player_name):
        """Initialize stats for a player"""
        self.player_name = player_name
        self.games_played = 0
        self.total_score = 0
        self.questions_answered = 0
        self.correct_answers = 0
        self.best_score = 0
        self.total_time = 0
        self.db_path = 'quiz_questions.db'
        self.load_stats()
    
    def load_stats(self):
        """Load player stats from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create stats table if it doesn't exist
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS player_stats (
                    player_name TEXT PRIMARY KEY,
                    games_played INTEGER DEFAULT 0,
                    total_score INTEGER DEFAULT 0,
                    questions_answered INTEGER DEFAULT 0,
                    correct_answers INTEGER DEFAULT 0,
                    best_score INTEGER DEFAULT 0,
                    total_time INTEGER DEFAULT 0
                )
            ''')
            
            # Load existing stats
            cursor.execute('''
                SELECT * FROM player_stats WHERE player_name = ?
            ''', (self.player_name,))
            
            result = cursor.fetchone()
            if result:
                self.games_played = result[1]
                self.total_score = result[2]
                self.questions_answered = result[3]
                self.correct_answers = result[4]
                self.best_score = result[5]
                self.total_time = result[6]
            
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Error loading stats: {e}")
    
    def update_stats(self, game_result):
        """Update player statistics after a game"""
        self.games_played += 1
        self.total_score += game_result['score']
        self.questions_answered += game_result['questions_answered']
        self.correct_answers += game_result['correct_answers']
        self.best_score = max(self.best_score, game_result['score'])
        self.total_time += game_result.get('game_duration', 0)
        
        self.save_stats()
    
    def save_stats(self):
        """Save stats to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO player_stats 
                (player_name, games_played, total_score, questions_answered, correct_answers, best_score, total_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (self.player_name, self.games_played, self.total_score, 
                  self.questions_answered, self.correct_answers, self.best_score, self.total_time))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Error saving stats: {e}")
    
    def get_accuracy(self):
        """Calculate player's answer accuracy"""
        if self.questions_answered == 0:
            return 0
        return (self.correct_answers / self.questions_answered) * 100
    
    def to_dict(self):
        """Convert stats to dictionary"""
        return {
            'player_name': self.player_name,
            'games_played': self.games_played,
            'total_score': self.total_score,
            'questions_answered': self.questions_answered,
            'correct_answers': self.correct_answers,
            'best_score': self.best_score,
            'accuracy': self.get_accuracy(),
            'average_score': self.total_score / self.games_played if self.games_played > 0 else 0
        }

# Global instances
leaderboard_manager = LeaderboardManager()
single_player_games = {}  # Store active games

# Socket.IO event handlers for single player
def register_single_player_handlers(socketio):
    """Register all single player socket handlers"""
    
    @socketio.on('start_single_player')
    def handle_start_single_player(data):
        """Start a single player game"""
        from flask import request
        
        session_id = request.sid
        player_name = data.get('player_name', 'Anonymous')
        category = data.get('category', 'all')
        
        # Create game instance
        game = SinglePlayerGame(session_id, player_name)
        game.category_choosen = category
        
        # Store in global dictionary
        single_player_games[session_id] = game
        
        # Import load_questions function from main server file
        from server_backend import load_questions
        
        # Start the game
        success = game.start_game(load_questions)
        
        emit('single_player_started', {
            'status': 'success' if success else 'error',
            'message': 'Game started successfully' if success else 'Failed to load questions'
        })
    
    @socketio.on('single_player_answer')
    def handle_single_player_answer(data):
        """Handle answer submission in single player"""
        from flask import request
        
        session_id = request.sid
        answer = data.get('answer')
        
        if session_id in single_player_games:
            game = single_player_games[session_id]
            game.submit_answer(answer)
        else:
            emit('error', {'message': 'Game not found'})
    
    @socketio.on('get_leaderboard')
    def handle_get_leaderboard(data):
        """Send leaderboard data to client"""
        count = data.get('count', 50) if data else 50
        leaderboard = leaderboard_manager.get_top_scores(count)
        emit('leaderboard_data', {'leaderboard': leaderboard})
    
    @socketio.on('get_player_stats')
    def handle_get_player_stats(data):
        """Get statistics for a specific player"""
        player_name = data.get('player_name')
        
        if player_name:
            stats = SinglePlayerStats(player_name)
            best_score = leaderboard_manager.get_player_best(player_name)
            
            emit('player_stats', {
                'stats': stats.to_dict(),
                'best_score': best_score
            })
        else:
            emit('error', {'message': 'Player name required'})
    
    @socketio.on('pause_single_player')
    def handle_pause_game():
        """Pause current single player game"""
        from flask import request
        
        session_id = request.sid
        
        if session_id in single_player_games:
            game = single_player_games[session_id]
            game.pause_game()
        else:
            emit('error', {'message': 'Game not found'})
    
    @socketio.on('resume_single_player')
    def handle_resume_game():
        """Resume paused single player game"""
        from flask import request
        
        session_id = request.sid
        
        if session_id in single_player_games:
            game = single_player_games[session_id]
            game.resume_game()
        else:
            emit('error', {'message': 'Game not found'})
    
    @socketio.on('quit_single_player')
    def handle_quit_game():
        """Quit current single player game"""
        from flask import request
        
        session_id = request.sid
        
        if session_id in single_player_games:
            game = single_player_games[session_id]
            
            # End game early
            game.game_state = "quit"
            
            # Save partial results
            game.end_game()
            
            # Clean up
            del single_player_games[session_id]
            
            emit('game_quit', {'status': 'success'})
        else:
            emit('error', {'message': 'Game not found'})