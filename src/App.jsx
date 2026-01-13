import { useState, useEffect, useMemo } from 'react'
import './App.css'

function App() {
  const [city, setCity] = useState('')
  const [data, setData] = useState(null)
  const [activityMode, setActivityMode] = useState('jalan')
  const [loading, setLoading] = useState(false)

  // WIB 24 jam (bukan PM/AM)
  const [time, setTime] = useState(
    new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
  )

  // preview khusus page awal
  const [preview, setPreview] = useState({})

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ---------- UTIL ----------
  const msToKmh = (ms) => Math.round((ms ?? 0) * 3.6)

  // 1) DETEKSI: ubah teks API → theme class
  const getWeatherTheme = (main = '') => {
    const m = (main || '').toLowerCase()
    if (m.includes('thunderstorm')) return 'storm'
    if (m.includes('rain') || m.includes('drizzle')) return 'rain'
    if (m.includes('clear')) return 'clear'
    if (m.includes('cloud')) return 'clouds'
    if (m.includes('snow')) return 'snow'
    if (['mist', 'haze', 'fog', 'smoke', 'dust', 'sand', 'ash', 'squall', 'tornado'].some(x => m.includes(x))) return 'mist'
    return 'default'
  }

  // FIXED: deteksi siang/malam yang lebih akurat
  const isNight = (w) => {
    const currentTime = w?.current?.dt
    const sunrise = w?.current?.sys?.sunrise
    const sunset = w?.current?.sys?.sunset
    if (!currentTime || !sunrise || !sunset) return false
    return currentTime < sunrise || currentTime > sunset
  }

  // 2) DETEKSI: theme → icon FontAwesome
  const getWeatherFaIcon = (theme, night = false) => {
    if (theme === 'clear') return night ? 'fa-moon' : 'fa-sun'
    if (theme === 'clouds') return 'fa-cloud'
    if (theme === 'rain') return 'fa-cloud-rain'
    if (theme === 'storm') return 'fa-bolt'
    if (theme === 'snow') return 'fa-snowflake'
    if (theme === 'mist') return 'fa-smog'
    return 'fa-cloud'
  }

  const aqiLabel = (aqi) => {
    if (aqi === 1) return 'Sangat Baik'
    if (aqi === 2) return 'Baik'
    if (aqi === 3) return 'Sedang'
    if (aqi === 4) return 'Buruk'
    if (aqi === 5) return 'Sangat Buruk'
    return 'N/A'
  }

  const getPopMax24h = (forecast = []) => {
    const next24h = Array.isArray(forecast) ? forecast.slice(0, 8) : []
    return next24h.reduce((max, item) => Math.max(max, item?.pop ?? 0), 0)
  }

  // ---------- FETCH (PAGE 2 MAIN) ----------
  const fetchWeather = async (cityOverride) => {
    const q = cityOverride ?? city
    if (!q) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/weather-all?city=${encodeURIComponent(q)}`)
      const result = await res.json()
      if (res.ok) setData(result)
      else console.error('API error:', result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ---------- FETCH (PAGE 1 PREVIEW ONLY) ----------
  const fetchPreview = async (cityName) => {
    try {
      const res = await fetch(`${API_BASE}/api/weather-all?city=${encodeURIComponent(cityName)}`)
      const result = await res.json()
      if (res.ok) {
        setPreview(prev => ({ ...prev, [cityName]: result }))
      } else {
        console.error('Preview API error:', result)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // load preview cuma saat page awal (data masih null)
  useEffect(() => {
    if (data !== null) return
    fetchPreview('Jakarta')
    fetchPreview('Bogor')
    fetchPreview('Tangerang')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // ---------- LOGIC ----------
  const getAIDecision = (w) => {
    const main = (w?.current?.weather?.[0]?.main || '').toLowerCase()
    const temp = Math.round(w?.current?.main?.temp ?? 0)
    const windKmh = msToKmh(w?.current?.wind?.speed ?? 0)
    const popMax = w?.meta?.pop_max_24h ?? getPopMax24h(w?.forecast ?? [])
    const rainProb = Math.round(popMax * 100)

    const redFlags = []
    if (main.includes('thunderstorm')) redFlags.push('petir/badai')
    if (main.includes('rain') || main.includes('drizzle') || rainProb >= 60) redFlags.push(`hujan ${rainProb}%`)
    if (windKmh >= 35) redFlags.push(`angin ${windKmh} km/h`)
    if (temp <= 10) redFlags.push(`dingin ${temp}°C`)
    if (temp >= 33) redFlags.push(`panas ${temp}°C`)

    const rec = redFlags.length
      ? 'Kurang ideal untuk aktivitas luar'
      : 'Sangat cocok untuk aktivitas luar'

    const reason = redFlags.length
      ? `Faktor risiko: ${redFlags.join(' • ')}.`
      : `Hujan rendah (${rainProb}%), suhu nyaman (${temp}°C), angin ringan (${windKmh} km/h), AQI ${aqiLabel(w?.aqi)}.`

    return { rec, reason }
  }

  const getPacks = (w, mode) => {
    const temp = w?.current?.main?.temp
    const main = (w?.current?.weather?.[0]?.main || '').toLowerCase()
    const popMax = w?.meta?.pop_max_24h ?? getPopMax24h(w?.forecast ?? [])
    const rainProb = Math.round(popMax * 100)

    const packs = []
    if (temp == null) return packs

    if (temp <= 12) packs.push({ icon: '🧥', item: 'Jaket', why: `Dingin (${Math.round(temp)}°C)` })
    if (temp > 28) packs.push({ icon: '👕', item: 'Baju Nyaman', why: `Hangat (${Math.round(temp)}°C)` })
    if (temp > 28) packs.push({ icon: '🧢', item: 'Topi', why: 'Siang cenderung panas' })

    if (main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm') || rainProb >= 60) {
      packs.push({ icon: '☔', item: 'Payung/Jas Hujan', why: `Potensi hujan ${rainProb}%` })
    }

    if (mode === 'motoran') packs.push({ icon: '🧤', item: 'Sarung Tangan', why: 'Proteksi angin + dingin' })
    if (mode === 'motoran') packs.push({ icon: '😷', item: 'Masker', why: 'Debu + polusi' })

    if (packs.length === 0) packs.push({ icon: '🙂', item: 'Outfit Santai', why: `Suhu aman (${Math.round(temp)}°C)` })
    return packs
  }

  const getRisk = (w) => {
    const main = (w?.current?.weather?.[0]?.main || '').toLowerCase()
    const temp = Math.round(w?.current?.main?.temp ?? 0)
    const windKmh = msToKmh(w?.current?.wind?.speed ?? 0)
    const popMax = w?.meta?.pop_max_24h ?? getPopMax24h(w?.forecast ?? [])
    const rainProb = Math.round(popMax * 100)

    const reasons = []
    if (main.includes('thunderstorm')) reasons.push('Badai/Petir')
    if (main.includes('rain') || main.includes('drizzle') || rainProb >= 60) reasons.push(`Potensi hujan ${rainProb}%`)
    if (windKmh >= 30) reasons.push(`Angin ${windKmh} km/h`)
    if (temp <= 10) reasons.push(`Dingin ${temp}°C`)
    if (temp >= 33) reasons.push(`Panas ${temp}°C`)

    let level = 'Rendah', icon = '🟢', color = '#00e676'
    if (reasons.length >= 1) { level = 'Sedang'; icon = '🟡'; color = '#ffcc00' }
    if (main.includes('thunderstorm') || rainProb >= 80 || windKmh >= 55) { level = 'Tinggi'; icon = '🔴'; color = '#ff5252' }
    if (reasons.length === 0) { level = 'Rendah'; icon = '🟢'; color = '#00e676' }

    return { label: `Risiko ${level}`, icon, color, detail: reasons.length ? reasons.join(' • ') : 'Kondisi relatif aman' }
  }

  // 3-day forecast (anti-stuck)
  const get3DayForecast = (list) => {
    if (!Array.isArray(list)) return []
    const noonItems = list.filter(item => item?.dt_txt?.includes('12:00:00'))
    const base = noonItems.length ? noonItems : list

    const byDate = new Map()
    for (const item of base) {
      const dt = item?.dt_txt
      if (!dt) continue
      const dateKey = dt.slice(0, 10)
      if (!byDate.has(dateKey)) byDate.set(dateKey, item)
    }

    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, item]) => item)
      .slice(0, 3)
  }

  const forecast3Days = useMemo(() => get3DayForecast(data?.forecast), [data])

  // theme untuk background (page 2)
  const theme = data ? getWeatherTheme(data?.current?.weather?.[0]?.main) : 'default'
  const night = data ? isNight(data) : false
  const heroIcon = getWeatherFaIcon(theme, night)

  return (
    <div className={`app-wrapper ${theme}`}>
      <div className="overlay"></div>

      <div className="container">
        <header className="glass header-anim">
          <div className="meta">
            <span className="clock-digital">{time}</span>
            <p>Lintang | Panji | Stefanus | Farrel</p>
          </div>
          <h1>PAWANG CUACA <span>KELOMPOK 4</span></h1>
        </header>

        <div className="search-section glass">
          <input
            type="text"
            placeholder="Masukan Kota atau wilayah..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchWeather()}
          />
          <button onClick={fetchWeather} disabled={loading}>
            {loading ? '...' : <i className="fa-solid fa-search"></i>}
          </button>
        </div>

        {/* PAGE 1: PREVIEW BUBBLES (cuma muncul saat data masih null) */}
        {!data && (
          <div className="preview-row">
            {['Jakarta', 'Bogor', 'Tangerang'].map((cityName) => {
              const p = preview[cityName]
              if (!p) return null

              return (
                <div
                  key={cityName}
                  className="preview-card glass"
                  onClick={() => {
                    setCity(cityName)
                    fetchWeather(cityName)
                  }}
                >
                  <h4>{p.current?.name}, ID</h4>

                  <div className="preview-main">
                    <div className="preview-icon">
                      <img
                        src={`https://openweathermap.org/img/wn/${p.current?.weather?.[0]?.icon}.png`}
                        alt="icon"
                      />
                    </div>
                    <span className="preview-temp">{Math.round(p.current?.main?.temp ?? 0)}°C</span>
                  </div>

                  <p className="preview-desc">
                    {(p.current?.weather?.[0]?.description || '-').toUpperCase()}
                  </p>

                  <div className="preview-meta">
                    <span className="preview-chip">HUMID {p.current?.main?.humidity ?? '-'}%</span>
                    <span className="preview-chip">WIND {msToKmh(p.current?.wind?.speed)} km/h</span>
                    <span className="preview-chip">AQI {aqiLabel(p.aqi)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PAGE 2: HASIL SEARCH */}
        {data && (
          <main className="dashboard-grid">
            {/* LEFT: MAIN BUBBLE */}
            <section className="glass bubble-card card-main">
              <h2 className="place">
                {data.current?.name}, {data.current?.sys?.country}
              </h2>

              <div className="temp-hero">
                <div className={`hero-icon ${theme}`}>
                  <i className={`fa-solid ${heroIcon}`}></i>
                </div>

                <h1>{Math.round(data.current?.main?.temp ?? 0)}°C</h1>
              </div>

              <p className="status">
                {(data.current?.weather?.[0]?.description || '-').toUpperCase()}
              </p>

              <div className="meta-row">
                <span className="chip">HUMID {data.current?.main?.humidity ?? '-'}%</span>
                <span className="chip">WIND {msToKmh(data.current?.wind?.speed ?? 0)} km/h</span>
                <span className="chip">AQI {aqiLabel(data.aqi)}</span>
              </div>
            </section>

            {/* RIGHT: POPUP / SIDE CARDS */}
            <div className="side-column">
              <section className="glass bubble-card ai-engine">
                <h3>AI Summary</h3>
                <strong>Rekomendasi: {getAIDecision(data).rec}</strong>
                <p>Alasan: {getAIDecision(data).reason}</p>
              </section>

              <section className="glass bubble-card risk-card">
                <h3>Risk Indicator</h3>
                <h2 style={{ color: getRisk(data).color }}>
                  {getRisk(data).icon} {getRisk(data).label}
                </h2>
                <p className="muted">Detail: {getRisk(data).detail}</p>
              </section>
            </div>

            {/* PACKING */}
            <section className="glass bubble-card packing-card span-2">
              <div className="pack-header">
                <h3>Smart Packing</h3>
                <select
                  className="mode-select"
                  value={activityMode}
                  onChange={(e) => setActivityMode(e.target.value)}
                >
                  <option value="jalan">Mode: Jalan Santai</option>
                  <option value="motoran">Mode: Motoran</option>
                </select>
              </div>

              <div className="pack-list">
                {getPacks(data, activityMode).map((p, i) => (
                  <div key={i} className="pack-item">
                    <span>{p.icon} {p.item}</span>
                    <small>→ {p.why}</small>
                  </div>
                ))}
              </div>
            </section>

            {/* FORECAST 3 DAYS */}
            <section className="glass bubble-card forecast-section span-2">
              <h3>Prediksi 3 Hari Ke Depan</h3>
              <div className="forecast-row">
                {forecast3Days.map((f, i) => (
                  <div key={f.dt} className={`f-bubble ${i === 0 ? 'highlight' : ''}`}>
                    {i === 0 && <span className="best-badge">Terbaik</span>}
                    <p className="day-name">
                      {new Date(f.dt_txt).toLocaleDateString('id-ID', { weekday: 'long' })}
                    </p>
                    <img src={`https://openweathermap.org/img/wn/${f.weather?.[0]?.icon}.png`} alt="icon" />
                    <strong>{Math.round(f.main.temp)}°C</strong>
                    <div className="f-wind">
                      <i className="fa-solid fa-wind"></i> {msToKmh(f.wind.speed)} km/h
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  )
}

export default App
