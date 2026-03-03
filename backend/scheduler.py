"""
scheduler.py — сбор данных из Google Trends каждые 24 часа.
Без зависимости от pandas — только чистый Python.
"""

import asyncio
import asyncpg
import logging
from datetime import date
from pytrends.request import TrendReq

logger = logging.getLogger(__name__)

TOP_POKEMON = [
    "Pikachu",    # anchor — всегда первый для нормализации
    "Charizard", "Mewtwo", "Eevee", "Gengar",
    "Snorlax", "Lucario", "Gardevoir", "Rayquaza", "Umbreon",
    "Bulbasaur", "Squirtle", "Charmander", "Jigglypuff", "Mew",
    "Arcanine", "Gyarados", "Dragonite", "Vaporeon", "Sylveon",
]

REGIONS = {
    "Europe": ["Germany","France","Italy","Spain","Poland","Netherlands",
               "Belgium","Sweden","Norway","Denmark","Finland","Switzerland",
               "Austria","Portugal","Czech Republic","Hungary","Romania",
               "Greece","Ukraine","United Kingdom"],
    "Asia":   ["Japan","China","South Korea","India","Indonesia","Thailand",
               "Vietnam","Philippines","Malaysia","Singapore","Taiwan"],
    "Americas": ["United States","Brazil","Mexico","Canada","Argentina",
                 "Colombia","Chile","Peru","Venezuela","Ecuador"],
    "Oceania":  ["Australia","New Zealand"],
    "Africa":   ["South Africa","Nigeria","Egypt","Kenya","Ghana","Morocco"],
    "Middle East": ["Turkey","Saudi Arabia","United Arab Emirates","Israel",
                    "Iran","Iraq","Jordan","Lebanon"],
}

def get_region(country: str) -> str:
    for region, countries in REGIONS.items():
        if country in countries:
            return region
    return "Other"

def make_batches(pokemon_list: list, anchor: str = "Pikachu") -> list:
    others = [p for p in pokemon_list if p != anchor]
    return [[anchor] + others[i:i+4] for i in range(0, len(others), 4)]


async def collect_trends(pool: asyncpg.Pool):
    logger.info(f"🔄 Начинаем сбор трендов за {date.today()}")
    today = date.today()

    try:
        pytrends = TrendReq(hl='en-US', tz=0, timeout=(10, 25), retries=3, backoff_factor=0.5)
        batches = make_batches(TOP_POKEMON)
        anchor_scores: dict = {}
        all_records: list = []

        for batch_idx, batch in enumerate(batches):
            logger.info(f"  📦 Батч {batch_idx+1}/{len(batches)}: {batch}")
            try:
                pytrends.build_payload(batch, timeframe='now 1-d', gprop='')
                df = pytrends.interest_by_region(
                    resolution='COUNTRY', inc_low_vol=True, inc_geo_code=False
                )

                # Убираем строки где все значения 0
                df = df[df.sum(axis=1) > 0]

                if df.empty:
                    logger.warning(f"  ⚠️  Батч {batch_idx+1} пустой")
                    continue

                # Конвертируем DataFrame в обычный dict без pandas зависимости
                data = df.to_dict(orient='index')  # {country: {pokemon: score}}

                if batch_idx == 0:
                    # Запоминаем Pikachu как anchor для нормализации
                    anchor_scores = {
                        country: float(scores.get('Pikachu', 0))
                        for country, scores in data.items()
                    }
                else:
                    # Масштабируем относительно Pikachu
                    for country, scores in data.items():
                        pikachu_now = float(scores.get('Pikachu', 0))
                        pikachu_anchor = anchor_scores.get(country, 0)
                        if pikachu_now > 0 and pikachu_anchor > 0:
                            scale = pikachu_anchor / pikachu_now
                            for pokemon in scores:
                                if pokemon != 'Pikachu':
                                    data[country][pokemon] = float(scores[pokemon]) * scale

                # Собираем записи
                for country, scores in data.items():
                    for pokemon in batch:
                        if pokemon == 'Pikachu' and batch_idx > 0:
                            continue
                        score = float(scores.get(pokemon, 0))
                        if score > 0:
                            all_records.append({
                                "date":    today,
                                "country": country,
                                "pokemon": pokemon,
                                "region":  get_region(country),
                                "score":   score,
                            })

            except Exception as e:
                logger.error(f"  ❌ Ошибка в батче {batch_idx+1}: {e}")

            if batch_idx < len(batches) - 1:
                await asyncio.sleep(8)

        if not all_records:
            logger.error("❌ Нет данных для сохранения")
            return

        await _save_to_db(pool, all_records, today)
        logger.info(f"✅ Сохранено {len(all_records)} записей за {today}")

    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")


async def _save_to_db(pool: asyncpg.Pool, records: list, today: date):
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM trends WHERE date = $1", today)
            await conn.executemany("""
                INSERT INTO trends (date, country, pokemon, region, score)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (date, country, pokemon) DO UPDATE
                    SET score = EXCLUDED.score
            """, [
                (r["date"], r["country"], r["pokemon"], r["region"], r["score"])
                for r in records
            ])
