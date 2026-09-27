from datetime import datetime, timezone
from typing import Optional
import os
import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None

app = FastAPI(
    title="GeoGuard API",
    description="Hyper-local flash flood early warning backend",
    version="1.0.0"
)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://127.0.0.1:5173", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB is optional. The application runs with an in-memory fallback.
mongo_client = None
db = None
incidents_memory = []

if MongoClient:
    try:
        mongo_client = MongoClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=1200
        )
        mongo_client.admin.command("ping")
        db = mongo_client[os.getenv("DATABASE_NAME", "geoguard")]
        print("MongoDB connected")
    except Exception:
        mongo_client = None
        db = None
        print("MongoDB not available - using in-memory storage")

LOCATIONS = [
    {"id": 1, "name": "East Sikkim", "district": "East Sikkim", "state": "Sikkim", "lat": 27.33, "lon": 88.61},
    {"id": 2, "name": "West Sikkim", "district": "West Sikkim", "state": "Sikkim", "lat": 27.28, "lon": 88.17},
    {"id": 3, "name": "Tawang", "district": "Tawang", "state": "Arunachal Pradesh", "lat": 27.59, "lon": 91.86},
    {"id": 4, "name": "East Khasi Hills", "district": "East Khasi Hills", "state": "Meghalaya", "lat": 25.58, "lon": 91.89},
    {"id": 5, "name": "Kohima", "district": "Kohima", "state": "Nagaland", "lat": 25.67, "lon": 94.11},
]

SENSORS = [
    {"id":"RG-ES-01","location":"Singhik","type":"Rain Gauge","reading":"86.4 mm","battery":91,"status":"online","updated":"2 min ago"},
    {"id":"SM-ES-04","location":"Rumtek","type":"Soil Moisture","reading":"78.6%","battery":87,"status":"warning","updated":"2 min ago"},
    {"id":"WL-ES-07","location":"Teesta","type":"Water Level","reading":"3.8 m","battery":82,"status":"online","updated":"1 min ago"},
    {"id":"SM-ES-09","location":"Ranka","type":"Soil Moisture","reading":"74.2%","battery":79,"status":"online","updated":"3 min ago"},
    {"id":"RG-ES-11","location":"Gangtok","type":"Rain Gauge","reading":"62.1 mm","battery":94,"status":"online","updated":"2 min ago"},
    {"id":"SL-ES-13","location":"Tadong","type":"Slope Sensor","reading":"31.8°","battery":76,"status":"online","updated":"4 min ago"},
    {"id":"SM-ES-15","location":"Singtam","type":"Soil Moisture","reading":"81.3%","battery":68,"status":"warning","updated":"2 min ago"},
    {"id":"WL-ES-18","location":"Mangan","type":"Water Level","reading":"2.1 m","battery":88,"status":"offline","updated":"18 min ago"},
]

class PredictionRequest(BaseModel):
    rainfall_24h: float = Field(86.4, ge=0)
    soil_moisture: float = Field(78.6, ge=0, le=100)
    slope: float = Field(31.8, ge=0, le=90)
    water_level: float = Field(3.8, ge=0)
    historical_risk: float = Field(72, ge=0, le=100)

class IncidentCreate(BaseModel):
    location: str
    incident_type: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str = "Citizen"

def calculate_risk(rainfall, moisture, slope, water, historical):
    # Demo weighted model. Replace with trained ML model later.
    rain_score = min(rainfall / 120 * 100, 100)
    moisture_score = moisture
    slope_score = min(slope / 45 * 100, 100)
    water_score = min(water / 6 * 100, 100)
    score = (
        rain_score * 0.30 +
        moisture_score * 0.25 +
        slope_score * 0.15 +
        water_score * 0.15 +
        historical * 0.15
    )
    score = round(min(score, 100), 2)
    if score >= 70:
        level = "HIGH"
    elif score >= 45:
        level = "MODERATE"
    else:
        level = "LOW"
    return score, level

@app.get("/")
def root():
    return {"name":"GeoGuard API","status":"running","docs":"/docs"}

@app.get("/health")
def health():
    return {
        "status":"ok",
        "database":"mongodb" if db is not None else "memory",
        "time":datetime.now(timezone.utc).isoformat()
    }

@app.get("/locations")
def locations():
    return LOCATIONS

@app.get("/sensors")
def sensors():
    return SENSORS

@app.get("/alerts")
def alerts():
    return [
        {
            "id":"ALT-1042","severity":"HIGH",
            "title":"Flash Flood Risk — Singhik",
            "message":"Rainfall and soil saturation have crossed the high-risk threshold.",
            "confidence":91,"status":"active","created":"2026-09-27T14:18:00+05:30"
        },
        {
            "id":"ALT-1041","severity":"MODERATE",
            "title":"Heavy Rainfall — Rumtek",
            "message":"Forecast indicates sustained rainfall. Monitor drainage channels.",
            "confidence":86,"status":"active","created":"2026-09-27T14:02:00+05:30"
        },
        {
            "id":"ALT-1040","severity":"INFO",
            "title":"Sensor Connectivity — North Cluster",
            "message":"One soil-moisture node is offline. Neighbouring nodes remain operational.",
            "confidence":100,"status":"active","created":"2026-09-27T13:46:00+05:30"
        }
    ]

@app.post("/prediction")
def prediction(data: PredictionRequest):
    score, level = calculate_risk(
        data.rainfall_24h,
        data.soil_moisture,
        data.slope,
        data.water_level,
        data.historical_risk
    )
    lead_time = "45–90 minutes" if level == "HIGH" else ("60–120 minutes" if level == "MODERATE" else "120+ minutes")
    return {
        "risk_score": score,
        "risk_level": level,
        "lead_time": lead_time,
        "factors": {
            "rainfall": round(min(data.rainfall_24h / 120 * 100,100),1),
            "soil_moisture": round(data.soil_moisture,1),
            "slope": round(min(data.slope / 45 * 100,100),1),
            "water_level": round(min(data.water_level / 6 * 100,100),1),
            "historical_risk": round(data.historical_risk,1)
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@app.get("/incidents")
def get_incidents():
    if db is not None:
        docs = list(db.incidents.find({}, {"_id":0}).sort("created_at",-1).limit(50))
        return docs
    return list(reversed(incidents_memory[-50:]))

@app.post("/incidents")
def create_incident(data: IncidentCreate):
    incident = {
        "id": f"INC-{1043 + len(incidents_memory)}",
        "location": data.location,
        "incident_type": data.incident_type,
        "description": data.description,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "source": data.source,
        "status": "Reviewing",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if db is not None:
        db.incidents.insert_one(incident.copy())
    incidents_memory.append(incident)
    return {"message":"Incident received","incident":incident}

@app.post("/alerts/test")
def test_alert():
    return {
        "message":"Test alert generated",
        "alert":{
            "id":f"TEST-{random.randint(1000,9999)}",
            "severity":"INFO",
            "title":"System Test Alert",
            "message":"Demo notification generated by GeoGuard.",
            "status":"active"
        }
    }
