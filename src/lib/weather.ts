import type { Lang } from "@/lib/jarvis-protocol";

export type Weather = { temp: number; label: string; wind: number };

function weatherLabel(code: number, lang: Lang): string {
  const tr = lang === "tr";
  if (code === 0) return tr ? "açık" : "clear";
  if (code <= 2) return tr ? "parçalı bulutlu" : "partly cloudy";
  if (code === 3) return tr ? "kapalı" : "overcast";
  if (code === 45 || code === 48) return tr ? "sisli" : "fog";
  if (code >= 51 && code <= 57) return tr ? "çisenti" : "drizzle";
  if (code >= 61 && code <= 67) return tr ? "yağmur" : "rain";
  if (code >= 71 && code <= 77) return tr ? "kar" : "snow";
  if (code >= 80 && code <= 82) return tr ? "sağanak" : "showers";
  if (code >= 95) return tr ? "fırtına" : "storm";
  return tr ? "değişken" : "variable";
}

export async function loadWeather(
  city: string,
  lang: Lang,
  signal: AbortSignal,
): Promise<Weather | null> {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${lang}`,
    { signal },
  );
  if (!geoRes.ok) return null;
  const geo = (await geoRes.json()) as {
    results?: { latitude: number; longitude: number }[];
  };
  const hit = geo.results?.[0];
  if (!hit) return null;
  const forecast = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh`,
    { signal },
  );
  if (!forecast.ok) return null;
  const body = (await forecast.json()) as {
    current?: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
  };
  if (!body.current) return null;
  return {
    temp: Math.round(body.current.temperature_2m),
    wind: Math.round(body.current.wind_speed_10m),
    label: weatherLabel(body.current.weather_code, lang),
  };
}
