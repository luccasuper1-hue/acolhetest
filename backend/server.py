from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from app.core import client
from app.deployment import parse_cors_origins
from app.seed import seed
from app.routers import auth, institutions, professionals, students, admin, metrics

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

cors_origins = parse_cors_origins(os.environ.get('CORS_ORIGINS', ''))
if os.environ.get('APP_ENV', 'development').lower() == 'production':
    if len(os.environ.get('JWT_SECRET', '')) < 32:
        raise RuntimeError('JWT_SECRET must contain at least 32 characters in production')
    if not cors_origins:
        raise RuntimeError('CORS_ORIGINS must list the frontend origin in production')

app = FastAPI(title="Acolhe MVP API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "acolhe-mvp", "status": "ok", "mode": "pilot"}


api_router.include_router(auth.router)
api_router.include_router(institutions.router)
api_router.include_router(professionals.router)
api_router.include_router(students.router)
api_router.include_router(admin.router)
api_router.include_router(metrics.router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed()
    logger.info("Acolhe MVP pronto — dados do piloto verificados")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
