import asyncio
import psycopg2.pool
import logging
from datetime import date
from pytrends.request import TrendReq

logger = logging.getLogger(__name__)

TOP_POKEMON = [
    "Pikachu",
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


async def collect_trends(pool: psycopg2.pool.ThreadedConnectionPool):
    logger.info(f"🔄 Сбор трендов за {date.today()}")
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
                df = df[df.sum(axis=1) > 0]

                if df.empty:
                    logger.warning(f"  ⚠️  Батч {batch_idx+1} пустой")
                    continue

                data = df.to_dict(orient='index')

                if batch_idx == 0:
                    anchor_scores = {
                        country: float(scores.get('Pikachu', 0))
                        for country, scores in data.items()
                    }
                else:
                    for country, scores in data.items():
                        pikachu_now = float(scores.get('Pikachu', 0))
                        pikachu_anchor = anchor_scores.get(country, 0)
                        if pikachu_now > 0 and pikachu_anchor > 0:
                            scale = pikachu_anchor / pikachu_now
                            for pokemon in scores:
                                if pokemon != 'Pikachu':
                                    data[country][pokemon] = float(scores[pokemon]) * scale

                for country, scores in data.items():
                    for pokemon in batch:
                        if pokemon == 'Pikachu' and batch_idx > 0:
                            continue
                        score = float(scores.get(pokemon, 0))
                        if score > 0:
                            all_records.append((today, country, pokemon, get_region(country), score))

            except Exception as e:
                logger.error(f"  ❌ Ошибка в батче {batch_idx+1}: {e}")

            if batch_idx < len(batches) - 1:
                await asyncio.sleep(8)

        if not all_records:
            logger.error("❌ Нет данных")
            return

        # Сохраняем в PostgreSQL через psycopg2
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM trends WHERE date = %s", (today,))
                cur.executemany("""
                    INSERT INTO trends (date, country, pokemon, region, score)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (date, country, pokemon) DO UPDATE
                        SET score = EXCLUDED.score
                """, all_records)
            conn.commit()
            logger.info(f"✅ Сохранено {len(all_records)} записей за {today}")
        finally:
            pool.putconn(conn)

    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
