
# Code Review Assistant

**Code Review Assistant** is an AI-powered tool that automatically reviews uploaded source code files and provides insights into readability, modularity, and potential bugs.
It uses a FastAPI backend connected to the Google Gemini 1.5 Flash model and a React frontend for an interactive dashboard.

---

## Features

* Upload and analyze code files (`.py`, `.js`, `.java`, `.cpp`, etc.)
* AI-generated review reports including suggestions and detected issues
* Stores and retrieves past reviews using a local SQLite database
* Google Gemini 1.5 Flash integration for free, reliable code analysis
* Responsive and modern frontend dashboard

---

## Tech Stack

**Backend:** FastAPI, SQLite, Google Gemini API
**Frontend:** React, Axios, TailwindCSS

---

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file and add your Gemini API key:

   ```
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```

4. Start the FastAPI server:

   ```bash
   uvicorn main:app --reload
   ```

   The backend will run at: **[http://localhost:8000](http://localhost:8000)**

---

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

   The frontend will run at: **[http://localhost:5173](http://localhost:5173)**

---

## Environment Variables

| Variable         | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY` | Your Gemini 2.5 Flash API key from [Google AI Studio](https://makersuite.google.com/app/apikey) |

---

## Usage

1. Open the frontend in your browser (`http://localhost:5173`).
2. Upload any supported code file.
3. The backend sends it to Gemini 1.5 Flash for analysis.
4. View results including:

   * Code summary
   * Readability, Modularity, and Bug Risk scores
   * Highlighted issues and AI-generated suggestions

---
