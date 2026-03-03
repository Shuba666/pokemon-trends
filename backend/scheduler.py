"""
scheduler.py — сбор данных из Google Trends каждые 24 часа.

Логика:
- Берём топ-20 покемонов
- Google Trends позволяет сравнивать максимум 5 за раз
- Делим на батчи по 5, собираем по регионам (странам)
- Нормализуем относительно первого батча (anchor pokemon = Pikachu)
- Сохраняем в PostgreSQL
"""

import asyncio
import asyncpg
import logging
from datetime import date, timedelta
from pytrends.request import TrendReq
import pandas as pd
import time

logger = logging.getLogger(__name__)

# ── Топ-20 покемонов (по глобальной популярности) ─────────────────────────────
TOP_POKEMON = [
    "Pikachu",      # anchor — всегда в первом батче для нормализации
    "Charizard",
    "Mewtwo",
    "Eevee",
    "Gengar",
    "Snorlax",
    "Lucario",
    "Gardevoir",
    "Rayquaza",
    "Umbreon",
    "Bulbasaur",
    "Squirtle",
    "Charmander",
    "Jigglypuff",
    "Mew",
    "Arcanine",
    "Gyarados",
    "Dragonite",
    "Vaporeon",
    "Sylveon",
]

# Батчи по 5 (лимит Google Trends), Pikachu — anchor в каждом батче
def make_batches(pokemon_list: list, anchor: str = "Pikachu") -> list:
    others = [p for p in pokemon_list if p != anchor]
    batches = []
    for i in range(0, len(others), 4):   # 4 + anchor = 5
        batch = [anchor] + others[i:i+4]
        batches.append(batch)
    return batches


async def collect_trends(pool: asyncpg.Pool):
    """Основная функция сбора — вызывается планировщиком каждый день."""
    logger.info(f"🔄 Начинаем сбор трендов за {date.today()}")
    today = date.today()

    try:
        pytrends = TrendReq(hl='en-US', tz=0, timeout=(10, 25), retries=3, backoff_factor=0.5)
        batches = make_batches(TOP_POKEMON)

        # Anchor scores (Pikachu по регионам) — для нормализации батчей
        anchor_scores: dict = {}
        all_records: list = []

        for batch_idx, batch in enumerate(batches):
            logger.info(f"  📦 Батч {batch_idx + 1}/{len(batches)}: {batch}")

            try:
                pytrends.build_payload(
                    batch,
                    timeframe='now 1-d',   # последние 24 часа
                    gprop=''
                )
                df = pytrends.interest_by_region(resolution='COUNTRY', inc_low_vol=True, inc_geo_code=False)
                df = df[df.sum(axis=1) > 0]   # убираем страны без данных

                if df.empty:
                    logger.warning(f"  ⚠️  Батч {batch_idx + 1} вернул пустой датафрейм")
                    continue

                # Нормализуем: для первого батча запоминаем Pikachu как базу
                if batch_idx == 0:
                    anchor_scores = df['Pikachu'].to_dict()
                else:
                    # Масштабируем текущий батч относительно Pikachu
                    for country in df.index:
                        if country in anchor_scores and anchor_scores[country] > 0 and df.loc[country, 'Pikachu'] > 0:
                            scale = anchor_scores[country] / df.loc[country, 'Pikachu']
                            for col in df.columns:
                                if col != 'Pikachu':
                                    df.loc[country, col] *= scale

                # Собираем записи
                for country, row in df.iterrows():
                    for pokemon in batch:
                        if pokemon == 'Pikachu' and batch_idx > 0:
                            continue   # Pikachu уже добавлен из первого батча
                        score = float(row.get(pokemon, 0))
                        if score > 0:
                            all_records.append({
                                "date":    today,
                                "country": country,
                                "pokemon": pokemon,
                                "region":  _get_region(country),
                                "score":   score,
                            })

            except Exception as e:
                logger.error(f"  ❌ Ошибка в батче {batch_idx + 1}: {e}")

            # Пауза между батчами чтобы не получить бан от Google
            if batch_idx < len(batches) - 1:
                await asyncio.sleep(8)

        if not all_records:
            logger.error("❌ Нет данных для сохранения")
            return

        # Сохраняем в PostgreSQL
        await _save_to_db(pool, all_records, today)
        logger.info(f"✅ Сохранено {len(all_records)} записей за {today}")

    except Exception as e:
        logger.error(f"❌ Критическая ошибка сбора трендов: {e}")


async def _save_to_db(pool: asyncpg.Pool, records: list, today: date):
    """Сохраняет записи в БД, заменяя данные за сегодня если они уже есть."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Удаляем старые данные за сегодня (на случай повторного запуска)
            deleted = await conn.execute("DELETE FROM trends WHERE date = $1", today)
            logger.info(f"  🗑  Удалено старых записей за {today}: {deleted}")

            # Вставляем новые батчем
            await conn.executemany("""
                INSERT INTO trends (date, country, pokemon, region, score)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (date, country, pokemon) DO UPDATE
                    SET score = EXCLUDED.score
            """, [
                (r["date"], r["country"], r["pokemon"], r["region"], r["score"])
                for r in records
            ])


def _get_region(country: str) -> str:
    """Простой маппинг страны → регион для фильтров на фронте."""
    regions = {
        "Europe": ["Germany", "France", "Italy", "Spain", "Poland", "Netherlands",
                   "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Switzerland",
                   "Austria", "Portugal", "Czech Republic", "Hungary", "Romania",
                   "Greece", "Ukraine", "United Kingdom"],
        "Asia":   ["Japan", "China", "South Korea", "India", "Indonesia", "Thailand",
                   "Vietnam", "Philippines", "Malaysia", "Singapore", "Taiwan",
                   "Hong Kong", "Bangladesh", "Pakistan"],
        "Americas": ["United States", "Brazil", "Mexico", "Canada", "Argentina",
                     "Colombia", "Chile", "Peru", "Venezuela", "Ecuador"],
        "Oceania":  ["Australia", "New Zealand"],
        "Africa":   ["South Africa", "Nigeria", "Egypt", "Kenya", "Ghana", "Morocco"],
        "Middle East": ["Turkey", "Saudi Arabia", "United Arab Emirates", "Israel",
                        "Iran", "Iraq", "Jordan", "Lebanon"],
    }
    for region, countries in regions.items():
        if country in countries:
            return region
    return "Other"
