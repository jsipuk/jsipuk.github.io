import type { SourceRef } from "@/types";

const BASE = "https://efts.sec.gov/LATEST/search-index";
const SEARCH = "https://efts.sec.gov/LATEST/search-index?q=%22{TICKER}%22&dateRange=custom&startdt={START}&enddt={END}&forms=8-K,10-K,S-1";

export interface EdgarFiling {
  id: string;
  form: string;
  description: string;
  filedAt: string;
  source: SourceRef;
}

export async function fetchRecentFilings(symbol: string): Promise<EdgarFiling[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=8-K,10-K,S-1&dateRange=custom&startdt=${fmtDate(start)}&enddt=${fmtDate(end)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "StockIntel personal-use jsaunders@example.com" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const hits = data.hits?.hits ?? [];

    return hits.slice(0, 5).map((hit: Record<string, unknown>, i: number) => {
      const src = hit._source as Record<string, unknown>;
      const accession = (src.file_date as string ?? "").replace(/-/g, "");
      const cik = (src.entity_id as string) ?? "";
      return {
        id: String(i),
        form: (src.form_type as string) ?? "Filing",
        description: (src.display_names as string[])?.join(", ") ?? symbol,
        filedAt: (src.file_date as string) ?? new Date().toISOString(),
        source: {
          label: `SEC EDGAR — ${src.form_type as string}`,
          url: cik
            ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${src.form_type as string}&dateb=&owner=include&count=10`
            : "https://www.sec.gov/cgi-bin/srqsb?text=form-type%3D8-K",
        },
      };
    });
  } catch {
    return [];
  }
}

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

void BASE;
void SEARCH;
