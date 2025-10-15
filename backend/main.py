from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from datetime import datetime
import json
import sqlite3
from pathlib import Path
import hashlib

app = FastAPI(title="Code Review Assistant API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
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

# Models
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

class ReviewRequest(BaseModel):
    code: str
    filename: str
    language: Optional[str] = None

# LLM Integration
def get_llm_client():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key)

def analyze_code_with_llm(code: str, filename: str, language: Optional[str] = None) -> dict:
    """Analyze code using Claude LLM"""
    client = get_llm_client()
    
    prompt = f"""You are an expert code reviewer. Analyze the following code and provide a comprehensive review.

Filename: {filename}
Language: {language or 'auto-detect'}

Code:
```
{code}
```

Please provide your analysis in the following JSON format:
{{
    "language": "detected language",
    "review_summary": "2-3 sentence overview of code quality",
    "readability_score": 1-10,
    "modularity_score": 1-10,
    "bug_risk_score": 1-10,
    "suggestions": [
        {{
            "category": "readability|performance|security|best-practices",
            "severity": "low|medium|high",
            "line": line_number or null,
            "title": "Brief title",
            "description": "Detailed suggestion",
            "code_snippet": "relevant code" or null,
            "improved_code": "suggested improvement" or null
        }}
    ],
    "issues": [
        {{
            "type": "bug|security|performance|style",
            "severity": "low|medium|high|critical",
            "line": line_number or null,
            "description": "Issue description",
            "code_snippet": "problematic code"
        }}
    ],
    "positive_aspects": ["list of good practices found"]
}}

Focus on:
1. Code readability and maintainability
2. Modularity and separation of concerns
3. Potential bugs and edge cases
4. Security vulnerabilities
5. Performance issues
6. Best practices for the language
7. Documentation quality

Be specific and actionable in your suggestions."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        
        response_text = message.content[0].text
        
        # Extract JSON from response
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        json_str = response_text[start:end]
        
        return json.loads(json_str)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {str(e)}")

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

# API Endpoints
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
    
    # Read file content
    content = await file.read()
    code = content.decode('utf-8')
    
    # Detect language from extension
    ext = Path(file.filename).suffix.lower()
    language_map = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.go': 'Go',
        '.rs': 'Rust',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.swift': 'Swift',
        '.kt': 'Kotlin'
    }
    language = language_map.get(ext, 'Unknown')
    
    # Calculate file hash
    file_hash = calculate_file_hash(code)
    
    # Analyze with LLM
    analysis = analyze_code_with_llm(code, file.filename, language)
    
    # Save to database
    review_id = save_review_to_db(file.filename, file_hash, code, analysis)
    
    # Save file
    file_path = UPLOAD_DIR / f"{review_id}_{file.filename}"
    with open(file_path, 'w') as f:
        f.write(code)
    
    # Get saved review
    return get_review(review_id)

@app.post("/review/analyze", response_model=ReviewResponse)
async def analyze_code(request: ReviewRequest):
    """Analyze code from request body"""
    
    file_hash = calculate_file_hash(request.code)
    
    # Analyze with LLM
    analysis = analyze_code_with_llm(request.code, request.filename, request.language)
    
    # Save to database
    review_id = save_review_to_db(request.filename, file_hash, request.code, analysis)
    
    return get_review(review_id)

@app.get("/reviews", response_model=List[ReviewResponse])
def list_reviews(limit: int = 50, offset: int = 0):
    """List all code reviews"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('''
        SELECT * FROM reviews 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    ''', (limit, offset))
    
    rows = c.fetchall()
    conn.close()
    
    reviews = []
    for row in rows:
        reviews.append(ReviewResponse(
            id=row['id'],
            filename=row['filename'],
            language=row['language'],
            lines_of_code=row['lines_of_code'],
            review_summary=row['review_summary'],
            readability_score=row['readability_score'],
            modularity_score=row['modularity_score'],
            bug_risk_score=row['bug_risk_score'],
            suggestions=json.loads(row['suggestions']),
            issues=json.loads(row['issues']),
            created_at=row['created_at']
        ))
    
    return reviews

@app.get("/reviews/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int):
    """Get a specific review by ID"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('SELECT * FROM reviews WHERE id = ?', (review_id,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return ReviewResponse(
        id=row['id'],
        filename=row['filename'],
        language=row['language'],
        lines_of_code=row['lines_of_code'],
        review_summary=row['review_summary'],
        readability_score=row['readability_score'],
        modularity_score=row['modularity_score'],
        bug_risk_score=row['bug_risk_score'],
        suggestions=json.loads(row['suggestions']),
        issues=json.loads(row['issues']),
        created_at=row['created_at']
    )

@app.delete("/reviews/{review_id}")
def delete_review(review_id: int):
    """Delete a review"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM reviews WHERE id = ?', (review_id,))
    deleted = c.rowcount
    conn.commit()
    conn.close()
    
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return {"message": "Review deleted successfully"}

@app.get("/stats")
def get_stats():
    """Get overall statistics"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) as total FROM reviews')
    total = c.fetchone()[0]
    
    c.execute('SELECT AVG(readability_score) as avg_read FROM reviews')
    avg_readability = c.fetchone()[0] or 0
    
    c.execute('SELECT AVG(modularity_score) as avg_mod FROM reviews')
    avg_modularity = c.fetchone()[0] or 0
    
    c.execute('SELECT AVG(bug_risk_score) as avg_bug FROM reviews')
    avg_bug_risk = c.fetchone()[0] or 0
    
    c.execute('SELECT language, COUNT(*) as count FROM reviews GROUP BY language')
    languages = dict(c.fetchall())
    
    conn.close()
    
    return {
        "total_reviews": total,
        "average_scores": {
            "readability": round(avg_readability, 1),
            "modularity": round(avg_modularity, 1),
            "bug_risk": round(avg_bug_risk, 1)
        },
        "languages": languages
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)