from server_backend import GameRoom, Player, active_rooms, BotPlayer
from flask_socketio import emit, join_room, leave_room
import random
import threading
from datetime import datetime
import sqlite3

class HeadToHeadGame(GameRoom):
    """Special game room for 1v1 matches"""
    def __init__(self, room_id, host_id):
        """Initialize a head-to-head game room"""
        super().__init__(room_id, host_id)  # Call parent constructor
        self.max_players = 2
        self.game_type = "head_to_head"
        self.question_duration = 10  # Shorter for head-to-head
        self.num_questions = 10  # Fewer questions for quick matches
        self.head_to_head_stats = {}  # Track head-to-head specific stats
        self.first_to_answer = None  # Track who answered first each question
        self.bot_opponent = None  # To store BotPlayer instance if playing against AI
        
    def add_player(self, player):
        super().add_player(player)
        if isinstance(player, BotPlayer):
            self.bot_opponent = player
        return True

    def start_game(self):
        """Start head-to-head game with exactly 2 players (or 1 player + 1 bot)"""
        # Validate 1 human player if bot is present, or 2 human players
        human_players = [p for p in self.players.values() if not isinstance(p, BotPlayer)]
        if self.bot_opponent and len(human_players) != 1:
            emit('error', {'message': 'Cannot start Human vs Bot game without exactly one human player.'}, room=self.host_id)
            return False
        if not self.bot_opponent and len(self.players) != 2:
            emit('error', {'message': 'Head-to-head requires exactly two human players to start.'}, room=self.host_id)
            return False
            
        if self.game_state != "waiting":
            return False
        
        # Import load_questions from server_backend
        from server_backend import load_questions
        
        # Load questions
        all_questions = load_questions(self.category_choosen or 'all')
        
        if not all_questions:
            return False
        
        # Select fewer questions for head-to-head
        self.questions = random.sample(all_questions, min(self.num_questions, len(all_questions)))
        
        # Initialize game state
        self.game_state = "playing"
        self.current_question = 0
        
        # Reset players
        for player in self.players.values():
            player.score = 0
            player.answered = False
            player.current_answer = None
            
        # Initialize head-to-head stats
        for player_id in self.players:
            self.head_to_head_stats[player_id] = {
                'first_answers': 0,
                'correct_streak': 0,
                'max_streak': 0,
                'response_times': []
            }
        
        # Send first question
        self.send_current_question()
        
        # Start timer
        self.start_question_timer()
        
        # Notify game started
        emit('head_to_head_started', {
            'status': 'started',
            'total_questions': len(self.questions),
            'players': [p.to_dict() for p in self.players.values()]
        }, room=self.room_id)
        
        return True
    
    def send_current_question(self):
        super().send_current_question()  # Call parent method to send to human players
        # If playing against a bot, make the bot choose an answer after a delay
        if self.bot_opponent and self.game_state == "playing":
            current_question_obj = self.questions[self.current_question]
            options = current_question_obj['options']
            correct_answer = current_question_obj['correct_answer']
            
            chosen_answer, response_time = self.bot_opponent.choose_answer(options, correct_answer)
            
            # Schedule bot's answer submission
            threading.Timer(response_time, self._bot_submit_answer, args=[chosen_answer]).start()

    def _bot_submit_answer(self, answer):
        if self.bot_opponent and self.game_state == "playing" and not self.bot_opponent.answered:
            self.submit_answer(self.bot_opponent.session_id, answer)
            # Potentially emit an event that bot has answered, if UI needs to reflect this
            emit('player_answered', {'player_id': self.bot_opponent.session_id}, room=self.room_id)

    def end_game(self):
        """End the head-to-head game and declare winner"""
        # Call parent end_game
        super().end_game()
        
        # Determine winner
        players_list = list(self.players.values())
        if len(players_list) == 2:
            player1, player2 = players_list[0], players_list[1]
            
            winner = None
            if player1.score > player2.score:
                winner = player1
                margin = player1.score - player2.score
            elif player2.score > player1.score:
                winner = player2
                margin = player2.score - player1.score
            else:
                # Tie - use first answers as tiebreaker
                p1_first = self.head_to_head_stats[player1.session_id]['first_answers']
                p2_first = self.head_to_head_stats[player2.session_id]['first_answers']
                if p1_first > p2_first:
                    winner = player1
                elif p2_first > p1_first:
                    winner = player2
                margin = 0
            
            # Calculate statistics
            stats = {
                'winner': winner.to_dict() if winner else None,
                'is_tie': winner is None,
                'score_margin': margin if winner else 0,
                'players_stats': []
            }
            
            for player in [player1, player2]:
                player_stats = self.head_to_head_stats[player.session_id]
                avg_response_time = sum(player_stats['response_times']) / len(player_stats['response_times']) if player_stats['response_times'] else 0
                
                stats['players_stats'].append({
                    'player': player.to_dict(),
                    'first_answers': player_stats['first_answers'],
                    'max_streak': player_stats['max_streak'],
                    'avg_response_time': avg_response_time,
                    'accuracy': (player.score / (self.num_questions * 1000)) * 100  # Percentage of max possible score
                })
            
            # Update head-to-head records in database
            if winner:
                self.update_head_to_head_record(player1.session_id, player2.session_id, winner.session_id)
            
            # Emit special head-to-head results
            emit('head_to_head_ended', stats, room=self.room_id)
    
    def submit_answer(self, session_id, answer):
        """Process answer submission with head-to-head specific features"""
        # Get current state before calling parent
        player = self.players.get(session_id)  # Use .get for safety
        if not player:
            return {'status': 'error', 'message': 'Player not in this room'}
        
        # Track if this is the first answer for the question
        is_first_answer = not any(p.answered for p in self.players.values())
        
        # Call parent submit_answer
        result = super().submit_answer(session_id, answer)
        
        if result['status'] == 'success':
            # Track response time
            time_taken = self.question_duration - self.time_remaining
            self.head_to_head_stats[session_id]['response_times'].append(time_taken)
            
            # Track first answers
            if is_first_answer:
                self.first_to_answer = session_id
                self.head_to_head_stats[session_id]['first_answers'] += 1
                result['first_to_answer'] = True
            
            # Update streak
            if result['is_correct']:
                self.head_to_head_stats[session_id]['correct_streak'] += 1
                self.head_to_head_stats[session_id]['max_streak'] = max(
                    self.head_to_head_stats[session_id]['max_streak'],
                    self.head_to_head_stats[session_id]['correct_streak']
                )
            else:
                self.head_to_head_stats[session_id]['correct_streak'] = 0
            
            # Show live opponent status
            opponent_status = []
            for pid, p in self.players.items():
                if pid != session_id:
                    opponent_status.append({
                        'player_id': pid,
                        'name': p.name,
                        'answered': p.answered,
                        'score': p.score
                    })
            
            result['opponent_status'] = opponent_status
            result['current_streak'] = self.head_to_head_stats[session_id]['correct_streak']
        
        return result

class HeadToHeadMatchmaking:
    """Handle matchmaking for head-to-head games"""
    def __init__(self):
        """Initialize matchmaking system"""
        self.waiting_queue = []  # Players waiting for match
        self.queue_lock = threading.Lock()
        
    def add_to_queue(self, player_info):
        """Add player to matchmaking queue"""
        with self.queue_lock:
            # Check if player already in queue
            if not any(p['session_id'] == player_info['session_id'] for p in self.waiting_queue):
                self.waiting_queue.append(player_info)
                
                # Try to find match
                match = self.find_match(player_info)
                if match:
                    return {'status': 'matched', 'match': match}
                else:
                    return {'status': 'queued', 'position': len(self.waiting_queue)}
            else:
                return {'status': 'already_queued'}
    
    def find_match(self, player):
        """Find suitable opponent for player"""
        with self.queue_lock:
            # Simple matching - just find any other player
            for opponent in self.waiting_queue:
                if opponent['session_id'] != player['session_id']:
                    # Remove both from queue
                    self.waiting_queue.remove(player)
                    self.waiting_queue.remove(opponent)
                    
                    # Create game room
                    from server_backend import generate_room_id
                    room_id = generate_room_id()
                    
                    # Create head-to-head game
                    game = HeadToHeadGame(room_id, player['session_id'])
                    active_rooms[room_id] = game
                    
                    # Create player objects
                    player1 = Player(player['session_id'], player['name'])
                    player2 = Player(opponent['session_id'], opponent['name'])
                    
                    # Add players to game
                    game.add_player(player1)
                    game.add_player(player2)
                    
                    return {
                        'room_id': room_id,
                        'players': [player, opponent] # Send original player_info dicts
                    }
            
            return None
    
    def remove_from_queue(self, player_id):
        """Remove player from matchmaking queue"""
        with self.queue_lock:
            self.waiting_queue = [p for p in self.waiting_queue if p['session_id'] != player_id]

# Global matchmaking instance
matchmaking = HeadToHeadMatchmaking()

# Socket.IO event handlers for head-to-head
def register_head_to_head_handlers(socketio):
    """Register all head-to-head specific socket handlers"""
    
    @socketio.on('queue_head_to_head')
    def handle_queue_head_to_head(data):
        """Add player to head-to-head matchmaking queue"""
        from flask import request
        
        session_id = request.sid
        player_name = data.get('player_name', 'Anonymous')
        
        player_info = {
            'session_id': session_id,
            'name': player_name
        }
        
        result = matchmaking.add_to_queue(player_info)
        
        if result['status'] == 'matched':
            # Join the room
            room_id = result['match']['room_id']
            join_room(room_id)
            
            # Notify both players
            emit('match_found', {
                'room_id': room_id,
                'players': result['match']['players']
            }, room=room_id)
        else:
            emit('queue_status', result)
    
    @socketio.on('cancel_queue')
    def handle_cancel_queue():
        """Cancel head-to-head queue"""
        from flask import request
        
        session_id = request.sid
        matchmaking.remove_from_queue(session_id)
        
        emit('queue_cancelled', {'status': 'cancelled'})
    
    @socketio.on('create_private_head_to_head')
    def handle_create_private_head_to_head(data):
        """Create private head-to-head room with invite code, optionally vs Bot"""
        from flask import request
        from server_backend import generate_room_id
        
        session_id = request.sid
        player_name = data.get('player_name', 'Anonymous')
        play_vs_bot = data.get('vs_bot', False)
        bot_difficulty = data.get('bot_difficulty', 'medium')

        invite_code = generate_room_id()  # Use consistent room ID generation
        
        game = HeadToHeadGame(invite_code, session_id)
        active_rooms[invite_code] = game
        
        player = Player(session_id, player_name)
        game.add_player(player)
        join_room(invite_code, sid=session_id)

        if play_vs_bot:
            bot_id = f"bot_{generate_room_id(4)}"  # Unique ID for bot
            bot_name = random.choice(["QuizBot Alpha", "TriviaBot Beta", "QueryBot Gamma"])
            bot = BotPlayer(bot_id, bot_name, bot_difficulty)
            game.add_player(bot)
            emit('private_room_created', {
                'room_code': invite_code,
                'status': 'ready_to_start',  # Game can start immediately with bot
                'opponent_is_bot': True,
                'bot_name': bot_name
            }, room=session_id)
            # Automatically start the game if it's vs bot
            game.start_game()
        else:
            emit('private_room_created', {
                'room_code': invite_code,
                'status': 'waiting_for_opponent',
                'opponent_is_bot': False
            }, room=session_id)
    
    @socketio.on('join_private_head_to_head')
    def handle_join_private_head_to_head(data):
        """Join private head-to-head room with code"""
        from flask import request
        
        session_id = request.sid
        room_code = data.get('room_code', '').upper()
        player_name = data.get('player_name', 'Anonymous')
        
        # Check if room exists
        if room_code not in active_rooms:
            emit('error', {'message': 'Room not found'})
            return
        
        room = active_rooms[room_code]
        
        # Check if it's a head-to-head room
        if not isinstance(room, HeadToHeadGame):
            emit('error', {'message': 'Not a head-to-head room'})
            return
        
        # Check if room has space
        if len(room.players) >= room.max_players:
            emit('error', {'message': 'Room is full'})
            return
        
        # Add player
        player = Player(session_id, player_name)
        if room.add_player(player):
            join_room(room_code)
            
            # Notify all players
            emit('player_joined', {
                'player': player.to_dict(),
                'players': [p.to_dict() for p in room.players.values()]
            }, room=room_code)
            
            # Start game if room is full
            if len(room.players) == 2:
                emit('ready_to_start', {}, room=room_code)
        else:
            emit('error', {'message': 'Failed to join room'})
    
    @socketio.on('head_to_head_rematch')
    def handle_head_to_head_rematch(data):
        """Request rematch after head-to-head game"""
        from flask import request
        from server_backend import generate_room_id
        
        session_id = request.sid
        old_room_id = data.get('room_id')
        
        if old_room_id not in active_rooms:
            emit('error', {'message': 'Room not found'})
            return
        
        old_room = active_rooms[old_room_id]
        
        # Create new room for rematch
        new_room_id = generate_room_id()
        new_game = HeadToHeadGame(new_room_id, session_id)
        active_rooms[new_room_id] = new_game
        
        # Copy players from old room
        for player in old_room.players.values():
            new_player = Player(player.session_id, player.name)
            new_game.add_player(new_player)
            
            # Make players join new room
            leave_room(old_room_id, sid=player.session_id)
            join_room(new_room_id, sid=player.session_id)
        
        # Clean up old room
        del active_rooms[old_room_id]
        
        # Notify players of rematch
        emit('rematch_started', {
            'new_room_id': new_room_id,
            'players': [p.to_dict() for p in new_game.players.values()]
        }, room=new_room_id)

# Head-to-head statistics
class HeadToHeadStats:
    """Track player statistics for head-to-head games"""
    def __init__(self):
        """Initialize stats tracking"""
        self.db_path = 'quiz_questions.db'
        self.init_database()
    
    def init_database(self):
        """Initialize head-to-head stats tables"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables
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
            
            conn.commit()
            conn.close()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
    
    def record_match(self, player1_name, player2_name, winner_name, player1_score, player2_score):
        """Record head-to-head match result"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Update player 1 stats
            if winner_name == player1_name:
                cursor.execute('''
                    INSERT INTO head_to_head_stats (player_name, games_played, games_won, total_score, highest_score)
                    VALUES (?, 1, 1, ?, ?)
                    ON CONFLICT(player_name) DO UPDATE SET
                    games_played = games_played + 1,
                    games_won = games_won + 1,
                    total_score = total_score + ?,
                    highest_score = MAX(highest_score, ?)
                ''', (player1_name, player1_score, player1_score, player1_score, player1_score))
            elif winner_name == player2_name:
                cursor.execute('''
                    INSERT INTO head_to_head_stats (player_name, games_played, games_lost, total_score, highest_score)
                    VALUES (?, 1, 1, ?, ?)
                    ON CONFLICT(player_name) DO UPDATE SET
                    games_played = games_played + 1,
                    games_lost = games_lost + 1,
                    total_score = total_score + ?,
                    highest_score = MAX(highest_score, ?)
                ''', (player1_name, player1_score, player1_score, player1_score, player1_score))
            else:  # Tie
                cursor.execute('''
                    INSERT INTO head_to_head_stats (player_name, games_played, games_tied, total_score, highest_score)
                    VALUES (?, 1, 1, ?, ?)
                    ON CONFLICT(player_name) DO UPDATE SET
                    games_played = games_played + 1,
                    games_tied = games_tied + 1,
                    total_score = total_score + ?,
                    highest_score = MAX(highest_score, ?)
                ''', (player1_name, player1_score, player1_score, player1_score, player1_score))
            
            # Same for player 2
            if winner_name == player2_name:
                cursor.execute('''
                    INSERT INTO head_to_head_stats (player_name, games_played, games_won, total_score, highest_score)
                    VALUES (?, 1, 1, ?, ?)
                    ON CONFLICT(player_name) DO UPDATE SET
                    games_played = games_played + 1,
                    games_won = games_won + 1,
                    total_score = total_score + ?,
                    highest_score = MAX(highest_score, ?)
                ''', (player2_name, player2_score, player2_score, player2_score, player2_score))
            elif winner_name == player1_name:
                cursor.execute('''
                    INSERT INTO head_to_head_stats (player_name, games_played, games_lost, total_score, highest_score)
                    VALUES (?, 1, 1, ?, ?)
                    ON CONFLICT(player_name) DO UPDATE SET
                    games_played = games_played + 1,
                    games_lost = games_lost + 1,
                    total_score = total_score + ?,
                    highest_score = MAX(highest_score, ?)
                ''', (player2_name, player2_score, player2_score, player2_score, player2_score))
            else:  # Tie
                cursor.execute('''
                    INSERT INTO head_to_head_stats (player_name, games_played, games_tied, total_score, highest_score)
                    VALUES (?, 1, 1, ?, ?)
                    ON CONFLICT(player_name) DO UPDATE SET
                    games_played = games_played + 1,
                    games_tied = games_tied + 1,
                    total_score = total_score + ?,
                    highest_score = MAX(highest_score, ?)
                ''', (player2_name, player2_score, player2_score, player2_score, player2_score))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Database error: {e}")
    
    def get_player_stats(self, player_name):
        """Get head-to-head stats for a player"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM head_to_head_stats WHERE player_name = ?
            ''', (player_name,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'player_name': result[0],
                    'games_played': result[1],
                    'games_won': result[2],
                    'games_lost': result[3],
                    'games_tied': result[4],
                    'total_score': result[5],
                    'highest_score': result[6],
                    'win_percentage': (result[2] / result[1] * 100) if result[1] > 0 else 0
                }
            
            return None
            
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return None
    
    def get_head_to_head_history(self, player1_name, player2_name):
        """Get history between two specific players"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM head_to_head_records 
                WHERE (player1_name = ? AND player2_name = ?) 
                   OR (player1_name = ? AND player2_name = ?)
                ORDER BY date DESC
                LIMIT 10
            ''', (player1_name, player2_name, player2_name, player1_name))
            
            results = cursor.fetchall()
            conn.close()
            
            history = []
            for row in results:
                history.append({
                    'player1_name': row[1],
                    'player2_name': row[2],
                    'winner_name': row[3],
                    'date': row[4],
                    'player1_score': row[5],
                    'player2_score': row[6]
                })
            
            return history
            
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []

# Initialize global stats tracker
head_to_head_stats = HeadToHeadStats()