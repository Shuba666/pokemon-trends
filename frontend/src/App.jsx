import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Swords, X, TrendingUp, Download, Play, Pause, BarChart2 } from 'lucide-react';
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
  const [pokeCache, setPokeCache] = useState({});
  const [bottomTab, setBottomTab] = useState('cards');
  const [hovered, setHovered] = useState(null);
  const [dateIdx, setDateIdx] = useState(0); // будет обновлён после загрузки дат

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
      for (let i = 0; i < uniqueNames.length; i += 20) {
        const batch = uniqueNames.slice(i, i + 20);
        await Promise.all(batch.map(async (name) => {
          const key = pokeKey(name);
          try {
            const r = await axios.get(`https://pokeapi.co/api/v2/pokemon/${key}`);
            setPokeCache(prev => ({ ...prev, [key]: r.data }));
          } catch {}
        }));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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

  if (loading) return (
    <div style={{ background: '#0f172a', height: '100vh', color: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', gap: 20 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #dc2626', borderTopColor: 'transparent' }} />
      <p style={{ fontSize: 13, color: '#94a3b8', letterSpacing: '0.1em' }}>SYNCING POKEMON TRENDS OS...</p>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif", overflow: 'hidden' }}>

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
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gridTemplateRows: '1fr 280px', gap: 10, padding: 10, overflow: 'hidden' }}>

        {/* WORLD MAP */}
        <section style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
          {versusMode && (
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.75)', padding: '7px 12px', borderRadius: 8, fontSize: 11, color: '#94a3b8' }}>
              <Swords size={11} style={{ marginRight: 5, verticalAlign: 'middle', color: '#dc2626' }} />
              {versusCountries.length === 0 ? 'Click 2 countries' : versusCountries.join(' vs ')}
            </div>
          )}
          <ComposableMap projectionConfig={{ scale: 145 }} style={{ width: '100%', height: '100%' }}>
            <ZoomableGroup>
              <Geographies geography={geoUrl}>
                {({ geographies }) => geographies.map(geo => {
                  const name = geo.properties.name;
                  const d = mapData[name];
                  const isHighlight = versusCountries.includes(name) || selCountry === name;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={d ? (d.color || '#475569') : '#2d3748'}
                      stroke="#0f172a" strokeWidth={0.5}
                      onClick={() => d && handleCountryClick(name)}
                      onMouseEnter={(evt) => d && setHovered({ name, x: evt.clientX, y: evt.clientY })}
                      onMouseMove={(evt) => hovered && setHovered(h => ({ ...h, x: evt.clientX, y: evt.clientY }))}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        default: { outline: 'none', opacity: isHighlight ? 1 : (selCountry || versusCountries.length ? 0.6 : 1), filter: isHighlight ? 'brightness(1.4)' : 'none' },
                        hover: { fill: '#ffffff', cursor: d ? 'pointer' : 'default', outline: 'none' },
                        pressed: { outline: 'none' }
                      }}
                    />
                  );
                })}
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* NEW: Hover tooltip */}
          <AnimatePresence>
            {hovered && mapData[hovered.name] && (
              <MapTooltip data={mapData[hovered.name]} name={hovered.name} x={hovered.x} y={hovered.y} />
            )}
          </AnimatePresence>
        </section>

        {/* LOCAL TRENDS */}
        <section style={{ background: '#1e293b', borderRadius: 14, padding: '14px 10px', overflowY: 'auto', border: '1px solid #334155' }}>
          <h3 style={{ marginBottom: 10, fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Globe size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Local Trends
          </h3>
          {topCountries.map(([name, data], idx) => (
            <motion.div key={name}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.025 }}
              onClick={() => setSelCountry(name === selCountry ? null : name)}
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
                  <div style={{ fontSize: 10, color: data.color, textTransform: 'capitalize' }}>{data.dominant}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{formatNumber(data.total)}</div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{data.type}</div>
              </div>
            </motion.div>
          ))}
        </section>

        {/* BOTTOM LEFT — Cards / Bar Race tabs */}
        <section style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #334155', flexShrink: 0 }}>
            {[['cards', '🃏 Country Cards'], ['race', '🏁 Bar Race']].map(([key, label]) => (
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
                  ? [[selCountry, mapData[selCountry]], ...Object.entries(mapData).filter(([n]) => n !== selCountry)]
                  : Object.entries(mapData)
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
              <BarRace mapData={mapData} />
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
                        <span style={{ color: TYPE_COLORS[p.type] || '#94a3b8', textTransform: 'capitalize' }}>{p.name}</span>
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
        {versusMode && versusCountries.length === 2 && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', borderTop: '2px solid #dc2626', padding: '16px 24px', display: 'flex', gap: 24, alignItems: 'flex-start', zIndex: 100 }}>
            <button onClick={() => setVersusCountries([])} style={{ position: 'absolute', top: 10, right: 14, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
              <X size={16} />
            </button>
            <div style={{ color: '#dc2626', fontSize: 24, fontWeight: 900, alignSelf: 'center', flex: 'none' }}>VS</div>
            {versusCountries.map(cname => {
              const d = mapData[cname];
              if (!d) return null;
              return (
                <div key={cname} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                    <PokeAvatar name={d.dominant} cache={pokeCache} size={36} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{cname}</div>
                      <div style={{ fontSize: 11, color: d.color, textTransform: 'capitalize' }}>{d.type} · {formatNumber(d.total)}</div>
                    </div>
                  </div>
                  {d.top.map(p => (
                    <div key={p.name} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: TYPE_COLORS[p.type], textTransform: 'capitalize' }}>{p.name}</span>
                        <span>{p.pc}%</span>
                      </div>
                      <div style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
                        <div style={{ width: `${p.pc}%`, height: '100%', background: TYPE_COLORS[p.type], borderRadius: 2, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
