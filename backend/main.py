from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
import psycopg2
import psycopg2.pool
import os
import logging
from datetime import date
from scheduler import collect_trends

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")


def get_pool():
    return psycopg2.pool.ThreadedConnectionPool(2, 10, DATABASE_URL)


def init_db(pool):
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
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
            cur.execute("CREATE INDEX IF NOT EXISTS idx_trends_date ON trends(date)")
        conn.commit()
        logger.info("✅ БД инициализирована")
    finally:
        pool.putconn(conn)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = get_pool()
    init_db(app.state.pool)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        collect_trends,
        trigger="cron",
        hour=3, minute=0,
        args=[app.state.pool],
        id="daily_trends"
    )
    scheduler.start()
    logger.info("⏰ Планировщик запущен — сбор каждый день в 03:00 UTC")

    # Если БД пустая — сразу собираем данные
    conn = app.state.pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM trends")
            count = cur.fetchone()[0]
    finally:
        app.state.pool.putconn(conn)

    if count == 0:
        logger.info("📊 Таблица пустая — первичный сбор данных...")
        await collect_trends(app.state.pool)

    yield

    scheduler.shutdown()
    app.state.pool.closeall()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/get-pokemon-data")
async def get_data():
    conn = app.state.pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    date::text, country, pokemon,
                    COALESCE(region, '') AS region,
                    score,
                    ROUND((score / NULLIF(MAX(score) OVER (), 0) * 100)::numeric, 2) AS power_percentage
                FROM trends
                ORDER BY date, country, score DESC
            """)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            data = [dict(zip(cols, row)) for row in rows]
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        app.state.pool.putconn(conn)


@app.get("/stats")
async def get_stats():
    conn = app.state.pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM trends")
            total_records = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT country) FROM trends")
            total_countries = cur.fetchone()[0]
            cur.execute("SELECT MAX(date) FROM trends")
            last_update = cur.fetchone()[0]
            cur.execute("SELECT pokemon, SUM(score) as total FROM trends GROUP BY pokemon ORDER BY total DESC LIMIT 1")
            top = cur.fetchone()
        return {
            "total_records": total_records,
            "total_countries": total_countries,
            "last_update": str(last_update) if last_update else None,
            "top_pokemon": {"pokemon": top[0], "total": top[1]} if top else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        app.state.pool.putconn(conn)

@app.get("/collect-now")
async def collect_now():
    await collect_trends(app.state.pool)
    return {"status": "started"}

@app.get("/health")
async def health():
    return {"status": "ok", "date": str(date.today())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
