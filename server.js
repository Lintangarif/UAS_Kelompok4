// server.js - Backend Pawang Cuaca Kelompok 4
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fetch from 'node-fetch'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Gunakan nama variabel yang konsisten dengan .env
const API_KEY = process.env.OPENWEATHER_API_KEY

if (!API_KEY) {
  console.error("❌ OPENWEATHER_API_KEY belum di-set di .env")
}

app.get('/api/weather-all', async (req, res) => {
  const { city } = req.query
  if (!city) return res.status(400).json({ message: "Query 'city' wajib diisi" })

  try {
    const q = encodeURIComponent(city) // Sanitasi URL untuk nama kota berspasi [cite: 41]

    // 1) Ambil data cuaca saat ini berdasarkan nama kota
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${q}&units=metric&appid=${API_KEY}&lang=id`
    )
    const weatherData = await weatherRes.json()

    if (weatherRes.status !== 200) {
      return res.status(weatherRes.status).json({
        message: weatherData?.message || 'Kota tidak ditemukan',
        cod: weatherData?.cod
      })
    }

    const { lat, lon } = weatherData.coord

    // 2) Paralel Fetch: Ambil Forecast & AQI sekaligus agar cepat
    const [forecastRes, aqiRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}&lang=id`),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    ])

    const forecastData = await forecastRes.json()
    const aqiData = await aqiRes.json()

    const forecastList = Array.isArray(forecastData?.list) ? forecastData.list : []

    // Hitung probabilitas hujan tertinggi dalam 24 jam kedepan (8 item forecast)
    const next24h = forecastList.slice(0, 8)
    const popMax24h = next24h.reduce((max, item) => Math.max(max, item?.pop ?? 0), 0)

    res.json({
      current: weatherData,
      forecast: forecastList,
      aqi: aqiData?.list?.[0]?.main?.aqi ?? null,
      meta: {
        pop_max_24h: popMax24h, 
        city_resolved: weatherData?.name ?? city,
        coord: { lat, lon }
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Server Error", detail: String(error?.message || error) })
  }
})

app.listen(5000, () => console.log("✅ Backend ITTS Kelompok 4 aktif di port 5000"))