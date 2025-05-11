from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import random
import time
import threading
from datetime import datetime
import json
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global data structures
active_rooms = {}  # {room_id: GameRoom}
player_sessions = {}  # {session_id: player_data}

class Player:
    def __init__(self, session_id, name):
        """
        Initialize a player object
        
        TODO: Implement player initialization with:
        - session_id: unique identifier
        - name: player display name
        - score: starting at 0
        - current_answer: None initially
        - answered: False for current question
        - connected: True when active
        """
        self.session_id = session_id
        self.name = name 
        self.score = 0
        self.current_answer = None
        self.answered = False
        self.connected = True
        self.timetaken = 0
        
    def to_dict(self):
        """
        Convert player object to dictionary for JSON serialization
        
        TODO: Return dictionary with player data
        """
        self_dict = {
            'session_id': self.session_id,
            'name': self.name,
            'score': self.score,
            'answered': self.answered,
            'connected': self.connected
        }
        return self_dict
    
    def reset_answer(self):
        self.current_answer = None
        self.answered = False
        
    def sumit_answer(self, answer):
        
        if not self.answered:
            self.current_answer = answer
            self.answered = True
            return True
        return False

class GameRoom:
    def __init__(self, room_id, host_id):
        """
        Initialize a game room
        
        TODO: Implement room initialization with:
        - room_id: unique room identifier
        - host_id: session_id of the room creator
        - players: dictionary of players {session_id: Player}
        - game_state: "waiting", "playing", "finished"
        - current_question: index of current question
        - questions: list of questions for this game
        - timer_thread: None initially
        - time_remaining: seconds left for current question
        - max_players: maximum allowed players (e.g., 8)
        - question_duration: seconds per question (e.g., 15)
        """
        self.room_id = room_id
        self.host_id = host_id
        self.question_duration = 15
        self.max_players = 4
        self.timer_thread = None
        self.time_remaining = 0
        self.game_state = "waiting"
        self.current_question = 0       
        self.players = {}  # {session_id: Player}
        self.questions = []  # List of questions for this game
        self.marked_for_deletion = False
        self.category_choosen = None  # Category chosen by the host
    
    def add_player(self, player):
        """
        Add a player to the room
        
        TODO:
        - Check if room is full
        - Add player to players dictionary
        - Return success/failure status
        """
        if len(self.players) >= self.max_players:
            return False
    
        if player.session_id in self.players:
            return False
    
        self.players[player.session_id] = player
    
        # Store both player and room reference
        global player_sessions
        player_sessions[player.session_id] = {
            'player': player,
            'room_id': self.room_id
        }
        
        return True
    
    def remove_player(self, session_id):
        """
        Remove a player from the room
        
        TODO:
        - Remove player from players dictionary
        - Check if host left and reassign if needed
        - Check if room is empty and mark for deletion
        """
        if session_id not in self.players:
            return False
        # Check if the leaving player is the host BEFORE removing them
        was_host = (self.host_id == session_id)
        # Remove player from room
        player = self.players[session_id]
        del self.players[session_id]
        
        # Remove from global player sessions
        global player_sessions
        if session_id in player_sessions:
            del player_sessions[session_id]
        
        # Handle host reassignment if the host left
        if was_host:
            if self.players:  # If there are still players
                new_host = next(iter(self.players.values()))
                self.host_id = new_host.session_id
                # Emit to the room, not just the new host
                emit('new_host', {'host_id': new_host.session_id}, room=self.room_id)
            else:
                self.host_id = None
        
        # Check if room is empty and mark for deletion
        if len(self.players) == 0:
            self.marked_for_deletion = True
        
        return True
    
    def start_game(self):
        """
        Start the quiz game
        
        TODO:
        - Change game_state to "playing"
        - Select random questions from question bank
        - Send first question to all players
        - Start question timer
        """
        if self.game_state != "waiting":
            return False
    
        if len(self.players) < 2:  # Minimum players check
            return False
        
        # Load questions based on category (if using categories)
        all_questions = load_questions(self.category_choosen) 
        
        if not all_questions:
            return False
        
        # Select 15 random questions
        self.questions = random.sample(all_questions, min(15, len(all_questions)))
        
        # Initialize game state
        self.game_state = "playing"
        self.current_question = 0  # Should start at 0, not 1 (zero-indexed)
        
        # Reset all players
        for player in self.players.values():
            player.score = 0
            player.answered = False
            player.current_answer = None
        
        # Send first question
        self.send_current_question()  # Use send_current_question, not send_question
        
        # Start timer
        self.start_question_timer()
        
        return True
            
    
    def submit_answer(self, session_id, answer):
        """
        Process a player's answer submission
        
        TODO:
        - Validate that player hasn't already answered
        - Store the answer
        - Check if answer is correct and update score
        - Check if all players have answered
        - Return result
        """
        # Check if player exists in this room
        if session_id not in self.players:
            return {'status': 'error', 'message': 'Player not in this room'}
        
        player = self.players[session_id]
        
        # Validate that player hasn't already answered
        if player.answered:
            return {'status': 'error', 'message': 'Already answered this question'}
        
        # Validate game state
        if self.game_state != "playing":
            return {'status': 'error', 'message': 'Game not in progress'}
        
        # Check if we have a current question
        if self.current_question >= len(self.questions):
            return {'status': 'error', 'message': 'No active question'}
        
        # Store the answer and calculate time taken
        player.current_answer = answer
        player.answered = True
        player.timetaken = self.question_duration - self.time_remaining
        
        # Check if answer is correct and update score
        current_question = self.questions[self.current_question]
        is_correct = (answer == current_question['correct_answer'])
        
        # Update score using time-based scoring
        points_earned = 0
        if is_correct:
            points_earned = max(0, 1000 - player.timetaken * 10)
            player.score += points_earned
        
        # Check if all players have answered
        all_answered = all(p.answered for p in self.players.values())
        
        # Prepare result
        result = {
            'status': 'success',
            'is_correct': is_correct,
            'points_earned': points_earned,
            'current_score': player.score,
            'all_answered': all_answered,
            'time_taken': player.timetaken
        }
        
        # If all players have answered, we might want to move to next question
        if all_answered:
            # Stop the timer since everyone has answered
            if self.timer_thread and self.timer_thread.is_alive():
                self.time_remaining = 0  # This will stop the timer
            
            # Show results and then move to next question
            result['should_advance'] = True
            
            # Schedule the reveal answer and next question
            threading.Timer(1.0, self.reveal_answer).start()
        
        return result
        
    def reveal_answer(self):
        """
        Reveal the correct answer to all players"""
        if self.current_question >= len(self.questions):
            return
    
        current_question = self.questions[self.current_question]
    
        # Prepare results for all players
        results = {
            'correct_answer': current_question['correct_answer'],
            'player_results': []
        }
        
        for player in self.players.values():
            player_result = {
                'name': player.name,
                'answer': player.current_answer,
                'is_correct': player.current_answer == current_question['correct_answer'],
                'score': player.score
            }
            results['player_results'].append(player_result)
        
        # Sort by score for leaderboard
        results['player_results'].sort(key=lambda x: x['score'], reverse=True)
        
        # Emit results to all players
        emit('question_results', results, room=self.room_id)
        
        # Schedule next question after a delay
        threading.Timer(5.0, self.next_question).start()

    def time_up(self):
        """Called when timer expires"""
        # Mark all unanswered players as having no answer
        for player in self.players.values():
            if not player.answered:
                player.answered = True
                player.current_answer = None

        self.reveal_answer()  # Changed from reveal_answers()
            
    
    def next_question(self):
        """
        Move to the next question
        
        TODO:
        - Increment current_question
        - Reset all players' answered status
        - Send new question or end game if no more questions
        - Start new timer
        """
        
        self.current_question += 1
        if self.current_question >= len(self.questions):
            self.end_game()
            return
    
        # Reset all players' answered status
        for player in self.players.values():
            player.answered = False
            player.current_answer = None
        
        # Send the new question
        self.send_current_question()
        
        # Start new timer (note: it's a function call, needs parentheses)
        self.start_question_timer()

    def send_current_question(self):
        """Send the current question to all players"""
        # Check if we're out of questions
        if self.current_question >= len(self.questions):
            self.end_game()
            return
        
        # Get the current question
        question = self.questions[self.current_question]
        
        # Shuffle the options
        shuffled_options = random.sample(question['options'], len(question['options']))
        
        # Prepare question data
        question_data = {
            'question_number': self.current_question + 1,
            'total_questions': len(self.questions),
            'question': question['question'],
            'options': shuffled_options,
            'time_limit': self.question_duration
        }
        
        # Reset player states
        for player in self.players.values():
            player.answered = False
            player.current_answer = None
        
        # Send to all players in room
        emit('new_question', question_data, room=self.room_id)
        
        
    def end_game(self):
        """
        End the game and show final results
        
        TODO:
        - Change game_state to "finished"
        - Calculate final scores
        - Determine winner(s)
        - Emit final results to all players
        """
        self.game_state = 'finished'
        
        # Stop any running timer
        self.time_remaining = 0
        
        # Prepare final results
        final_results = {
            'players': []
        }
        
        # Compile all player scores
        for player in self.players.values():
            player_data = {
                'name': player.name,
                'score': player.score,
                'session_id': player.session_id
            }
            final_results['players'].append(player_data)
        
        # Sort by score (highest first)
        final_results['players'].sort(key=lambda x: x['score'], reverse=True)
        
        # Determine winner(s) - handle ties
        if final_results['players']:
            highest_score = final_results['players'][0]['score']
            winners = [p for p in final_results['players'] if p['score'] == highest_score]
            final_results['winners'] = winners
        
        # Emit final results to all players
        emit('game_ended', final_results, room=self.room_id)

    def start_question_timer(self):
        """
        Start a timer for the current question
        
        TODO:
        - Create a timer thread
        - Countdown from question_duration
        - Emit time updates to room
        - Auto-advance when time expires
        """
        # Set initial time
        self.time_remaining = self.question_duration
        
        # Define timer function
        def timer_countdown():
            while self.time_remaining > 0 and self.game_state == 'playing':
                time.sleep(1)
                self.time_remaining -= 1
                
                # Emit time update to all players
                emit('timer_update', {
                    'time_remaining': self.time_remaining
                }, room=self.room_id)
                
            # Time's up - handle timeout
            if self.time_remaining == 0 and self.game_state == 'playing':
                self.time_up()
        
        # Start timer in a new thread
        self.timer_thread = threading.Thread(target=timer_countdown)
        self.timer_thread.daemon = True  # Thread will stop when main program exits
        self.timer_thread.start()

    def broadcast_scores(self):
        """
        Send current scores to all players
        
        TODO:
        - Compile score data
        - Emit to all players in room
        """
        # Compile score data
        scores_data = {
            'scores': []
        }
        
        for player in self.players.values():
            player_score = {
                'name': player.name,
                'score': player.score,
                'session_id': player.session_id,
                'answered': player.answered
            }
            scores_data['scores'].append(player_score)
        
        # Sort by score (highest first)
        scores_data['scores'].sort(key=lambda x: x['score'], reverse=True)
        
        # Add current question info
        scores_data['current_question'] = self.current_question + 1
        scores_data['total_questions'] = len(self.questions)
        
        # Emit to all players in room
        emit('scores_update', scores_data, room=self.room_id)

# Utility functions
def generate_room_id():
    """
    Generate a unique room ID
    
    TODO:
    - Create a 6-character alphanumeric code
    - Ensure it's not already in use
    - Return the unique ID
    """
    unique_ID = f"{random.randint(0,999999):06d}"
    while unique_ID  in active_rooms:
        unique_ID = f"{random.randint(0,999999):06d}"
    
    return unique_ID
    
def load_questions(category_choosen):
    """
    Load questions from your JSON file
    
    TODO:
    - Read questions from file
    - Parse SQL data
    - Return list of questions
    """
    category_choosen = category_choosen.lower()
    try:
        # Connect to your database (adjust the path as needed)
        conn = sqlite3.connect('quiz_questions.db')
        cursor = conn.cursor()
        
        if category_choosen == 'all':
            cursor.execute('''
                SELECT id, question, correct_answer, wrong1, wrong2, wrong3, category
                FROM quiz_questions
            ''')
        elif category_choosen == 'premier league':
            cursor.execute('''
                SELECT id, question, correct_answer, wrong1, wrong2, wrong3, category
                FROM quiz_questions
                WHERE category = 'Premier League'
            ''')
        elif category_choosen == 'nba':
            cursor.execute('''
            SELECT id, question, correct_answer, wrong1, wrong2, wrong3, category
            FROM quiz_questions
            WHERE category = 'NBA'
            ''')
        
        rows = cursor.fetchall()
        questions = []
        
        for row in rows:
            # Create options list with correct answer and wrong answers
            options = [row[2], row[3], row[4], row[5]]  # correct_answer, wrong1, wrong2, wrong3
            
            question_data = {
                'id': row[0],
                'question': row[1],
                'correct_answer': row[2],
                'options': options,
                'category': row[6]
            }
            questions.append(question_data)
        
        conn.close()
        return questions
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return []
    except Exception as e:
        print(f"Error loading questions from database: {e}")
        return []

def validate_answer(question, submitted_answer):
    """
    Check if the submitted answer is correct
    
    TODO:
    - Compare submitted answer with correct answer
    - Return boolean result
    """
    if question['correct_answer'] == submitted_answer:
        return True
    else:
        return False

def correct_answer (player, correct_answer):
    if correct_answer == player.current_answer:
        points = max(0, 1000 - player.timetaken * 10)  # Ensure non-negative
        player.score += points

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """
    Handle new client connection
    
    TODO:
    - Log connection
    - Initialize player session if needed
    - Send connection acknowledgment
    """
    pass

@socketio.on('disconnect')
def handle_disconnect():
    """
    Handle client disconnection
    
    TODO:
    - Find player's room
    - Remove player from room
    - Notify other players
    - Clean up empty rooms
    """
    pass

@socketio.on('create_room')
def handle_create_room(data):
    """
    Create a new game room
    
    TODO:
    - Extract player name from data
    - Generate room ID
    - Create new GameRoom instance
    - Create Player instance for host
    - Add host to room
    - Join socket.io room
    - Send room info back to client
    """
    pass

@socketio.on('join_room')
def handle_join_room(data):
    """
    Join an existing game room
    
    TODO:
    - Extract room_id and player_name from data
    - Validate room exists and isn't full
    - Create Player instance
    - Add player to room
    - Join socket.io room
    - Notify other players
    - Send room state to joining player
    """
    pass

@socketio.on('leave_room')
def handle_leave_room(data):
    """
    Leave a game room
    
    TODO:
    - Find player's current room
    - Remove player from game room
    - Leave socket.io room
    - Notify other players
    - Handle host leaving
    """
    pass

@socketio.on('start_game')
def handle_start_game(data):
    """
    Start the game (host only)
    
    TODO:
    - Verify request is from host
    - Check minimum players requirement
    - Start the game
    - Send first question to all players
    """
    pass

@socketio.on('submit_answer')
def handle_submit_answer(data):
    """
    Handle answer submission
    
    TODO:
    - Extract room_id and answer from data
    - Submit answer to game room
    - Check if all players have answered
    - Send acknowledgment to player
    """
    pass

@socketio.on('request_next_question')
def handle_next_question(data):
    """
    Move to next question (host only)
    
    TODO:
    - Verify request is from host
    - Advance to next question
    - Or end game if no more questions
    """
    pass

@socketio.on('chat_message')
def handle_chat(data):
    """
    Handle chat messages in room
    
    TODO:
    - Extract message and room_id
    - Broadcast to all players in room
    - Include sender information
    """
    pass

# Error handlers
@socketio.on_error()
def error_handler(e):
    """
    Handle socket.io errors
    
    TODO:
    - Log error details
    - Send error message to client
    """
    pass

# Background tasks
def cleanup_empty_rooms():
    """
    Periodically clean up empty rooms
    
    TODO:
    - Run in background thread
    - Check for empty or abandoned rooms
    - Remove them from active_rooms
    """
    pass

def emit_to_room(room_id, event, data):
    """
    Utility function to emit to all players in a room
    
    TODO:
    - Use socketio.emit with room parameter
    - Handle any errors
    """
    pass

# HTTP routes (optional)
@app.route('/')
def index():
    """
    Basic index page
    
    TODO:
    - Return simple HTML or redirect
    """
    pass

@app.route('/health')
def health_check():
    """
    Health check endpoint
    
    TODO:
    - Return server status
    - Include active rooms count
    """
    pass

if __name__ == '__main__':
    # TODO: Start background cleanup thread
    # TODO: Load questions on startup
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)