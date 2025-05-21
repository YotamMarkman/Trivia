import os
import sqlite3
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS # Import CORS
import random
import time

app = Flask(__name__)
CORS(app) # Enable CORS for all routes
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'quiz_questions.db')
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

# Game state
games = {}
leaderboard = [] # In-memory leaderboard for simplicity

# --- SocketIO Events ---
@socketio.on('connect')
def handle_connect():
    print('Client connected:', request.sid)

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
        'selected_categories': categories # New: Store selected categories
    }
    join_room(game_id)
    games[game_id]['players'][request.sid] = {'name': player_name, 'score': 0, 'sid': request.sid}
    games[game_id]['scores'][player_name] = 0

    print(f"Game {game_id} created by {player_name} (SID: {request.sid}). Mode: {game_mode}, Max Players: {max_players}, Bots: {num_bots}, Categories: {categories}")


    # Add bots if any
    for i in range(num_bots):
        bot_id = f"bot_{i+1}"
        bot_name = f"Bot {i+1}"
        games[game_id]['bots'][bot_id] = {'name': bot_name, 'score': 0}
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
    game['players'][request.sid] = {'name': player_name, 'score': 0, 'sid': request.sid}
    game['scores'][player_name] = 0
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
    if game['current_question_index'] >= len(game['questions']):
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
        'total_questions': len(game['questions'])
    }

    game['question_start_time'] = time.time()
    # Store the correct answer on the server side for verification
    game['current_correct_answer'] = question_data['correct_answer']

    socketio.emit('new_question', current_question_for_client, room=game_id)
    print(f"Sent question {game['current_question_index'] + 1} for game {game_id}")

    # Bot answers (if any)
    if game['bots']:
        socketio.start_background_task(target=bots_answer, game_id=game_id, question_data=question_data)


def bots_answer(game_id, question_data):
    game = games.get(game_id)
    if not game: return

    for bot_id, bot_info in game['bots'].items():
        # Simple AI: 70% chance of correct answer, random delay
        socketio.sleep(random.uniform(1, 5)) # Simulate thinking time
        is_correct = random.random() < 0.7
        answer = question_data['correct_answer'] if is_correct else random.choice([question_data['wrong1'], question_data['wrong2'], question_data['wrong3']])

        # Simulate bot submitting answer
        handle_submit_answer({'game_id': game_id, 'answer': answer}, bot_id=bot_id)


@socketio.on('submit_answer')
def handle_submit_answer(data, bot_id=None): # bot_id is internal for bot submissions
    game_id = data.get('game_id')
    answer = data.get('answer')
    player_sid = request.sid if not bot_id else bot_id # Use bot_id if provided

    game = games.get(game_id)
    if not game:
        emit('error', {'message': 'Game not found.'}, room=player_sid if not bot_id else None) # Don't emit to bot
        return

    player_info = game['players'].get(player_sid) if not bot_id else game['bots'].get(bot_id)
    if not player_info:
        print(f"Player/Bot {player_sid} not found in game {game_id}")
        return # Player not in this game or bot not found

    player_name = player_info['name']

    time_taken = time.time() - game.get('question_start_time', time.time())
    is_correct = (answer == game.get('current_correct_answer'))

    score_earned = 0
    if is_correct:
        # Score based on speed: max 100 points, min 10. 10 seconds to answer.
        score_earned = max(10, 100 - int(time_taken * 10))
        game['scores'][player_name] = game['scores'].get(player_name, 0) + score_earned
        if not bot_id:
            game['players'][player_sid]['score'] = game['scores'][player_name]
        else:
            game['bots'][bot_id]['score'] = game['scores'][player_name]


    print(f"Player/Bot {player_name} in game {game_id} answered: {answer}. Correct: {is_correct}. Score: {score_earned}")

    # Emit result to the specific player/bot (or just update server state for bot)
    if not bot_id:
        emit('answer_result', {
            'correct': is_correct,
            'correct_answer': game.get('current_correct_answer'),
            'score_earned': score_earned,
            'your_total_score': game['scores'][player_name]
        }, room=player_sid)

    # Notify all players about the answer (optional, could be revealed at end of question)
    # For now, let's update scores for everyone at end of question or game
    # Check if all (human) players have answered or timer up, then send next question
    # This part needs more sophisticated logic for multiplayer (e.g., timers per question)
    # For now, let's assume single player or head-to-head where one answer moves it.
    # In a real scenario, you'd wait for all players or a timer.

    # For simplicity, if it's a human player or the last bot, move to next question or update scores
    # This logic needs refinement for multiplayer to wait for all answers or a timer.
    # For now, let's assume one answer (from human or last bot) triggers next step for simplicity.
    # A better approach would be to collect all answers within a time limit.

    # If it's a single player game, or if it's a bot answering, we can proceed.
    # In multiplayer, we'd need to wait for all players or a timer.
    # This is a simplified flow.
    is_last_bot_or_human = not bot_id or (bot_id and bot_id == list(game['bots'].keys())[-1] if game['bots'] else False)

    if game['game_mode'] == 'singleplayer' and not bot_id:
        send_next_question(game_id)
    elif game['game_mode'] == 'head_to_head':
        # In H2H, after one player answers, reveal and then move.
        # Or wait for both. For now, let's just update scores and wait for host to click next (or auto-next)
        # This part is simplified.
        emit('update_scores', {'scores': game['scores'], 'player_list': get_player_list(game_id)}, room=game_id)
        # Potentially send next question if both answered or timer up
        # For now, let's assume the game progresses after each answer in H2H for simplicity in this stage
        # A better H2H would wait for both answers or a timer.
        # Let's just send next question for now to keep it flowing.
        # This needs to be improved for proper H2H turn-based or simultaneous answer logic.
        send_next_question(game_id) # Simplified: next question after any answer in H2H
    elif game['game_mode'] == 'multiplayer':
        # In multiplayer, we should ideally wait for all players or a timer.
        # For now, just update scores. The host might control progression or a timer.
        emit('update_scores', {'scores': game['scores'], 'player_list': get_player_list(game_id)}, room=game_id)
        # Let's assume for now that after a certain number of answers or a timer, the question ends.
        # This is a placeholder for more complex multiplayer logic.
        # If it's the last bot answering, and no humans, or if some condition is met.
        # For now, let's not automatically go to next question in multiplayer after one answer.
        # Host might trigger it, or a timer (not implemented yet).
        pass


def end_game(game_id):
    game = games.get(game_id)
    if not game:
        return

    final_scores = game['scores']
    sorted_scores = sorted(final_scores.items(), key=lambda item: item[1], reverse=True)

    print(f"Game {game_id} ended. Final scores: {sorted_scores}")
    emit('game_over', {'scores': sorted_scores, 'game_id': game_id}, room=game_id)

    # Update global leaderboard for single-player games
    if game['game_mode'] == 'singleplayer':
        player_sid = list(game['players'].keys())[0] # Assuming one player in single player
        player_name = game['players'][player_sid]['name']
        player_score = game['scores'][player_name]
        leaderboard.append({'name': player_name, 'score': player_score, 'timestamp': time.time()})
        # Sort leaderboard and keep top N (e.g., top 10)
        leaderboard.sort(key=lambda x: x['score'], reverse=True)
        # leaderboard = leaderboard[:10] # Keep top 10
        emit_leaderboard_update()

    # Clean up game
    # del games[game_id] # Keep game for a bit if players want to see scores, or move to a post-game room.


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

    # Bot replies in chat for head-to-head (if vs bot) or multiplayer
    if game['game_mode'] == 'head_to_head' and game['num_bots'] > 0:
        # Assuming one bot in H2H if num_bots > 0
        bot_id = list(game['bots'].keys())[0]
        socketio.start_background_task(target=bot_chat_reply, game_id=game_id, bot_id=bot_id, original_message=message_text)
    elif game['game_mode'] == 'multiplayer' and game['bots']:
        # Random bot replies
        if random.random() < 0.5: # 50% chance a bot replies
            bot_id_to_reply = random.choice(list(game['bots'].keys()))
            socketio.start_background_task(target=bot_chat_reply, game_id=game_id, bot_id=bot_id_to_reply, original_message=message_text)


def bot_chat_reply(game_id, bot_id, original_message):
    game = games.get(game_id)
    if not game or bot_id not in game['bots']:
        return

    bot_name = game['bots'][bot_id]['name']
    socketio.sleep(random.uniform(0.5, 2.0)) # Simulate thinking

    # Basic AI chat responses
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
    emit_leaderboard_update(room=request.sid) # Send to requester

def emit_leaderboard_update(room=None):
    sorted_leaderboard = sorted(leaderboard, key=lambda x: x['score'], reverse=True)[:20] # Top 20
    if room:
        emit('leaderboard_update', sorted_leaderboard, room=room)
    else:
        socketio.emit('leaderboard_update', sorted_leaderboard) # Broadcast to all


if __name__ == '__main__':
    # Ensure the database exists before starting, otherwise create and populate it
    if not os.path.exists(DATABASE_PATH):
        print(f"Database not found at {DATABASE_PATH}. Please ensure it exists and is in the correct location relative to app.py.")
        # Example: You might want to call a setup_database() function here if it's intended to be created by the app.
        # For this exercise, we assume quiz_questions.db is provided.
    else:
        print(f"Database found at {DATABASE_PATH}")

    # Test DB connection
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
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
