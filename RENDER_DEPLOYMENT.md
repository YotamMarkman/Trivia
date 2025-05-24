# Render Deployment Guide

## Overview
This trivia application is now configured to deploy as a single service on Render, with the Flask backend serving both the API endpoints and the frontend static files.

## Files Ready for Deployment
- ✅ `requirements.txt` - Python dependencies
- ✅ `backend/app.py` - Modified to serve frontend files and use environment variables
- ✅ `frontend/` - All frontend files (HTML, CSS, JS, assets)
- ✅ `quiz_questions.db` - Database file

## Environment Variables Required on Render

Set these environment variables in your Render service:

### Required Variables:
- `FLASK_ENV=production`
- `SECRET_KEY=your-secure-random-secret-key-here`
- `DATABASE_PATH=/app/quiz_questions.db`
- `HOST=0.0.0.0`
- `PYTHON_VERSION=3.11`

### Optional Variables:
- `PORT` (Render will set this automatically)
- `CORS_ORIGINS` (if you need specific CORS settings)

## Render Service Configuration

### Build Settings:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python backend/app.py`
- **Environment**: Python 3.11

### Service Settings:
- **Service Type**: Web Service
- **Region**: Choose your preferred region
- **Instance Type**: Free tier is sufficient for testing

## Deployment Steps

1. **Create Render Account**: Sign up at render.com
2. **Connect Repository**: Link your GitHub repository
3. **Create Web Service**: Choose "Build and deploy from a Git repository"
4. **Configure Service**:
   - Root Directory: Leave blank (uses repo root)
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python backend/app.py`
5. **Set Environment Variables**: Add all the required environment variables listed above
6. **Deploy**: Click "Create Web Service"

## Database Notes
- The SQLite database (`quiz_questions.db`) will be included in the deployment
- For production, consider migrating to PostgreSQL for better persistence
- Database path is configured via `DATABASE_PATH` environment variable

## Testing Locally
The application is configured to work both locally and in production:
- Locally: Run `python backend/app.py` (uses debug mode)
- Production: Set `FLASK_ENV=production` to disable debug mode

## URLs After Deployment
- **Frontend**: `https://your-app-name.onrender.com/`
- **API Endpoints**: `https://your-app-name.onrender.com/api/...`

## Troubleshooting
- Check Render logs if deployment fails
- Ensure all environment variables are set correctly
- Verify that `requirements.txt` includes all necessary dependencies
