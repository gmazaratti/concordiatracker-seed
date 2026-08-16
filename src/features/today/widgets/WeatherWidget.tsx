import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Cloudy,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * Montreal weather, for the walk between buildings.
 *
 * Open-Meteo: no API key, no signup, CORS-enabled, so this is a plain browser
 * fetch with no server or secret involved. Coordinates are SGW (Hall Building) —
 * the two campuses are 7km apart and share weather closely enough that a second
 * lookup would be noise.
 */

const SGW = { lat: 45.4972, lon: -73.579 }

const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${SGW.lat}&longitude=${SGW.lon}` +
  '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
  '&timezone=America%2FToronto'

interface Current {
  temperature_2m: number
  apparent_temperature: number
  weather_code: number
  is_day: number
}

/** WMO code → what to show. Grouped rather than exhaustive: nobody needs the
 * difference between "moderate" and "dense" drizzle to decide on a coat. */
function describe(code: number, isDay: boolean): { label: string; icon: LucideIcon } {
  if (code === 0) return { label: 'Clear', icon: isDay ? Sun : Moon }
  if (code <= 2) return { label: 'Partly cloudy', icon: Cloud }
  if (code === 3) return { label: 'Overcast', icon: Cloudy }
  if (code <= 48) return { label: 'Fog', icon: CloudFog }
  if (code <= 57) return { label: 'Drizzle', icon: CloudDrizzle }
  if (code <= 67) return { label: 'Rain', icon: CloudRain }
  if (code <= 77) return { label: 'Snow', icon: CloudSnow }
  if (code <= 82) return { label: 'Showers', icon: CloudRain }
  if (code <= 86) return { label: 'Snow showers', icon: CloudSnow }
  return { label: 'Thunderstorm', icon: CloudLightning }
}

export function WeatherWidget() {
  const [current, setCurrent] = useState<Current | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch(URL)
        if (!res.ok) throw new Error('weather unavailable')
        const json = (await res.json()) as { current: Current }
        if (alive) setCurrent(json.current)
      } catch {
        // Weather is a nicety. A failed lookup says so quietly and never
        // takes the rest of Today down with it.
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const meta = current ? describe(current.weather_code, current.is_day === 1) : null
  const Icon = meta?.icon ?? Cloud

  return (
    <WidgetCard title="Montreal" icon={Icon}>
      {failed ? (
        <WidgetEmpty>Weather is unavailable right now.</WidgetEmpty>
      ) : !current ? (
        <WidgetEmpty>Checking the forecast…</WidgetEmpty>
      ) : (
        <div className="px-3.5 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] leading-none font-semibold text-fg tabular-nums">
              {Math.round(current.temperature_2m)}°
            </span>
            <span className="text-[12.5px] text-muted">{meta?.label}</span>
          </div>
          {/* "Feels like" only when it actually differs: a line that repeats the
              number above is noise. */}
          {Math.abs(current.apparent_temperature - current.temperature_2m) >= 1 && (
            <p className="mt-1 text-[11.5px] text-subtle">
              Feels like {Math.round(current.apparent_temperature)}°
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  )
}
