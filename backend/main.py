from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
from pydantic import BaseModel, field_validator
from typing import List, Optional, Union

import os
from dotenv import load_dotenv
from datetime import datetime
import json
import sqlite3
from pathlib import Path
import hashlib
import traceback

load_dotenv()

app = FastAPI(title="Code Review Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "code_reviews.db"
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            language TEXT,
            lines_of_code INTEGER,
            review_summary TEXT,
            readability_score INTEGER,
            modularity_score INTEGER,
            bug_risk_score INTEGER,
            suggestions TEXT,
            issues TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class ReviewResponse(BaseModel):
    id: int
    filename: str
    language: Optional[str]
    lines_of_code: int
    review_summary: str
    readability_score: int
    modularity_score: int
    bug_risk_score: int
    suggestions: List[dict]
    issues: List[dict]
    created_at: str
    
    @field_validator('suggestions', 'issues', mode='before')
    @classmethod
    def parse_json_and_normalize(cls, v):
        # Parse JSON string if needed
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except json.JSONDecodeError:
                return []
        
        # Ensure it's a list
        if not isinstance(v, list):
            return []
        
        # Convert string items to dict format
        result = []
        for item in v:
            if isinstance(item, dict):
                result.append(item)
            elif isinstance(item, str):
                # Convert string to dict
                result.append({"description": item})
        
        return result
class ReviewRequest(BaseModel):
    code: str
    filename: str
    language: Optional[str] = None

def get_llm_client():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key)

def calculate_file_hash(content: str) -> str:
    """Calculate SHA256 hash of file content"""
    return hashlib.sha256(content.encode()).hexdigest()

def save_review_to_db(filename: str, file_hash: str, code: str, analysis: dict) -> int:
    """Save review results to database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    lines_of_code = len([l for l in code.split('\n') if l.strip()])

    c.execute('''
        INSERT INTO reviews (
            filename, file_hash, language, lines_of_code,
            review_summary, readability_score, modularity_score, bug_risk_score,
            suggestions, issues
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        filename,
        file_hash,
        analysis.get('language'),
        lines_of_code,
        analysis.get('review_summary'),
        analysis.get('readability_score', 0),
        analysis.get('modularity_score', 0),
        analysis.get('bug_risk_score', 0),
        json.dumps(analysis.get('suggestions', [])),
        json.dumps(analysis.get('issues', []))
    ))

    review_id = c.lastrowid
    conn.commit()
    conn.close()
    return review_id



import google.generativeai as genai

def analyze_code_with_llm(code: str, filename: str, language: Optional[str] = None) -> dict:
    """Analyze code using Google Gemini 2.5 Flash"""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set")

    genai.configure(api_key=api_key)

    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        prompt = f"""You are an expert code reviewer. Analyze the following code and
        return ONLY a valid JSON object (no markdown, no code blocks) in EXACTLY this format:

        {{
          "language": "detected language",
          "review_summary": "2-3 sentence overview of code quality",
          "readability_score": 7,
          "modularity_score": 8,
          "bug_risk_score": 3,
          "suggestions": [
            {{"type": "improvement", "description": "suggestion text", "line": 10}},
            {{"type": "best-practice", "description": "another suggestion", "line": 25}}
          ],
          "issues": [
            {{"severity": "medium", "description": "issue description", "line": 15}},
            {{"severity": "low", "description": "minor issue", "line": 30}}
          ]
        }}

        IMPORTANT: 
        - Return ONLY the JSON object, no markdown formatting
        - suggestions and issues must be arrays of objects (dictionaries)
        - Each suggestion must have: type, description, and optionally line
        - Each issue must have: severity, description, and optionally line
        - Scores must be numbers from 1-10

        Filename: {filename}
        Language: {language or 'auto-detect'}
        
        Code:
```
        {code}
```
        """

        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Remove markdown code blocks if present
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text
            text = text.replace('```json', '').replace('```', '').strip()

        # Try to extract JSON safely
        start, end = text.find('{'), text.rfind('}') + 1
        json_str = text[start:end] if start != -1 else "{}"

        try:
            result = json.loads(json_str)
            
            # Ensure suggestions and issues are lists of dicts
            if 'suggestions' in result and isinstance(result['suggestions'], list):
                result['suggestions'] = [
                    s if isinstance(s, dict) else {"type": "general", "description": str(s)}
                    for s in result['suggestions']
                ]
            else:
                result['suggestions'] = []
                
            if 'issues' in result and isinstance(result['issues'], list):
                result['issues'] = [
                    i if isinstance(i, dict) else {"severity": "medium", "description": str(i)}
                    for i in result['issues']
                ]
            else:
                result['issues'] = []
            
            return result
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parse error: {e}")
            print(f"⚠️ Received text: {text[:200]}...")
            return {
                "language": language or "Unknown",
                "review_summary": "Could not parse Gemini output.",
                "readability_score": 5,
                "modularity_score": 5,
                "bug_risk_score": 5,
                "suggestions": [],
                "issues": []
            }

    except Exception as e:
        print("⚠️ Gemini error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini analysis failed: {str(e)}")
@app.get("/")
def read_root():
    return {
        "message": "Code Review Assistant API",
        "version": "1.0.0",
        "endpoints": {
            "POST /review/upload": "Upload code file for review",
            "POST /review/analyze": "Analyze code from request body",
            "GET /reviews": "List all reviews",
            "GET /reviews/{id}": "Get specific review"
        }
    }

@app.post("/review/upload", response_model=ReviewResponse)
async def upload_and_review(file: UploadFile = File(...)):
    """Upload a code file and get AI-powered review"""
    try:
        content = await file.read()
        code = content.decode('utf-8', errors='ignore')

        ext = Path(file.filename).suffix.lower()
        language_map = {
            '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
            '.java': 'Java', '.cpp': 'C++', '.c': 'C', '.go': 'Go',
            '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift', '.kt': 'Kotlin'
        }
        language = language_map.get(ext, 'Unknown')

        file_hash = calculate_file_hash(code)
        analysis = analyze_code_with_llm(code, file.filename, language)
        review_id = save_review_to_db(file.filename, file_hash, code, analysis)

        file_path = UPLOAD_DIR / f"{review_id}_{file.filename}"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)

        return get_review(review_id)

    except Exception as e:
        print("\n--- ERROR DURING UPLOAD ---")
        traceback.print_exc()
        print("----------------------------\n")
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

@app.post("/review/analyze", response_model=ReviewResponse)
async def analyze_code(request: ReviewRequest):
    """Analyze code from request body"""
    file_hash = calculate_file_hash(request.code)
    analysis = analyze_code_with_llm(request.code, request.filename, request.language)
    review_id = save_review_to_db(request.filename, file_hash, request.code, analysis)
    return get_review(review_id)

@app.get("/reviews", response_model=List[ReviewResponse])
def list_reviews(limit: int = 50, offset: int = 0):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM reviews ORDER BY created_at DESC LIMIT ? OFFSET ?', (limit, offset))
    rows = c.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        data = dict(row)
        data['suggestions'] = json.loads(data['suggestions']) if isinstance(data['suggestions'], str) else data['suggestions']
        data['issues'] = json.loads(data['issues']) if isinstance(data['issues'], str) else data['issues']
        results.append(ReviewResponse(**data))
    
    return results

@app.get("/reviews/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM reviews WHERE id = ?', (review_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Convert row to dict and parse JSON strings
    data = dict(row)
    data['suggestions'] = json.loads(data['suggestions']) if isinstance(data['suggestions'], str) else data['suggestions']
    data['issues'] = json.loads(data['issues']) if isinstance(data['issues'], str) else data['issues']
    
    return ReviewResponse(**data)

@app.get("/stats")
def get_stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM reviews')
    total = c.fetchone()[0]
    c.execute('SELECT AVG(readability_score), AVG(modularity_score), AVG(bug_risk_score) FROM reviews')
    avg_read, avg_mod, avg_bug = [round(x or 0, 1) for x in c.fetchone()]
    c.execute('SELECT language, COUNT(*) FROM reviews GROUP BY language')
    languages = dict(c.fetchall())
    conn.close()
    return {
        "total_reviews": total,
        "average_scores": {"readability": avg_read, "modularity": avg_mod, "bug_risk": avg_bug},
        "languages": languages
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
