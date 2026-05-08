import type { MacroIndicator } from "@/types";

const BASE = "https://api.stlouisfed.org/fred";

function key() {
  return process.env.FRED_API_KEY ?? "";
}

interface SeriesDef {
  id: string;
  label: string;
  format: (v: string) => string;
}

const SERIES: SeriesDef[] = [
  { id: "VIXCLS", label: "VIX", format: (v) => parseFloat(v).toFixed(1) },
  { id: "DGS10", label: "10Y Yield", format: (v) => `${parseFloat(v).toFixed(2)}%` },
  // CPI is a price index level — show YoY change instead of raw level
  { id: "CPIAUCSL", label: "CPI YoY", format: (v) => v }, // overridden below
  { id: "UNRATE", label: "Unemployment", format: (v) => `${parseFloat(v).toFixed(1)}%` },
];

async function fetchSeries(seriesId: string, limit = 2): Promise<{ value: string; date: string }[]> {
  if (!key()) return [];
  const url = new URL(`${BASE}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key());
  url.searchParams.set("file_type", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort_order", "desc");

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.observations ?? [];
}

// CPI needs 13 observations to compute YoY (current vs same month last year)
async function fetchCpiYoY(): Promise<string> {
  const obs = await fetchSeries("CPIAUCSL", 14);
  const valid = obs.filter((o) => o.value !== ".");
  if (valid.length < 13) return "N/A";
  const current = parseFloat(valid[0].value);
  const yearAgo = parseFloat(valid[12].value);
  const yoy = ((current - yearAgo) / yearAgo) * 100;
  return `${yoy.toFixed(1)}%`;
}

export async function fetchMacroIndicators(): Promise<MacroIndicator[]> {
  if (!key()) return getFallbackIndicators();

  const [vix, dgs10, cpiYoY, unrate] = await Promise.allSettled([
    fetchSeries("VIXCLS"),
    fetchSeries("DGS10"),
    fetchCpiYoY(),
    fetchSeries("UNRATE"),
  ]);

  const indicators: MacroIndicator[] = [];

  const push = (
    label: string,
    seriesId: string,
    obs: { value: string; date: string }[],
    fmt: (v: string) => string
  ) => {
    const latest = obs.find((o) => o.value !== ".");
    if (!latest) return;
    indicators.push({
      label,
      value: fmt(latest.value),
      changePercent: null,
      source: `https://fred.stlouisfed.org/series/${seriesId}`,
    });
  };

  if (vix.status === "fulfilled") push("VIX", "VIXCLS", vix.value, (v) => parseFloat(v).toFixed(1));
  if (dgs10.status === "fulfilled") push("10Y Yield", "DGS10", dgs10.value, (v) => `${parseFloat(v).toFixed(2)}%`);
  if (cpiYoY.status === "fulfilled" && cpiYoY.value !== "N/A") {
    indicators.push({
      label: "CPI (YoY)",
      value: cpiYoY.value,
      changePercent: null,
      source: "https://fred.stlouisfed.org/series/CPIAUCSL",
    });
  }
  if (unrate.status === "fulfilled") push("Unemployment", "UNRATE", unrate.value, (v) => `${parseFloat(v).toFixed(1)}%`);

  return indicators.length > 0 ? indicators : getFallbackIndicators();
}

function getFallbackIndicators(): MacroIndicator[] {
  return [
    { label: "VIX", value: "—", changePercent: null, source: "https://fred.stlouisfed.org/series/VIXCLS" },
    { label: "10Y Yield", value: "—", changePercent: null, source: "https://fred.stlouisfed.org/series/DGS10" },
  ];
}
