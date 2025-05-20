import os
import re

def fix_line_continuations(file_path):
    print(f"Fixing line continuations in {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix specific common issues
    
    # Fix GameRoom load_questions method
    pattern = r'# Updated query to use quiz_questions table with its actual column names\s+query = "SELECT'
    replacement = '            # Updated query to use quiz_questions table with its actual column names\n            query = "SELECT'
    content = re.sub(pattern, replacement, content)
    
    # Fix any line that ends with a token followed by another token at the start of the next line
    # Note: This is a simplistic approach - it might not catch all cases
    patterns_to_fix = [
        (r'conn\.rollback\(\)\s+finally:', 'conn.rollback()\n    finally:'),
        (r'conn\.commit\(\)\s+print', 'conn.commit()\n        print'),
        (r'player\.correct_streak = 0\s+round_results', 'player.correct_streak = 0\n            \n            round_results'),
        (r'loaded_questions = \[\]\s+for row', 'loaded_questions = []\n        for row'),
        (r'\);\s+\"\"\"\)\s+conn.commit', ');\\n    """)\n    conn.commit'),
        (r'self\.questions = \[\]\s+def', 'self.questions = []\n\n    def'),
        (r'self\.time_remaining = 0\s+self\.game_state', 'self.time_remaining = 0\n        self.game_state'),
        (r'self\.bot_id_counter = 0\s+self\.bot_names_pool', 'self.bot_id_counter = 0\n        self.bot_names_pool')
    ]
    
    for pattern, repl in patterns_to_fix:
        content = re.sub(pattern, repl, content)
    
    # Fix duplicate load_questions function (starting at line 186)
    # Get the correct load_questions function
    correct_load_questions = None
    with open('server_backend_fixed_load_questions.py', 'r', encoding='utf-8') as f:
        fixed_content = f.read()
        load_q_match = re.search(r'def load_questions\(category_filter=\'all\', limit=30\):.*?finally:.*?conn.close\(\)', fixed_content, re.DOTALL)
        if load_q_match:
            correct_load_questions = load_q_match.group(0)
    
    if correct_load_questions:
        # Remove the duplicate standalone load_questions function
        pattern = r'def load_questions\(category_filter=\'all\', limit=30\):.*?finally:.*?conn\.close\(\)\s*\n\s*class Player:'
        replacement = 'class Player:'
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        # Replace the first standalone load_questions function with the correct one
        pattern = r'def load_questions\(category_filter=\'all\', limit=30\):.*?finally:.*?conn\.close\(\)'
        content = re.sub(pattern, correct_load_questions, content, flags=re.DOTALL)
        
        # Fix GameRoom load_questions method
        gameroom_load_q = """    def load_questions(self, category_filter):
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
            params.append(self.num_questions)

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
                    'answer': row['correct_answer'],
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
                conn.close()"""
                
        pattern = r'def load_questions\(self, category_filter\):.*?finally:.*?conn\.close\(\)'
        content = re.sub(pattern, gameroom_load_q, content, flags=re.DOTALL)
    
    # Write the fixed content back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed file saved to {file_path}")

if __name__ == "__main__":
    # Create backup
    os.system('copy "server_backend.py" "server_backend.py.bak2"')
    
    # Copy original file to clean working file
    os.system('copy "server_backend.py.orig" "server_backend.py"')
    
    # Fix the file
    fix_line_continuations('server_backend.py')
    
    print("Done! Test the fixed file.")
