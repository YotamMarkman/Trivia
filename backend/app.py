import os
import sqlite3
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS # Import CORS
import random
import time

# Configure Flask to serve static files from frontend directory
frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app) # Enable CORS for all routes

# Use environment variables for production
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secret!')
socketio = SocketIO(app, cors_allowed_origins="*")

# Use environment variable for database path in production
DATABASE_PATH = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), '..', 'quiz_questions.db'))
print(f"Database path configured to: {DATABASE_PATH}") # New log

def get_db_connection():
    print(f"Attempting to connect to database at: {DATABASE_PATH}") # New log
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        print("Database connection successful.") # New log
        return conn
    except sqlite3.Error as e:
        print(f"Error connecting to database: {e}") # New log
        return None

@app.route('/api/questions', methods=['GET'])
def get_questions():
    category = request.args.get('category')
    conn = get_db_connection()
    if category:
        cursor = conn.execute('SELECT * FROM quiz_questions WHERE category = ?', (category,))
    else:
        cursor = conn.execute('SELECT * FROM quiz_questions')
    questions = cursor.fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in questions])

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    cursor = conn.execute('SELECT DISTINCT category FROM quiz_questions')
    categories = [row['category'] for row in cursor.fetchall()]
    conn.close()
    return jsonify(categories)

# Route to serve the main HTML file
@app.route('/')
def serve_index():
    return send_from_directory(frontend_dir, 'index.html')

# Route to serve static files (CSS, JS, images, etc.)
@app.route('/<path:filename>')
def serve_static_files(filename):
    return send_from_directory(frontend_dir, filename)

# Game state
games = {}
leaderboard = [] # In-memory leaderboard for simplicity

# --- SocketIO Events ---
@socketio.on('connect')
def handle_connect():
    print('Client connected:', request.sid)

@socketio.on('configure_game')
def handle_configure_game(data):
    game_id = data.get('game_id')
    game = games.get(game_id)

    if not game or game['host_sid'] != request.sid:
        emit('error', {'message': 'Only the host can configure the game.'}, room=request.sid)
        return

    # Update game settings based on host's input
    game['max_players'] = int(data.get('max_players', game['max_players']))
    game['num_bots'] = int(data.get('num_bots', game['num_bots']))
    game['selected_categories'] = data.get('categories', game['selected_categories'])

    # Validate and set time_per_question
    default_time_per_question = game.get('time_per_question', 15)
    try:
        time_val = int(data.get('time_per_question', default_time_per_question))
        game['time_per_question'] = max(5, min(60, time_val))  # Clamp: 5-60 seconds
    except (ValueError, TypeError):
        game['time_per_question'] = max(5, min(60, default_time_per_question)) # Fallback to clamped default

    # Validate and set total_questions
    default_total_questions = game.get('total_questions', 10)
    try:
        total_val = int(data.get('total_questions', default_total_questions))
        game['total_questions'] = max(5, min(50, total_val))  # Clamp: 5-50 questions
    except (ValueError, TypeError):
        game['total_questions'] = max(5, min(50, default_total_questions)) # Fallback to clamped default

    # Adjust bots based on new num_bots
    current_bot_count = len(game['bots'])
    if game['num_bots'] > current_bot_count:
        for i in range(current_bot_count, game['num_bots']):
            bot_id = f"bot_{i+1}"
            bot_name = f"Bot {i+1}"
            game['bots'][bot_id] = {'name': bot_name, 'score': 0, 'lifelines_used': {'fifty_fifty': False, 'ninetieth_minute': False, 'feelin_good': False}, 'feelin_good_active': False}
            game['scores'][bot_name] = 0
            print(f"Added {bot_name} to game {game_id} due to configuration change.")
    elif game['num_bots'] < current_bot_count:
        bots_to_remove = list(game['bots'].keys())[game['num_bots']:]
        for bot_id in bots_to_remove:
            bot_name = game['bots'][bot_id]['name']
            del game['bots'][bot_id]
            if bot_name in game['scores']:
                del game['scores'][bot_name]
            print(f"Removed {bot_name} from game {game_id} due to configuration change.")

    print(f"Game {game_id} configured by host. Settings: {game}")
    emit('game_configured', {'game_id': game_id, 'settings': {
        'max_players': game['max_players'],
        'num_bots': game['num_bots'],
        'categories': game['selected_categories'],
        'time_per_question': game['time_per_question'],
        'total_questions': game['total_questions'],
        'players': get_player_list(game_id) # Send updated player list including bots
    }}, room=game_id) # Broadcast to all in room so UI can update

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected:', request.sid)
    # Handle player leaving a game if they were in one
    for game_id, game in list(games.items()):
        if request.sid in game['players']:
            player_name = game['players'][request.sid]['name']
            emit('player_left', {'name': player_name, 'sid': request.sid}, room=game_id)
            del game['players'][request.sid]
            if not game['players'] and game['game_mode'] != 'singleplayer': # or if all human players left
                print(f"Game {game_id} ended as last player left.")
                # Potentially save game state or clean up
                del games[game_id]
            break


@socketio.on('create_game')
def handle_create_game(data):
    game_id = str(random.randint(1000, 9999))
    player_name = data.get('name', 'Player 1')
    game_mode = data.get('game_mode', 'singleplayer') # singleplayer, head_to_head, multiplayer
    num_bots = int(data.get('num_bots', 0))
    max_players = int(data.get('max_players', 1 if game_mode == 'singleplayer' else (2 if game_mode == 'head_to_head' else 8)))
    categories = data.get('categories', ['all']) # New: Get categories for the game

    games[game_id] = {
        'players': {},
        'host_sid': request.sid,
        'game_mode': game_mode,
        'questions': [],
        'current_question_index': -1,
        'scores': {},
        'timers': {},
        'chat': [],
        'max_players': max_players,
        'num_bots': num_bots,
        'bots': {},
        'selected_categories': categories, # New: Store selected categories
        'player_answers': {}, # New: To store answers for the current question
        'lifelines_used_by_player': {}, # To track lifeline usage per player SID
        'feelin_good_active_for_player': {} # SID: True if Feelin' Good is active for next correct answer
    }
    join_room(game_id)
    games[game_id]['players'][request.sid] = {'name': player_name, 'score': 0, 'sid': request.sid, 'lifelines_used': {'fifty_fifty': False, 'ninetieth_minute': False, 'feelin_good': False}}
    games[game_id]['scores'][player_name] = 0
    games[game_id]['lifelines_used_by_player'][request.sid] = {'fifty_fifty': False, 'ninetieth_minute': False, 'feelin_good': False}
    games[game_id]['feelin_good_active_for_player'][request.sid] = False

    print(f"Game {game_id} created by {player_name} (SID: {request.sid}). Mode: {game_mode}, Max Players: {max_players}, Bots: {num_bots}, Categories: {categories}")

    # Add bots if any
    for i in range(num_bots):
        bot_id = f"bot_{i+1}_{game_id}" # Ensure bot_id is unique across games if bots dict becomes global
        bot_name = f"Bot {i+1}"
        games[game_id]['bots'][bot_id] = {'name': bot_name, 'score': 0, 'lifelines_used': {'fifty_fifty': False, 'ninetieth_minute': False, 'feelin_good': False}, 'feelin_good_active': False}
        games[game_id]['scores'][bot_name] = 0
        print(f"Added {bot_name} to game {game_id}")

    emit('game_created', {'game_id': game_id, 'host_name': player_name, 'game_mode': game_mode, 'players': get_player_list(game_id)}, room=request.sid)
    emit('player_joined', {'name': player_name, 'sid': request.sid, 'is_host': True, 'players': get_player_list(game_id)}, room=game_id)


@socketio.on('join_game')
def handle_join_game(data):
    game_id = data.get('game_id')
    player_name = data.get('name', f'Player {len(games.get(game_id, {}).get("players", {})) + 1}')
    game = games.get(game_id)

    if not game:
        emit('error', {'message': 'Game not found.'}, room=request.sid)
        return

    if len(game['players']) >= game['max_players']:
        emit('error', {'message': 'Game room is full.'}, room=request.sid)
        return

    join_room(game_id)
    game['players'][request.sid] = {'name': player_name, 'score': 0, 'sid': request.sid, 'lifelines_used': {'fifty_fifty': False, 'ninetieth_minute': False, 'feelin_good': False}}
    game['scores'][player_name] = 0
    game['lifelines_used_by_player'][request.sid] = {'fifty_fifty': False, 'ninetieth_minute': False, 'feelin_good': False}
    game['feelin_good_active_for_player'][request.sid] = False
    print(f"{player_name} (SID: {request.sid}) joined game {game_id}")
    emit('player_joined', {'name': player_name, 'sid': request.sid, 'is_host': False, 'players': get_player_list(game_id)}, room=game_id)
    emit('game_joined', {'game_id': game_id, 'players': get_player_list(game_id), 'chat_history': game.get('chat', [])}, room=request.sid)


def get_player_list(game_id):
    game = games.get(game_id)
    if not game:
        return []
    player_list = [{'name': p_info['name'], 'score': p_info['score'], 'sid': sid, 'is_bot': False} for sid, p_info in game['players'].items()]
    player_list.extend([{'name': b_info['name'], 'score': b_info['score'], 'sid': bid, 'is_bot': True} for bid, b_info in game['bots'].items()])
    return player_list


@socketio.on('start_game')
def handle_start_game(data):
    game_id = data.get('game_id')
    game = games.get(game_id)

    if not game or game['host_sid'] != request.sid:
        emit('error', {'message': 'Only the host can start the game.'}, room=request.sid)
        return

    print(f"Attempting to start game {game_id}. Fetching questions...") # New log
    conn = get_db_connection()
    if not conn:
        emit('error', {'message': 'Database connection failed.'}, room=game_id)
        print(f"Failed to start game {game_id} due to DB connection error.") # New log
        return

    num_questions_to_fetch = 30 if game['game_mode'] == 'singleplayer' else 10
    selected_categories = game.get('selected_categories', ['all'])
    query = 'SELECT * FROM quiz_questions'
    params = []

    if selected_categories and 'all' not in selected_categories:
        placeholders = ', '.join('?' for _ in selected_categories)
        query += f' WHERE category IN ({placeholders})'
        params.extend(selected_categories)
    
    query += ' ORDER BY RANDOM() LIMIT ?'
    params.append(num_questions_to_fetch)

    try:
        print(f"Executing query: {query} with params: {params}") # Log query and params
        cursor = conn.execute(query, tuple(params))
        fetched_questions = [dict(q) for q in cursor.fetchall()]
        if fetched_questions: # New: Check if any questions were fetched
            print(f"Sample fetched question structure: {fetched_questions[0].keys()}") # New: Log keys of the first question
        game['questions'] = fetched_questions
        print(f"Fetched {len(game['questions'])} questions from DB for game {game_id} based on categories: {selected_categories}.")
    except sqlite3.Error as e:
        print(f"Error fetching questions from DB: {e}") # New log
        emit('error', {'message': f'Error fetching questions: {e}'}, room=game_id)
        game['questions'] = [] # Ensure it's an empty list on error
    finally:
        conn.close()
        print("Database connection closed after fetching questions.") # New log

    if not game['questions']:
        emit('error', {'message': 'No questions found for the game. Please check database and table.'}, room=game_id) # Modified message
        print(f"No questions loaded for game {game_id}. Game will not start properly.") # New log
        return

    game['current_question_index'] = -1
    game['scores'] = {p_info['name']: 0 for p_info in game['players'].values()}
    for bot_name in game['bots']:
        game['scores'][bot_name] = 0

    print(f"Game {game_id} started by host. Total questions: {len(game['questions'])}")
    emit('game_started', {'game_id': game_id, 'total_questions': len(game['questions']), 'players': get_player_list(game_id)}, room=game_id)
    send_next_question(game_id)


def send_next_question(game_id):
    game = games.get(game_id)
    if not game:
        return

    game['current_question_index'] += 1
    # Check if game still exists and if current_question_index is valid
    if game['current_question_index'] >= len(game.get('questions', [])):
        end_game(game_id)
        return

    question_data = game['questions'][game['current_question_index']]
    answers = [question_data['correct_answer'], question_data['wrong1'], question_data['wrong2'], question_data['wrong3']]
    random.shuffle(answers)

    # Mask correct answer for client
    current_question_for_client = {
        'id': question_data['id'],
        'question': question_data['question'],
        'answers': answers,
        'category': question_data['category'],
        'question_number': game['current_question_index'] + 1,
        'total_questions': len(game['questions']),
        'time_per_question': game.get('time_per_question', 15)
    }

    game['question_start_time'] = time.time()
    game['player_answers'][game['current_question_index']] = {} # Reset answers for new question
    # Store the correct answer on the server side for verification
    game['current_correct_answer'] = question_data['correct_answer']

    socketio.emit('new_question', current_question_for_client, room=game_id)
    print(f"Sent question {game['current_question_index'] + 1} for game {game_id}")

    # Bot answers (if any)
    if game['bots']:
        # Ensure bots only answer if the game hasn't ended (e.g. by a quick disconnect)
        if game_id in games and game['current_question_index'] < len(game.get('questions', [])):
            socketio.start_background_task(target=bots_answer, game_id=game_id, question_data=question_data)

def delayed_send_next_question(game_id, delay=5):
    game = games.get(game_id)
    if not game:
        print(f"Game {game_id} not found for delayed_send_next_question.")
        return
    print(f"Starting {delay}s delay before next question for game {game_id}")
    socketio.sleep(delay)
    # Check if game still exists after delay, e.g. not cleaned up by disconnect
    if game_id in games:
        print(f"Delay finished for game {game_id}. Sending next question.")
        send_next_question(game_id)
    else:
        print(f"Game {game_id} no longer exists after delay. Not sending next question.")


def bots_answer(game_id, question_data):
    game = games.get(game_id)
    if not game: return

    for bot_id, bot_info in list(game['bots'].items()): # Use list() for safe iteration if modifying
        # Ensure bot still exists in game (could be removed by config change)
        if bot_id not in game['bots']:
            continue

        # Bot decision-making delay
        socketio.sleep(random.uniform(1, game.get('time_per_question', 15) * 0.6))

        # Check if game still exists and question is current before bot acts
        if game_id not in games or game['current_question_index'] >= len(game.get('questions', [])):
            print(f"Bot {bot_info['name']} skipped acting as game ended or question changed.")
            continue
        
        current_q_data_for_bot = game['questions'][game['current_question_index']]
        correct_answer_for_bot = current_q_data_for_bot['correct_answer']
        all_incorrect_for_bot = [current_q_data_for_bot['wrong1'], current_q_data_for_bot['wrong2'], current_q_data_for_bot['wrong3']]

        # Lifeline decisions for bot
        used_fifty_fifty_this_turn = False
        used_ninetieth_minute_this_turn = False
        activated_feelin_good_this_turn = False # New flag for bot's Feelin' Good usage

        if game['game_mode'] in ['head_to_head', 'multiplayer']:
            # 50:50 Lifeline for Bot
            if not bot_info['lifelines_used'].get('fifty_fifty', False) and not bot_info.get('feelin_good_active', False):
                if random.random() < 0.20: # 20% chance to use 50:50 if available
                    bot_info['lifelines_used']['fifty_fifty'] = True
                    used_fifty_fifty_this_turn = True
                    print(f"Bot {bot_info['name']} in game {game_id} is using 50:50 lifeline.")

            # 90th Minute Lifeline for Bot
            if not bot_info['lifelines_used'].get('ninetieth_minute', False) and not bot_info.get('feelin_good_active', False):
                chance_to_use_90th = 0.15 # Base 15% chance
                questions_remaining = len(game['questions']) - game['current_question_index']
                if questions_remaining <= max(2, len(game['questions']) * 0.25):
                    chance_to_use_90th = 0.30
                
                if random.random() < chance_to_use_90th:
                    bot_info['lifelines_used']['ninetieth_minute'] = True
                    used_ninetieth_minute_this_turn = True
                    print(f"Bot {bot_info['name']} in game {game_id} is using 90th Minute lifeline.")
            
            # Feelin' Good Lifeline for Bot (can only be activated if not already active)
            if not bot_info['lifelines_used'].get('feelin_good', False) and not bot_info.get('feelin_good_active', False):
                if random.random() < 0.10: # 10% chance to use Feelin' Good if available
                    bot_info['lifelines_used']['feelin_good'] = True
                    bot_info['feelin_good_active'] = True # Activate it for the bot
                    activated_feelin_good_this_turn = True
                    print(f"Bot {bot_info['name']} in game {game_id} is activating Feelin' Good lifeline.")

        # Determine bot's answer based on lifelines
        answer = None
        # Bot prioritizes 90th minute if used
        if used_ninetieth_minute_this_turn:
            answer = correct_answer_for_bot
        elif used_fifty_fifty_this_turn:
            kept_incorrect = random.choice(all_incorrect_for_bot)
            if random.random() < 0.85: 
                answer = correct_answer_for_bot
            else:
                answer = kept_incorrect
        else:
            # Original bot logic: 70% chance of correct answer
            is_bot_correct_this_time = random.random() < 0.70
            answer = correct_answer_for_bot if is_bot_correct_this_time else random.choice(all_incorrect_for_bot)
        
        # Simulate bot submitting answer
        if game_id in games and game['current_question_index'] < len(game.get('questions', [])) and \
           game['questions'][game['current_question_index']]['id'] == current_q_data_for_bot['id']:
            handle_submit_answer({'game_id': game_id, 'answer': answer, 'timestamp': time.time()}, bot_id=bot_id)
        else:
            print(f"Bot {bot_info['name']} did not submit answer as game/question state changed after lifeline decision.")


@socketio.on('submit_answer')
def handle_submit_answer(data, bot_id=None): # bot_id is internal for bot submissions
    game_id = data.get('game_id')
    answer = data.get('answer')
    timestamp = data.get('timestamp') # Get timestamp from client
    player_sid = request.sid if not bot_id else bot_id # Use bot_id if provided

    game = games.get(game_id)
    if not game:
        emit('error', {'message': 'Game not found.'}, room=player_sid if not bot_id else None)
        return

    current_q_index = game['current_question_index']
    # Prevent duplicate/late submissions for human players
    if not bot_id and player_sid in game['player_answers'].get(current_q_index, {}):
        print(f"Player {player_sid} already answered question {current_q_index} in game {game_id}.")
        return

    time_since_question_start = time.time() - game.get('question_start_time', 0)
    allowed_time = game.get('time_per_question', 15) + 2 # Add a small buffer for network
    if answer != "__TIMEOUT__" and time_since_question_start > allowed_time:
        print(f"Player {player_sid} submitted answer too late for question {current_q_index} in game {game_id}.")
        answer = "__TIMEOUT__" # Force to timeout if server deems it too late

    player_info = game['players'].get(player_sid) if not bot_id else game['bots'].get(bot_id)
    if not player_info:
        print(f"Player/Bot {player_sid} not found in game {game_id}")
        return

    player_name = player_info['name']
    
    # Store the answer
    if current_q_index not in game['player_answers']:
        game['player_answers'][current_q_index] = {}
    game['player_answers'][current_q_index][player_sid] = {'answer': answer, 'timestamp': timestamp, 'name': player_name}

    # If Feelin' Good was active for this player/bot, it's consumed now, regardless of answer.
    # The bonus is applied below if the answer is correct.
    feelin_good_was_active_for_this_submission = False
    if not bot_id and game['feelin_good_active_for_player'].get(player_sid, False):
        feelin_good_was_active_for_this_submission = True
        game['feelin_good_active_for_player'][player_sid] = False # Consume it
    elif bot_id and player_info.get('feelin_good_active', False):
        feelin_good_was_active_for_this_submission = True
        player_info['feelin_good_active'] = False # Consume it for bot

    if not bot_id:
        time_taken = time.time() - game.get('question_start_time', time.time())
        is_correct = (answer == game.get('current_correct_answer')) and (answer != "__TIMEOUT__")

        score_earned = 0
        if is_correct:
            time_limit = game.get('time_per_question', 15)
            effective_time_taken = min(time_taken, time_limit)
            score_earned = max(10, int(100 - (effective_time_taken / time_limit) * 90))
            
            bonus_points = 0
            if feelin_good_was_active_for_this_submission:
                bonus_points = score_earned # Double the points
                score_earned += bonus_points
                print(f"Player {player_name} got Feelin' Good bonus of {bonus_points} points!")
                emit('feelin_good_bonus', {'bonus_points': bonus_points}, room=player_sid)
            
            game['scores'][player_name] = game['scores'].get(player_name, 0) + score_earned
            game['players'][player_sid]['score'] = game['scores'][player_name]
        elif feelin_good_was_active_for_this_submission: # Incorrect answer but FG was active
            emit('feelin_good_expired', room=player_sid) # Inform client FG expired without bonus

        print(f"Player {player_name} in game {game_id} answered: {answer}. Correct: {is_correct}. Score earned: {score_earned}. Timestamp: {timestamp}")
        
        emit('answer_result', {
            'correct': is_correct,
            'correct_answer': game.get('current_correct_answer'),
            'score_earned': score_earned,
            'your_total_score': game['scores'][player_name]
        }, room=player_sid)

    elif bot_id and answer != "__TIMEOUT__":
        is_correct = (answer == game.get('current_correct_answer'))
        score_earned_bot = 0 # Initialize score for bot for this answer
        if is_correct:
            score_earned_bot = random.randint(50, 90) # Bots get a random score if correct
            
            if feelin_good_was_active_for_this_submission:
                bonus_points_bot = score_earned_bot # Double points for bot
                score_earned_bot += bonus_points_bot
                print(f"Bot {player_name} got Feelin' Good bonus of {bonus_points_bot} points!")
                # No need to emit 'feelin_good_bonus' to bot, but log is good

            game['scores'][player_name] = game['scores'].get(player_name, 0) + score_earned_bot
            game['bots'][bot_id]['score'] = game['scores'][player_name]
        elif feelin_good_was_active_for_this_submission: # Incorrect answer but FG was active for bot
            print(f"Bot {player_name}'s Feelin' Good expired without bonus.")
            # No client-side event needed for bot's FG expiry

        print(f"Bot {player_name} in game {game_id} answered: {answer}. Correct: {is_correct}. Score earned: {score_earned_bot}")

    # Check if it's time to proceed to the next question's answer display period
    proceed_to_show_answer_phase = False
    game_mode = game['game_mode']
    proceeded_flag_key = f'q_{current_q_index}_proceeded'

    if game.get(proceeded_flag_key, False):
        print(f"Question {current_q_index} in game {game_id} has already proceeded. Current submission by {player_name} will not re-trigger phase transition.")
    else:
        if game_mode == 'multiplayer':
            human_player_sids = [sid for sid in game['players'].keys()]
            answered_sids_for_current_q = game['player_answers'].get(current_q_index, {}).keys()
            all_human_players_answered = True
            if not human_player_sids: # No human players left (e.g. all disconnected)
                all_human_players_answered = False # Or handle this scenario differently, maybe end game?
                # For now, if no human players, bots might be playing alone, let them proceed if they are the only ones.
                if not game['players'] and game['bots']:
                    # Check if all bots have answered
                    bot_sids = [sid for sid in game['bots'].keys()]
                    all_bots_answered = True
                    for b_sid in bot_sids:
                        if b_sid not in answered_sids_for_current_q:
                            all_bots_answered = False
                            break
                    if all_bots_answered:
                        proceed_to_show_answer_phase = True
                        print(f"All bots have answered (no humans) for question {current_q_index} in game {game_id}. Proceeding.")

            else:
                for sid in human_player_sids:
                    if sid not in answered_sids_for_current_q:
                        all_human_players_answered = False
                        break
                if all_human_players_answered:
                    proceed_to_show_answer_phase = True
                    print(f"All human players have answered question {current_q_index} in game {game_id}. Proceeding to show answer phase.")
                else:
                    print(f"Waiting for other players to answer question {current_q_index} in game {game_id}.")

        elif game_mode == 'singleplayer':
            if not bot_id: # Only human player's submission triggers next phase
                proceed_to_show_answer_phase = True
                print(f"Single player answered question {current_q_index}. Proceeding to show answer phase.")

        elif game_mode == 'head_to_head':
            total_participants = len(game['players']) + len(game['bots'])
            if len(game['player_answers'].get(current_q_index, {})) == total_participants:
                proceed_to_show_answer_phase = True
                print(f"All H2H participants answered question {current_q_index}. Proceeding to show answer phase.")
            else:
                print(f"H2H: Waiting for all participants for question {current_q_index} in game {game_id}.")

    if proceed_to_show_answer_phase and not game.get(proceeded_flag_key, False):
        game[proceeded_flag_key] = True # Set the flag immediately

        if game_mode != 'singleplayer': # Scores are relevant for multiplayer & H2H
             # Changed event name to 'scoreboard_update' and payload to be the direct player list
             socketio.emit('scoreboard_update', get_player_list(game_id), room=game_id)
        
        inter_question_delay = 5 # Default for multiplayer and H2H vs Player
        if game_mode == 'singleplayer':
            inter_question_delay = 2
        elif game_mode == 'head_to_head' and game.get('num_bots', 0) == 1:
            # This implies a H2H game against a single bot
            inter_question_delay = 2
        
        # Signal start of the answer display period
        socketio.emit('show_answer_period_start', {
            'duration': inter_question_delay,
            'correct_answer': game.get('current_correct_answer')
        }, room=game_id)
        
        # Start background task for delayed next question
        socketio.start_background_task(target=delayed_send_next_question, game_id=game_id, delay=inter_question_delay)


@socketio.on('use_lifeline')
def handle_use_lifeline(data):
    game_id = data.get('game_id')
    lifeline_type = data.get('lifeline_type')
    player_sid = request.sid

    game = games.get(game_id)
    if not game:
        emit('error', {'message': 'Game not found for lifeline.'}, room=player_sid)
        return

    player_info = game['players'].get(player_sid)
    if not player_info:
        emit('error', {'message': 'Player not found for lifeline.'}, room=player_sid)
        return

    if lifeline_type == 'fifty_fifty':
        if player_info['lifelines_used'].get('fifty_fifty', False):
            emit('error', {'message': '50:50 lifeline already used.'}, room=player_sid)
            return

        if game['current_question_index'] < 0 or game['current_question_index'] >= len(game['questions']):
            emit('error', {'message': 'No active question for lifeline.'}, room=player_sid)
            return
        
        player_info['lifelines_used']['fifty_fifty'] = True
        # Also update the game-level tracking if you still use it, though per-player is primary
        if player_sid in game['lifelines_used_by_player']:
             game['lifelines_used_by_player'][player_sid]['fifty_fifty'] = True


        current_question_details = game['questions'][game['current_question_index']]
        correct_answer = current_question_details['correct_answer']
        incorrect_answers = [current_question_details['wrong1'], current_question_details['wrong2'], current_question_details['wrong3']]
        
        # Ensure incorrect_answers doesn't somehow contain the correct_answer if data is bad
        incorrect_answers = [ans for ans in incorrect_answers if ans != correct_answer]
        
        if len(incorrect_answers) < 2: # Should not happen with valid question data
            emit('error', {'message': 'Not enough incorrect answers to use 50:50.'}, room=player_sid)
            # Potentially revert lifeline usage if this is a critical error
            # player_info['lifelines_used']['fifty_fifty'] = False 
            return

        # Randomly choose one incorrect answer to keep
        kept_incorrect = random.choice(incorrect_answers)
        
        # The other incorrect answers are to be disabled
        disabled_answers = [ans for ans in incorrect_answers if ans != kept_incorrect]
        
        # If there were initially 3 unique incorrect answers, disabled_answers will now have 2.
        # If there were only 2 unique incorrect answers (e.g. a True/False question was badly formatted as 4 options),
        # this logic would still pick one to keep and one to disable.
        # For safety, ensure we only send up to two to disable.
        
        emit('fifty_fifty_result', {'disabled_answers': disabled_answers[:2]}, room=player_sid)
        print(f"Player {player_info['name']} (SID: {player_sid}) used 50:50. Disabling: {disabled_answers[:2]}. Keeping: {kept_incorrect} alongside {correct_answer}.")

    elif lifeline_type == 'ninetieth_minute':
        if player_info['lifelines_used'].get('ninetieth_minute', False):
            emit('error', {'message': '90th Minute lifeline already used.'}, room=player_sid)
            return

        if game['current_question_index'] < 0 or game['current_question_index'] >= len(game['questions']):
            emit('error', {'message': 'No active question for 90th Minute lifeline.'}, room=player_sid)
            return
        
        player_info['lifelines_used']['ninetieth_minute'] = True
        if player_sid in game['lifelines_used_by_player']:
             game['lifelines_used_by_player'][player_sid]['ninetieth_minute'] = True

        current_question_details = game['questions'][game['current_question_index']]
        correct_answer_text = current_question_details['correct_answer']
        
        emit('ninetieth_minute_result', {'correct_answer_text': correct_answer_text}, room=player_sid)
        print(f"Player {player_info['name']} (SID: {player_sid}) used 90th Minute. Correct answer: {correct_answer_text} revealed to them.")
    
    elif lifeline_type == 'feelin_good':
        if player_info['lifelines_used'].get('feelin_good', False):
            emit('error', {'message': 'Feelin\' Good lifeline already used.'}, room=player_sid)
            return
        
        if game['feelin_good_active_for_player'].get(player_sid, False):
            emit('error', {'message': 'Feelin\' Good is already active for you.'}, room=player_sid)
            return

        player_info['lifelines_used']['feelin_good'] = True
        game['feelin_good_active_for_player'][player_sid] = True
        if player_sid in game['lifelines_used_by_player']:
             game['lifelines_used_by_player'][player_sid]['feelin_good'] = True
        
        emit('feelin_good_active', room=player_sid) # Inform client it's active
        print(f"Player {player_info['name']} (SID: {player_sid}) activated Feelin' Good lifeline.")
    
    # elif lifeline_type == 'another_lifeline':
    #     pass # Future lifelines


def end_game(game_id):
    game = games.get(game_id)
    if not game:
        return

    final_scores = game['scores']
    sorted_scores = sorted(final_scores.items(), key=lambda item: item[1], reverse=True)

    winner_info = {}
    if not sorted_scores:
        winner_info = {'isDraw': True, 'message': "No scores recorded."}
    elif len(sorted_scores) == 1:
        winner_info = {'winnerName': sorted_scores[0][0]}
    else:
        if sorted_scores[0][1] == sorted_scores[1][1]:
            is_complete_draw = all(score == sorted_scores[0][1] for _, score in sorted_scores)
            if is_complete_draw and len(sorted_scores) > 1:
                 winner_info = {'isDraw': True, 'message': "It's a draw among all players!"}
            elif len(sorted_scores) > 1 and sorted_scores[0][1] > 0 :
                 winner_info = {'isDraw': True, 'message': f"It's a draw between top players like {sorted_scores[0][0]}!"}
            elif sorted_scores[0][1] == 0:
                 winner_info = {'isDraw': True, 'message': "It's a draw! No points scored."}
            else:
                 winner_info = {'isDraw': True, 'message': "It's a draw!"}
        else:
            winner_info = {'winnerName': sorted_scores[0][0]}

    print(f"Game {game_id} ended. Final scores: {sorted_scores}. Winner info: {winner_info}")
    socketio.emit('game_over', {'scores': sorted_scores, 'game_id': game_id, 'winner_info': winner_info}, room=game_id)

    if game['game_mode'] == 'singleplayer':
        player_sid = list(game['players'].keys())[0]
        player_name = game['players'][player_sid]['name']
        player_score = game['scores'][player_name]
        leaderboard.append({'name': player_name, 'score': player_score, 'timestamp': time.time()})
        leaderboard.sort(key=lambda x: x['score'], reverse=True)
        emit_leaderboard_update()

@socketio.on('send_chat_message')
def handle_send_chat_message(data):
    game_id = data.get('game_id')
    message_text = data.get('message')
    player_sid = request.sid

    game = games.get(game_id)
    if not game:
        return

    player_name = game['players'].get(player_sid, {}).get('name', 'Unknown Player')
    chat_message = {'sender_name': player_name, 'sender_sid': player_sid, 'text': message_text, 'timestamp': time.time()}
    game['chat'].append(chat_message)

    emit('new_chat_message', chat_message, room=game_id)
    print(f"Chat in {game_id} from {player_name}: {message_text}")

    if game['game_mode'] == 'head_to_head' and game['num_bots'] > 0:
        bot_id = list(game['bots'].keys())[0]
        socketio.start_background_task(target=bot_chat_reply, game_id=game_id, bot_id=bot_id, original_message=message_text)
    elif game['game_mode'] == 'multiplayer' and game['bots']:
        if random.random() < 0.5:
            bot_id_to_reply = random.choice(list(game['bots'].keys()))
            socketio.start_background_task(target=bot_chat_reply, game_id=game_id, bot_id=bot_id_to_reply, original_message=message_text)


def bot_chat_reply(game_id, bot_id, original_message):
    game = games.get(game_id)
    if not game or bot_id not in game['bots']:
        return

    bot_name = game['bots'][bot_id]['name']
    socketio.sleep(random.uniform(0.5, 2.0))

    replies = [
        f"Interesting point, {original_message.split()[0] if ' ' in original_message else ''}!",
        "Haha, good one!",
        "I'm still learning to chat like humans!",
        "Let's focus on the game!",
        "🤔",
        f"What does everyone else think about '{original_message}'?"
    ]
    if 'hello' in original_message.lower() or 'hi' in original_message.lower():
        replies.append(f"Hello there from {bot_name}!")
    if '?' in original_message:
        replies.append("That's a good question!")
    if 'score' in original_message.lower():
        replies.append(f"My score is {game['bots'][bot_id]['score']}, what's yours?")

    bot_message_text = random.choice(replies)
    chat_message = {'sender_name': bot_name, 'sender_sid': bot_id, 'text': bot_message_text, 'timestamp': time.time(), 'is_bot': True}
    game['chat'].append(chat_message)
    socketio.emit('new_chat_message', chat_message, room=game_id)
    print(f"Bot Chat in {game_id} from {bot_name}: {bot_message_text}")


@socketio.on('request_leaderboard')
def handle_request_leaderboard():
    emit_leaderboard_update(room=request.sid)

def emit_leaderboard_update(room=None):
    sorted_leaderboard = sorted(leaderboard, key=lambda x: x['score'], reverse=True)[:20]
    if room:
        emit('leaderboard_update', sorted_leaderboard, room=room)
    else:
        socketio.emit('leaderboard_update', sorted_leaderboard)


if __name__ == '__main__':
    if not os.path.exists(DATABASE_PATH):
        print(f"Database not found at {DATABASE_PATH}. Please ensure it exists and is in the correct location relative to app.py.")
    else:
        print(f"Database found at {DATABASE_PATH}")

    try:
        conn = get_db_connection()
        conn.execute('SELECT 1 FROM quiz_questions LIMIT 1')
        conn.close()
        print("Successfully connected to the database and queried quiz_questions table.")
    except sqlite3.Error as e:
        print(f"Error connecting to or querying the database: {e}")
        print(f"Please ensure the database '{os.path.basename(DATABASE_PATH)}' is in the same directory as this script or adjust DATABASE_PATH.")
        exit(1)

    print("Starting server...")
    # Use environment variables for host and port (for Render deployment)
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    print(f"Server starting on {host}:{port} (debug={debug})")
    socketio.run(app, debug=debug, host=host, port=port)
