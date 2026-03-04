import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Swords, X, TrendingUp, Download, Play, Pause, BarChart2, Maximize2, Minimize2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const TYPE_COLORS = {
  fire: '#ef4444', water: '#3b82f6', grass: '#4ade80', electric: '#facc15',
  psychic: '#a855f7', normal: '#94a3b8', fighting: '#dc2626', flying: '#93c5fd',
  poison: '#c084fc', ground: '#b45309', rock: '#78716c', bug: '#84cc16',
  ghost: '#7c3aed', steel: '#cbd5e1', dragon: '#6366f1', dark: '#475569',
  fairy: '#f472b6', ice: '#7dd3fc', unknown: '#14b8a6'
};

const ALL_TYPES = Object.keys(TYPE_COLORS).filter(t => t !== 'unknown');
const formatNumber = (num) => {
  const n = Math.round(num);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

const pokeKey = (name) => String(name).toLowerCase().trim().replace(/\s+/g, '-');

// ── PokeAvatar ─────────────────────────────────────────────────────────────────
const PokeAvatar = ({ name, cache, size = 34 }) => {
  const url = cache[pokeKey(name)]?.sprites?.front_default;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden'
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', imageRendering: 'pixelated' }} />
        : <span style={{ fontSize: 10, color: '#64748b' }}>?</span>}
    </div>
  );
};

// ── TypeBadge ──────────────────────────────────────────────────────────────────
const TypeBadge = ({ type, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
    fontWeight: active ? 700 : 500, textTransform: 'uppercase', letterSpacing: '0.06em',
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)',
    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
    display: 'flex', alignItems: 'center', gap: 5,
    boxShadow: active ? `0 0 0 1px ${TYPE_COLORS[type]}` : 'none',
  }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[type], opacity: active ? 1 : 0.5, flexShrink: 0 }} />
    {type}
  </button>
);

// ── NEW: Map Hover Tooltip ─────────────────────────────────────────────────────
const MapTooltip = ({ data, name, x, y }) => {
  if (!data) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed', left: x + 14, top: y - 10, zIndex: 9999,
        background: '#0f172a', border: `1px solid ${data.color}`,
        borderRadius: 10, padding: '10px 14px', pointerEvents: 'none',
        minWidth: 160, boxShadow: `0 8px 32px rgba(0,0,0,0.6)`
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 7 }}>{name}</div>
      {data.top.map((p, i) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, gap: 12 }}>
          <span style={{ color: TYPE_COLORS[p.type] || '#94a3b8', textTransform: 'capitalize' }}>
            {i + 1}. {p.name}
          </span>
          <span style={{ color: '#94a3b8' }}>{p.pc}%</span>
        </div>
      ))}
      <div style={{ marginTop: 7, paddingTop: 6, borderTop: '1px solid #1e293b', fontSize: 10, color: '#475569', textTransform: 'capitalize' }}>
        Total: {formatNumber(data.total)} · {data.type}
      </div>
    </motion.div>
  );
};

// ── NEW: Bar Chart Race ────────────────────────────────────────────────────────
const BarRace = ({ mapData }) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  const frames = useMemo(() => {
    const countries = Object.entries(mapData).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    if (!countries.length) return [];
    return Array.from({ length: 12 }, (_, fi) => {
      const ratio = (fi + 1) / 12;
      return countries
        .map(([name, d]) => ({
          name: name.length > 14 ? name.slice(0, 12) + '…' : name,
          value: Math.round(d.total * ratio),
          color: d.color,
        }))
        .sort((a, b) => b.value - a.value);
    });
  }, [mapData]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setFrame(f => {
          if (f >= frames.length - 1) { setPlaying(false); return f; }
          return f + 1;
        });
      }, 550);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, frames.length]);

  const currentFrame = frames[frame] || [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#475569' }}>Frame {frame + 1} / {frames.length}</span>
        <button
          onClick={() => { if (frame >= frames.length - 1) setFrame(0); setPlaying(!playing); }}
          style={{ background: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}
        >
          {playing ? <Pause size={11} /> : <Play size={11} />}
          {playing ? 'PAUSE' : frame >= frames.length - 1 ? 'REPLAY' : 'PLAY'}
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={currentFrame} layout="vertical" margin={{ left: 4, right: 50, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={500}>
              {currentFrame.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              <LabelList dataKey="value" position="right" formatter={formatNumber} style={{ fontSize: 10, fill: '#94a3b8' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── NEW: CSV Export ────────────────────────────────────────────────────────────
const exportCSV = (mapData) => {
  const rows = [['Country', 'Dominant Pokemon', 'Type', 'Total Score', 'Top1', 'Top1%', 'Top2', 'Top2%', 'Top3', 'Top3%']];
  Object.entries(mapData).forEach(([country, d]) => {
    rows.push([
      country, d.dominant, d.type, d.total,
      d.top[0]?.name || '', d.top[0]?.pc || '',
      d.top[1]?.name || '', d.top[1]?.pc || '',
      d.top[2]?.name || '', d.top[2]?.pc || '',
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pokemon_trends.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ── NEW: Time Slider ───────────────────────────────────────────────────────────
const TimeSlider = ({ dates, currentIdx, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
    <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>📅 {dates[0]}</span>
    <input
      type="range" min={0} max={dates.length - 1} value={currentIdx}
      onChange={e => onChange(Number(e.target.value))}
      style={{ flex: 1, accentColor: '#dc2626', cursor: 'pointer' }}
    />
    <span style={{ fontSize: 10, color: '#f1f5f9', fontWeight: 700, whiteSpace: 'nowrap' }}>{dates[currentIdx]}</span>
  </div>
);

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState([]);
  const [selCountry, setSelCountry] = useState(null);
  const [versusMode, setVersusMode] = useState(false);
  const [versusCountries, setVersusCountries] = useState([]);
  const [versusPokemon, setVersusPokemon] = useState(["", ""]);
  const [pokeCache, setPokeCache] = useState({});
  const [bottomTab, setBottomTab] = useState('cards');
  const [hovered, setHovered] = useState(null);
  const [dateIdx, setDateIdx] = useState(0);
  const [heatmap, setHeatmap] = useState(false);
  const [detailCountry, setDetailCountry] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [detailPokemon, setDetailPokemon] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);

  const dates = useMemo(() => {
    const all = [...new Set(rawData.map(i => i.date).filter(Boolean))].sort();
    return all.length ? all : [];
  }, [rawData]);

  // При загрузке дат — автоматически ставим на последнюю (актуальную)
  useEffect(() => {
    if (dates.length > 0) setDateIdx(dates.length - 1);
  }, [dates]);

  useEffect(() => {
    const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    axios.get(`${API}/get-pokemon-data`).then(async (res) => {
      const data = res.data.data;
      setRawData(data);
      const uniqueNames = [...new Set(data.map(i => i.pokemon))];

      // Загружаем кэш из localStorage (хранится 24 часа)
      const CACHE_KEY = 'pokeSprites_v1';
      const CACHE_TTL = 24 * 60 * 60 * 1000;
      let cached = {};
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data: d } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL) cached = d;
        }
      } catch {}

      // Фильтруем только те покемоны которых нет в кэше
      const toFetch = uniqueNames.filter(n => !cached[pokeKey(n)]);
      setPokeCache(cached);

      for (let i = 0; i < toFetch.length; i += 20) {
        const batch = toFetch.slice(i, i + 20);
        await Promise.all(batch.map(async (name) => {
          const key = pokeKey(name);
          try {
            const r = await axios.get(`https://pokeapi.co/api/v2/pokemon/${key}`);
            cached = { ...cached, [key]: r.data };
            setPokeCache(prev => ({ ...prev, [key]: r.data }));
          } catch {}
        }));
      }

      // Сохраняем обновлённый кэш
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: cached })); } catch {}
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Таймер — обновляем каждую минуту
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Данные за предыдущий день для trend indicators
  const prevMapData = useMemo(() => {
    if (dateIdx === 0 || dates.length < 2) return {};
    const prevDate = dates[dateIdx - 1];
    const acc = {};
    rawData.forEach(i => {
      if (i.date !== prevDate) return;
      if (!acc[i.country]) acc[i.country] = { total: 0 };
      acc[i.country].total += i.score;
    });
    return acc;
  }, [rawData, dateIdx, dates]);

  const mapData = useMemo(() => {
    const acc = {};
    const currentDate = dates[dateIdx];

    rawData.forEach(i => {
      if (currentDate && i.date && i.date > currentDate) return;
      const key = pokeKey(i.pokemon);
      const pokeInfo = pokeCache[key];
      const type = pokeInfo?.types?.[0]?.type?.name || 'unknown';
      if (!i.pokemon.toLowerCase().includes(search.toLowerCase())) return;
      if (activeTypes.length > 0 && !activeTypes.includes(type)) return;
      if (!acc[i.country]) acc[i.country] = { total: 0, pokes: {} };
      acc[i.country].total += i.score;
      acc[i.country].pokes[i.pokemon] = (acc[i.country].pokes[i.pokemon] || 0) + i.score;
    });

    const result = {};
    Object.entries(acc).forEach(([name, data]) => {
      const sorted = Object.entries(data.pokes).sort((a, b) => b[1] - a[1]);
      const dominant = sorted[0][0];
      const pokeInfo = pokeCache[pokeKey(dominant)];
      const type = pokeInfo?.types?.[0]?.type?.name || 'unknown';
      result[name] = {
        total: data.total, dominant, type,
        color: TYPE_COLORS[type] || '#475569',
        top: sorted.slice(0, 3).map(([n, v]) => {
          const pi = pokeCache[pokeKey(n)];
          const t = pi?.types?.[0]?.type?.name || 'unknown';
          return { name: n, val: v, pc: Math.round((v / data.total) * 100), type: t };
        })
      };
    });
    return result;
  }, [rawData, search, activeTypes, pokeCache, dateIdx, dates]);

  const maxTotal = useMemo(() => Math.max(...Object.values(mapData).map(d => d.total), 1), [mapData]);

  const topCountries = useMemo(() =>
    Object.entries(mapData).sort((a, b) => b[1].total - a[1].total).slice(0, 15),
  [mapData]);

  const pieData = useMemo(() =>
    topCountries.map(([name, data]) => ({
      name: name.length > 12 ? name.slice(0, 10) + '…' : name,
      value: data.total, color: data.color
    })),
  [topCountries]);

  const toggleType = (type) =>
    setActiveTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const handleCountryClick = (countryName) => {
    if (versusMode) {
      setVersusCountries(prev => {
        if (prev.includes(countryName)) return prev.filter(c => c !== countryName);
        if (prev.length >= 2) return [prev[1], countryName];
        return [...prev, countryName];
      });
    } else {
      setSelCountry(countryName === selCountry ? null : countryName);
    }
  };


  // Skeleton pulse animation style
  const skelStyle = (w = '100%', h = 12) => ({
    width: w, height: h, borderRadius: 6,
    background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  });

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif", overflow: 'hidden' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header skeleton */}
      <header style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ height: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.08em' }}>⚡ POKEMON TRENDS OS</h1>
          <div style={{ flex: 1, maxWidth: 380, ...skelStyle('100%', 8) }} />
        </div>
        <div style={{ display: 'flex', gap: 5, paddingBottom: 8 }}>
          {Array(8).fill(0).map((_, i) => <div key={i} style={{ ...skelStyle(60, 24), borderRadius: 6 }} />)}
        </div>
      </header>

      {/* Main skeleton */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gridTemplateRows: '1fr 280px', gap: 10, padding: 10 }}>
        <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #dc2626', borderTopColor: 'transparent' }} />
          <p style={{ fontSize: 12, color: '#475569', letterSpacing: '0.1em' }}>LOADING MAP...</p>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ ...skelStyle(36, 36), borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={skelStyle('60%', 10)} />
                <div style={skelStyle('40%', 8)} />
              </div>
              <div style={skelStyle(40, 10)} />
            </div>
          ))}
        </div>
        <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: 14, display: 'flex', gap: 10, overflow: 'hidden' }}>
          {Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ minWidth: 190, background: '#0f172a', borderRadius: 10, padding: 12, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={skelStyle('70%', 12)} />
              <div style={skelStyle('50%', 10)} />
              <div style={skelStyle('100%', 6)} />
              <div style={skelStyle('85%', 6)} />
            </div>
          ))}
        </div>
        <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={skelStyle('40%', 10)} />
                <div style={skelStyle('15%', 10)} />
              </div>
              <div style={skelStyle('100%', 4)} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        @media (max-width: 768px) {
          .main-grid { grid-template-columns: 1fr !important; grid-template-rows: 300px auto auto auto !important; }
          .header-slider { display: none !important; }
          .header-countdown { display: none !important; }
          .type-pills { gap: 3px !important; }
          .type-pill { padding: 3px 6px !important; font-size: 9px !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', padding: '0 20px', flexShrink: 0, boxShadow: '0 2px 20px rgba(220,38,38,0.4)' }}>
        <div style={{ height: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>⚡ POKEMON TRENDS OS</h1>

          {/* NEW: Time Slider в хедере */}
          {dates.length > 0 && (
            <div style={{ flex: 1, maxWidth: 380 }}>
              <TimeSlider dates={dates} currentIdx={dateIdx} onChange={setDateIdx} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Countdown timer */}
            {(() => {
              const next3am = new Date();
              next3am.setUTCHours(3, 0, 0, 0);
              if (Date.now() > next3am.getTime()) next3am.setUTCDate(next3am.getUTCDate() + 1);
              const diff = next3am.getTime() - now;
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              return (
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '5px 10px', borderRadius: 8, fontSize: 10, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                  🔄 {h}h {m}m
                </div>
              );
            })()}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Search size={13} />
              <input placeholder="Search..." value={search}
                style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', width: 110, fontSize: 12 }}
                onChange={e => setSearch(e.target.value)} />
              {search && <X size={13} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setSearch('')} />}
            </div>
            {/* NEW: CSV Export кнопка */}
            <button onClick={() => exportCSV(mapData)} title="Export CSV"
              style={{ background: 'rgba(0,0,0,0.25)', border: 'none', padding: '6px 12px', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => { setVersusMode(!versusMode); setVersusCountries([]); }}
              style={{ background: versusMode ? '#fff' : 'rgba(0,0,0,0.25)', color: versusMode ? '#dc2626' : '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <Swords size={14} /> VS
            </button>
          </div>
        </div>

        {/* Type pills */}
        <div style={{ display: 'flex', gap: 5, paddingBottom: 8, flexWrap: 'wrap' }}>
          {activeTypes.length > 0 && (
            <button onClick={() => setActiveTypes([])} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              ALL ✕
            </button>
          )}
          {ALL_TYPES.map(type => (
            <TypeBadge key={type} type={type} active={activeTypes.includes(type)} onClick={() => toggleType(type)} />
          ))}
        </div>
      </header>

      {/* MAIN GRID */}
      <main className="main-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: "1.6fr 1fr", gridTemplateRows: "1fr 280px", gap: 10, padding: 10, overflow: "hidden" }}>

        {/* WORLD MAP */}
        <section style={fullscreen
          ? { position: 'fixed', inset: 0, zIndex: 150, background: '#1e293b', borderRadius: 0 }
          : { background: '#1e293b', borderRadius: 14, border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
          {versusMode && (
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.75)', padding: '7px 12px', borderRadius: 8, fontSize: 11, color: '#94a3b8' }}>
              <Swords size={11} style={{ marginRight: 5, verticalAlign: 'middle', color: '#dc2626' }} />
              {versusPokemon[0] && versusPokemon[1]
                ? <span><span style={{ color: '#ef4444' }}>{versusPokemon[0]}</span> vs <span style={{ color: '#3b82f6' }}>{versusPokemon[1]}</span></span>
                : 'Choose 2 Pokémon below'}
            </div>
          )}
          {/* Heatmap toggle */}
          <button onClick={() => setHeatmap(h => !h)}
            style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, background: heatmap ? '#dc2626' : 'rgba(0,0,0,0.6)', border: `1px solid ${heatmap ? '#dc2626' : '#334155'}`, borderRadius: 7, padding: '5px 10px', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            🌡 {heatmap ? 'Heatmap ON' : 'Heatmap'}
          </button>
          <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: '100%', height: '100%' }}>
            <ZoomableGroup>
              <Geographies geography={geoUrl}>
                {({ geographies }) => geographies.map(geo => {
                  const name = geo.properties.name;
                  const d = mapData[name];
                  const isHighlight = versusCountries.includes(name) || selCountry === name;

                  // Search highlight — подсвечиваем страны где доминирует искомый покемон
                  const searchMatch = search.length > 1 && d?.dominant?.toLowerCase().includes(search.toLowerCase());
                  const searchDim = search.length > 1 && !searchMatch;

                  // Heatmap цвет
                  let fillColor;
                  if (heatmap && d) {
                    const intensity = d.total / maxTotal;
                    const r = Math.round(20 + intensity * 220);
                    const g = Math.round(20 - intensity * 10);
                    const b = Math.round(60 - intensity * 40);
                    fillColor = `rgb(${r},${g},${b})`;
                  } else {
                    fillColor = d ? (d.color || '#475569') : '#2d3748';
                  }

                  // VS mode
                  let vsOpacity = 1;
                  if (versusMode && versusPokemon[0] && versusPokemon[1] && versusPokemon[0] !== versusPokemon[1]) {
                    const dominant = d?.dominant;
                    if (dominant === versusPokemon[0]) fillColor = '#ef4444';
                    else if (dominant === versusPokemon[1]) fillColor = '#3b82f6';
                    else vsOpacity = 0.2;
                  }

                  const opacity = vsOpacity * (searchDim ? 0.15 : searchMatch ? 1 : isHighlight ? 1 : (selCountry || versusCountries.length ? 0.6 : 1));

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillColor}
                      stroke="#0f172a" strokeWidth={0.5}
                      onClick={() => d && !versusMode && setDetailCountry(name)}
                      onMouseEnter={(evt) => d && setHovered({ name, x: evt.clientX, y: evt.clientY })}
                      onMouseMove={(evt) => hovered && setHovered(h => ({ ...h, x: evt.clientX, y: evt.clientY }))}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        default: { outline: 'none', opacity, filter: (isHighlight || searchMatch) ? 'brightness(1.4)' : 'none' },
                        hover: { fill: '#ffffff', cursor: d ? 'pointer' : 'default', outline: 'none' },
                        pressed: { outline: 'none' }
                      }}
                    />
                  );
                })}
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hovered && mapData[hovered.name] && (
              <MapTooltip data={mapData[hovered.name]} name={hovered.name} x={hovered.x} y={hovered.y} />
            )}
          </AnimatePresence>

          {/* Fullscreen button */}
          <button onClick={() => setFullscreen(f => !f)}
            style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.6)', border: '1px solid #334155', borderRadius: 7, padding: '5px 8px', color: '#fff', cursor: 'pointer' }}>
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Type legend */}
          {!fullscreen && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', maxWidth: 180 }}>
              {Object.entries(TYPE_COLORS).filter(([t]) => t !== 'unknown').map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, textTransform: 'capitalize', color: '#94a3b8' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                  {type}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* LOCAL TRENDS */}
        <section style={{ background: '#1e293b', borderRadius: 14, padding: '14px 10px', overflowY: 'auto', border: '1px solid #334155' }}>
          <h3 style={{ marginBottom: 10, fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Globe size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Local Trends
          </h3>
          {topCountries.map(([name, data], idx) => {
            const prev = prevMapData[name];
            const trendDiff = prev ? data.total - prev.total : null;
            const trendIcon = trendDiff === null ? null : trendDiff > 0 ? '↑' : trendDiff < 0 ? '↓' : '→';
            const trendColor = trendDiff === null ? '#64748b' : trendDiff > 0 ? '#4ade80' : trendDiff < 0 ? '#f87171' : '#94a3b8';
            return (
            <motion.div key={name}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.025 }}
              onClick={() => setDetailCountry(name)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', background: selCountry === name ? 'rgba(255,255,255,0.06)' : '#0f172a',
                borderRadius: 9, marginBottom: 7, borderLeft: `3px solid ${data.color}`,
                cursor: 'pointer', transition: 'background 0.2s'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 10, color: '#475569', minWidth: 16, textAlign: 'right' }}>{idx + 1}</span>
                <PokeAvatar name={data.dominant} cache={pokeCache} size={30} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{name}</div>
                  <div style={{ fontSize: 10, color: data.color, textTransform: 'capitalize', cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setDetailPokemon(data.dominant); }}>{data.dominant}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', position: 'relative' }}
                title="Google Trends interest score. 100 = peak popularity for this country on the selected date. Based on relative search interest, not absolute query count.">
                <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {Math.round((data.total / maxTotal) * 100)}
                  <span style={{ fontSize: 9, color: '#475569', fontWeight: 400 }}>/100</span>
                  {trendIcon && <span style={{ fontSize: 11, color: trendColor, fontWeight: 900 }}>{trendIcon}</span>}
                </div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>interest ℹ️</div>
              </div>
            </motion.div>
            );
          })}
        </section>

        {/* BOTTOM LEFT — Cards / Type Distribution tabs */}
        <section style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #334155', flexShrink: 0 }}>
            {[['cards', '🃏 Country Cards'], ['types', '📊 Type Distribution']].map(([key, label]) => (
              <button key={key} onClick={() => setBottomTab(key)} style={{
                flex: 1, padding: '8px', background: bottomTab === key ? '#0f172a' : 'transparent',
                border: 'none', color: bottomTab === key ? '#f1f5f9' : '#64748b',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                borderBottom: bottomTab === key ? '2px solid #dc2626' : '2px solid transparent'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'hidden', padding: '10px 12px' }}>
            {bottomTab === 'cards' ? (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', height: '100%', alignItems: 'flex-start' }}
                onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); }}>
                {(selCountry
                  ? [[selCountry, mapData[selCountry]], ...Object.entries(mapData).filter(([n]) => n !== selCountry).sort((a, b) => b[1].total - a[1].total)]
                  : Object.entries(mapData).sort((a, b) => b[1].total - a[1].total)
                ).map(([name, data]) => data && (
                  <div key={name} style={{
                    minWidth: 190, background: '#0f172a', padding: 12, borderRadius: 10,
                    border: `1px solid ${selCountry === name ? data.color : '#1e293b'}`,
                    flexShrink: 0, transition: 'border-color 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                      <PokeAvatar name={data.dominant} cache={pokeCache} size={28} />
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700 }}>{name}</p>
                        <p style={{ fontSize: 9, color: data.color, textTransform: 'capitalize' }}>{data.type}</p>
                      </div>
                    </div>
                    {data.top.map(p => (
                      <div key={p.name} style={{ marginBottom: 7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: TYPE_COLORS[p.type] || '#94a3b8', textTransform: 'capitalize' }}>{p.name}</span>
                          <span style={{ color: '#64748b' }}>{p.pc}%</span>
                        </div>
                        <div style={{ height: 3, background: '#1e293b', borderRadius: 2 }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${p.pc}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                            style={{ height: '100%', background: TYPE_COLORS[p.type] || '#94a3b8', borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              /* TYPE DISTRIBUTION */
              (() => {
                const typeCounts = {};
                const typeScores = {};
                Object.values(mapData).forEach(d => {
                  typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
                  typeScores[d.type] = (typeScores[d.type] || 0) + d.total;
                });
                const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);
                const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
                const maxCount = sorted[0]?.[1] || 1;

                return (
                  <div style={{ display: 'flex', gap: 20, height: '100%' }}>
                    {/* Bar chart */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sorted.map(([type, count], i) => {
                        const color = TYPE_COLORS[type] || '#94a3b8';
                        const pct = Math.round((count / total) * 100);
                        return (
                          <motion.div key={type}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3, alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                                <span style={{ color, textTransform: 'capitalize', fontWeight: 600 }}>{type}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, color: '#64748b' }}>
                                <span>{count} {count === 1 ? 'country' : 'countries'}</span>
                                <span style={{ color: '#334155' }}>·</span>
                                <span style={{ color: '#94a3b8' }}>{pct}%</span>
                              </div>
                            </div>
                            <div style={{ height: 6, background: '#0f172a', borderRadius: 3 }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(count / maxCount) * 100}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.03 }}
                                style={{ height: '100%', background: color, borderRadius: 3, opacity: 0.85 }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Summary */}
                    <div style={{ width: 110, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: TYPE_COLORS[sorted[0]?.[0]] || '#94a3b8' }}>{sorted[0]?.[1]}</div>
                        <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>countries lead by</div>
                        <div style={{ fontSize: 10, color: TYPE_COLORS[sorted[0]?.[0]] || '#94a3b8', textTransform: 'capitalize', fontWeight: 700 }}>{sorted[0]?.[0]}</div>
                      </div>
                      <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>{sorted.length}</div>
                        <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>active types</div>
                        <div style={{ fontSize: 9, color: '#334155' }}>of {ALL_TYPES.length} total</div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </section>

        {/* GLOBAL TOP POKEMON */}
        <section style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: '12px 14px' }}>
          <h3 style={{ marginBottom: 10, fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <TrendingUp size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Global Top Pokémon
          </h3>
          {(() => {
            // Считаем глобальный рейтинг покемонов
            const globalScores = {};
            Object.values(mapData).forEach(country => {
              country.top.forEach(p => {
                globalScores[p.name] = (globalScores[p.name] || 0) + p.val;
              });
            });
            const topPokemon = Object.entries(globalScores)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, val]) => {
                const pi = pokeCache[pokeKey(name)];
                const type = pi?.types?.[0]?.type?.name || 'unknown';
                return { name, val, type };
              });
            const maxVal = topPokemon[0]?.val || 1;

            return topPokemon.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topPokemon.map((p, i) => (
                  <div key={p.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#475569', fontSize: 10, minWidth: 14 }}>{i + 1}</span>
                        <PokeAvatar name={p.name} cache={pokeCache} size={22} />
                        <span style={{ color: TYPE_COLORS[p.type] || '#94a3b8', textTransform: 'capitalize', cursor: 'pointer' }}
                          onClick={() => setDetailPokemon(p.name)}>{p.name}</span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: 10 }}>{formatNumber(p.val)}</span>
                    </div>
                    <div style={{ height: 3, background: '#0f172a', borderRadius: 2 }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.val / maxVal) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                        style={{ height: '100%', background: TYPE_COLORS[p.type] || '#94a3b8', borderRadius: 2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', color: '#475569', fontSize: 12 }}>No data</div>
            );
          })()}
        </section>

      </main>

      {/* VERSUS PANEL */}
      <AnimatePresence>
        {versusMode && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', borderTop: '2px solid #dc2626', padding: '14px 24px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <Swords size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Pokémon VS Mode
              </span>
              <button onClick={() => { setVersusMode(false); setVersusPokemon(['', '']); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* Selectors + Stats */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>

              {/* Pokemon A */}
              {[0, 1].map(idx => {
                const color = idx === 0 ? '#ef4444' : '#3b82f6';
                const name = versusPokemon[idx];
                const allPokemon = [...new Set(Object.values(mapData).map(d => d.dominant))].sort();
                const pi = pokeCache[pokeKey(name)];
                const type = pi?.types?.[0]?.type?.name || 'unknown';

                // Считаем сколько стран где этот покемон доминирует
                const countriesWon = Object.entries(mapData).filter(([, d]) => d.dominant === name).length;

                return (
                  <React.Fragment key={idx}>
                    <div style={{ flex: 1, background: '#1e293b', borderRadius: 12, padding: '10px 14px', border: `1px solid ${color}44` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {name && pi?.sprites?.front_default
                            ? <img src={pi.sprites.front_default} alt={name} style={{ width: 40, imageRendering: 'pixelated' }} />
                            : <span style={{ fontSize: 20 }}>{idx === 0 ? '🔴' : '🔵'}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <select value={name} onChange={e => setVersusPokemon(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                            style={{ background: '#0f172a', border: `1px solid ${color}66`, borderRadius: 6, color: '#f1f5f9', fontSize: 12, padding: '4px 8px', width: '100%', cursor: 'pointer' }}>
                            <option value="">— choose pokémon —</option>
                            {allPokemon.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          {name && <div style={{ fontSize: 10, color: TYPE_COLORS[type] || '#94a3b8', marginTop: 3, textTransform: 'capitalize' }}>{type}</div>}
                        </div>
                      </div>
                      {name && (
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color }}>{countriesWon}</div>
                            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Countries</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color }}>
                              {formatNumber(Object.values(mapData).reduce((sum, d) => {
                                const p = d.top.find(t => t.name === name);
                                return sum + (p?.val || 0);
                              }, 0))}
                            </div>
                            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Score</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {idx === 0 && (
                      <div style={{ color: '#dc2626', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>VS</div>
                    )}
                  </React.Fragment>
                );
              })}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WINNER MODAL — центр экрана */}
      <AnimatePresence>
        {versusMode && versusPokemon[0] && versusPokemon[1] && versusPokemon[0] !== versusPokemon[1] && (() => {
          const scoreA = Object.values(mapData).reduce((s, d) => s + (d.top.find(t => t.name === versusPokemon[0])?.val || 0), 0);
          const scoreB = Object.values(mapData).reduce((s, d) => s + (d.top.find(t => t.name === versusPokemon[1])?.val || 0), 0);
          const winner = scoreA > scoreB ? versusPokemon[0] : versusPokemon[1];
          const loser  = scoreA > scoreB ? versusPokemon[1] : versusPokemon[0];
          const winColor = scoreA > scoreB ? '#ef4444' : '#3b82f6';
          const loseColor = scoreA > scoreB ? '#3b82f6' : '#ef4444';
          const winScore = Math.max(scoreA, scoreB);
          const loseScore = Math.min(scoreA, scoreB);
          const winCountries = Object.values(mapData).filter(d => d.dominant === winner).length;
          const loseCountries = Object.values(mapData).filter(d => d.dominant === loser).length;
          const pct = Math.round((winScore / (winScore + loseScore)) * 100);

          return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, pointerEvents: 'none' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ pointerEvents: 'all', width: 320 }}
            >
              {/* Glow backdrop */}
              <div style={{
                background: `radial-gradient(ellipse at center, ${winColor}22 0%, transparent 70%)`,
                position: 'absolute', inset: -40, borderRadius: '50%',
                filter: 'blur(20px)',
              }} />

              <div style={{
                position: 'relative',
                background: 'rgba(15,23,42,0.95)',
                border: `2px solid ${winColor}`,
                borderRadius: 20,
                padding: '24px 28px',
                textAlign: 'center',
                boxShadow: `0 0 40px ${winColor}44, 0 20px 60px rgba(0,0,0,0.8)`,
                width: 320,
              }}>
                <button onClick={() => setVersusPokemon(['', ''])}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
                {/* Trophy */}
                <div style={{ fontSize: 32, marginBottom: 4 }}>🏆</div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Global Winner</div>

                {/* Winner sprite + name */}
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}
                >
                  <PokeAvatar name={winner} cache={pokeCache} size={72} />
                </motion.div>
                <div style={{ fontWeight: 900, fontSize: 22, color: winColor, textTransform: 'capitalize', letterSpacing: '0.04em' }}>
                  {winner}
                </div>

                {/* Score bar */}
                <div style={{ margin: '14px 0 10px', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: '50%' }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ height: '100%', background: `linear-gradient(90deg, ${winColor}, ${winColor}aa)`, borderRadius: 3 }}
                  />
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ color: winColor, fontWeight: 700 }}>{formatNumber(winScore)}</div>
                    <div style={{ color: '#475569', fontSize: 9 }}>{winCountries} countries</div>
                  </div>
                  <div style={{ color: '#334155', fontSize: 12, alignSelf: 'center' }}>vs</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: loseColor, fontWeight: 700 }}>{formatNumber(loseScore)}</div>
                    <div style={{ color: '#475569', fontSize: 9 }}>{loseCountries} countries</div>
                  </div>
                </div>

                {/* Loser name */}
                <div style={{ marginTop: 8, fontSize: 10, color: '#334155', textTransform: 'capitalize' }}>
                  vs {loser}
                </div>

                {/* Share button */}
                <button
                  onClick={() => {
                    const url = `https://pokemon-trends.vercel.app/?vs=${encodeURIComponent(winner)}&vs2=${encodeURIComponent(loser)}`;
                    navigator.clipboard.writeText(url).then(() => {
                      setToast('🔗 Link copied!');
                      setTimeout(() => setToast(null), 2500);
                    });
                  }}
                  style={{ marginTop: 12, width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 8, padding: '7px', color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.04em' }}>
                  🔗 Copy Link
                </button>
              </div>
            </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* COUNTRY DETAIL MODAL */}
      <AnimatePresence>
        {detailCountry && mapData[detailCountry] && (() => {
          const d = mapData[detailCountry];
          const history = rawData
            .filter(i => i.country === detailCountry)
            .reduce((acc, i) => {
              acc[i.date] = (acc[i.date] || 0) + i.score;
              return acc;
            }, {});
          const historyArr = Object.entries(history).sort().map(([date, val]) => ({ date: date.slice(5), val: Math.round(val) }));

          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailCountry(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#1e293b', border: `2px solid ${d.color}`, borderRadius: 20, padding: '24px', width: 380, boxShadow: `0 0 40px ${d.color}33` }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <PokeAvatar name={d.dominant} cache={pokeCache} size={48} />
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{detailCountry}</div>
                      <div style={{ fontSize: 11, color: d.color, textTransform: 'capitalize' }}>{d.type} · {formatNumber(d.total)} total</div>
                    </div>
                  </div>
                  <button onClick={() => setDetailCountry(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* Top pokemon */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Top Pokémon</div>
                  {d.top.map(p => (
                    <div key={p.name} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PokeAvatar name={p.name} cache={pokeCache} size={20} />
                          <span style={{ color: TYPE_COLORS[p.type], textTransform: 'capitalize' }}>{p.name}</span>
                        </div>
                        <span style={{ color: '#94a3b8' }}>{p.pc}%</span>
                      </div>
                      <div style={{ height: 4, background: '#0f172a', borderRadius: 2 }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${p.pc}%` }} transition={{ duration: 0.5, ease: 'easeOut' }}
                          style={{ height: '100%', background: TYPE_COLORS[p.type], borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* History chart */}
                {historyArr.length > 1 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Score History</div>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={historyArr} barSize={16}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
                        <Bar dataKey="val" fill={d.color} radius={[3, 3, 0, 0]} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: `1px solid ${d.color}`, borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: d.color }} formatter={v => formatNumber(v)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* POKEMON DETAIL MODAL */}
      <AnimatePresence>
        {detailPokemon && (() => {
          const pi = pokeCache[pokeKey(detailPokemon)];
          const type = pi?.types?.[0]?.type?.name || 'unknown';
          const color = TYPE_COLORS[type] || '#94a3b8';
          const dominantIn = Object.entries(mapData).filter(([, d]) => d.dominant === detailPokemon).map(([c]) => c);
          const totalScore = Object.values(mapData).reduce((s, d) => s + (d.top.find(t => t.name === detailPokemon)?.val || 0), 0);
          const globalRank = Object.entries(
            Object.values(mapData).reduce((acc, d) => {
              d.top.forEach(p => { acc[p.name] = (acc[p.name] || 0) + p.val; });
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === detailPokemon) + 1;

          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailPokemon(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#1e293b', border: `2px solid ${color}`, borderRadius: 20, padding: 28, width: 420, boxShadow: `0 0 60px ${color}44` }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {pi?.sprites?.front_default && <img src={pi.sprites.front_default} alt={detailPokemon} style={{ width: 64, imageRendering: 'pixelated' }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'capitalize' }}>{detailPokemon}</div>
                      <div style={{ fontSize: 12, color, textTransform: 'capitalize' }}>{pi?.types?.map(t => t.type.name).join(' / ') || type}</div>
                      {pi?.stats && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Base HP: {pi.stats[0]?.base_stat} · ATK: {pi.stats[1]?.base_stat}</div>}
                    </div>
                  </div>
                  <button onClick={() => setDetailPokemon(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* Global stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  {[['🌍 Countries', dominantIn.length], ['🏆 Global Rank', `#${globalRank}`], ['📊 Total Score', formatNumber(totalScore)]].map(([label, val]) => (
                    <div key={label} style={{ flex: 1, background: '#0f172a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color }}>{val}</div>
                      <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Dominant countries list */}
                {dominantIn.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dominates in</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {dominantIn.slice(0, 16).map(c => (
                        <span key={c} onClick={() => { setDetailPokemon(null); setDetailCountry(c); }}
                          style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 6, padding: '3px 8px', fontSize: 10, color, cursor: 'pointer' }}>{c}</span>
                      ))}
                      {dominantIn.length > 16 && <span style={{ fontSize: 10, color: '#475569' }}>+{dominantIn.length - 16} more</span>}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: '#1e293b', border: '1px solid #4ade80',
              borderRadius: 10, padding: '10px 20px',
              fontSize: 13, fontWeight: 600, color: '#4ade80',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 9999, whiteSpace: 'nowrap',
            }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
