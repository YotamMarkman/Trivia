import sqlite3
import random
import os

def direct_fix():
    """Directly modify the function to use the quiz_questions table"""
    db_path = 'c:\\\\Users\\\\yotam\\\\OneDrive\\\\Documents\\\\Recihmann\\\\Computer_Science_Yr_2\\\\Sem_2\\\\Idea_To_App\\\\Assignment3\\\\Exercise2\\\\quiz_questions.sqlite'
    
    # Test the function
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # First verify that quiz_questions table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_questions'")
        if not cursor.fetchone():
            print("Error: quiz_questions table does not exist in the database!")
            return
            
        # Check question count
        cursor.execute("SELECT COUNT(*) FROM quiz_questions")
        question_count = cursor.fetchone()[0]
        print(f"Found {question_count} questions in quiz_questions table")
          # Test query
        cursor.execute("SELECT id, question, correct_answer, wrong1, wrong2, wrong3, category FROM quiz_questions LIMIT 3")
        rows = cursor.fetchall()
        
        print("\nSample questions:")
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"Question: {row['question']}")
            print(f"Correct Answer: {row['correct_answer']}")
            print(f"Wrong Answers: {row['wrong1']}, {row['wrong2']}, {row['wrong3']}")
            print(f"Category: {row['category']}")
            print()
            
        print("\nTo fix the issue, modify the load_questions function in server_backend.py to use the quiz_questions table.")
        print("""
# Fixed load_questions function for server_backend.py:

def load_questions(category_filter='all', limit=30):
    \"\"\"Load questions from database as standalone function for SinglePlayerGame\"\"\"
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
""")
        
    finally:
        conn.close()

if __name__ == "__main__":
    direct_fix()
