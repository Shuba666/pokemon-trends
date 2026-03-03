from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
import asyncpg
import os
import logging
from datetime import date
from scheduler import collect_trends

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")  # Railway автоматически задаёт эту переменную


# ── БД: создание таблицы при старте ───────────────────────────────────────────
async def init_db(pool):
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS trends (
                id          SERIAL PRIMARY KEY,
                date        DATE NOT NULL,
                country     TEXT NOT NULL,
                pokemon     TEXT NOT NULL,
                region      TEXT,
                score       FLOAT NOT NULL,
                UNIQUE (date, country, pokemon)
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_trends_date ON trends(date)")
    logger.info("✅ БД инициализирована")


# ── Lifespan: запуск пула и планировщика ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Подключаемся к PostgreSQL
    app.state.pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    await init_db(app.state.pool)

    # Запускаем планировщик — каждый день в 03:00 UTC
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        collect_trends,
        trigger="cron",
        hour=3,
        minute=0,
        args=[app.state.pool],
        id="daily_trends"
    )
    scheduler.start()
    logger.info("⏰ Планировщик запущен — сбор данных каждый день в 03:00 UTC")

    # При первом запуске — сразу собираем данные если таблица пустая
    async with app.state.pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM trends")
    if count == 0:
        logger.info("📊 Таблица пустая — запускаем первичный сбор данных...")
        await collect_trends(app.state.pool)

    yield

    scheduler.shutdown()
    await app.state.pool.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── GET /get-pokemon-data — основной эндпоинт для фронта ──────────────────────
@app.get("/get-pokemon-data")
async def get_data():
    try:
        async with app.state.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT
                    date::text,
                    country,
                    pokemon,
                    COALESCE(region, '') AS region,
                    score,
                    ROUND((score / NULLIF(MAX(score) OVER (), 0) * 100)::numeric, 2) AS power_percentage
                FROM trends
                ORDER BY date, country, score DESC
            """)

        data = [dict(r) for r in rows]
        return {"status": "success", "data": data}

    except Exception as e:
        logger.error(f"Ошибка при получении данных: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /stats — общая статистика для дашборда ────────────────────────────────
@app.get("/stats")
async def get_stats():
    try:
        async with app.state.pool.acquire() as conn:
            total_records = await conn.fetchval("SELECT COUNT(*) FROM trends")
            total_countries = await conn.fetchval("SELECT COUNT(DISTINCT country) FROM trends")
            last_update = await conn.fetchval("SELECT MAX(date) FROM trends")
            top_pokemon = await conn.fetchrow("""
                SELECT pokemon, SUM(score) as total
                FROM trends
                GROUP BY pokemon
                ORDER BY total DESC
                LIMIT 1
            """)

        return {
            "total_records": total_records,
            "total_countries": total_countries,
            "last_update": str(last_update) if last_update else None,
            "top_pokemon": dict(top_pokemon) if top_pokemon else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /health — проверка что сервер живой (нужен для Railway) ───────────────
@app.get("/health")
async def health():
    return {"status": "ok", "date": str(date.today())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
