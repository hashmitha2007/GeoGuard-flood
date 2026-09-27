# GeoGuard Full-Stack Website

## Stack
Frontend:
- React 18
- Vite
- Recharts
- Lucide React

Backend:
- Python
- FastAPI
- Pydantic
- MongoDB (optional)
- In-memory fallback when MongoDB is not running

## 1. Start backend

Open PowerShell:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend:
- http://127.0.0.1:8000
- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

If PowerShell blocks activation, use:
```powershell
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

## 2. Start frontend

Open a SECOND PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Open:
http://localhost:5173

The frontend automatically calls:
http://127.0.0.1:8000

## 3. MongoDB

MongoDB is optional for this demo.

Without MongoDB:
- the backend still works
- incident reports are stored in memory
- restarting backend clears the demo incidents

For persistent storage, install/run MongoDB and create:

`.env`

from `.env.example`.

Example:
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=geoguard
FRONTEND_URL=http://localhost:5173
```

## Main API endpoints

GET `/health`
GET `/locations`
GET `/sensors`
GET `/alerts`
GET `/incidents`

POST `/prediction`
POST `/incidents`
POST `/alerts/test`

## Important for SIH

The risk calculation in `backend/main.py` is a transparent demo weighted model. It is NOT a scientifically validated flood prediction model.

For a real deployment, replace `calculate_risk()` with a trained ML model and connect:
- real rainfall/weather API
- real IoT sensor stream
- soil moisture sensors
- slope/elevation/GIS data
- historical disaster database
- SMS/app notification service
