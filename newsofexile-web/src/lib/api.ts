import type { NewsApiResponse, SourceType } from "@/types/news";

// API base URL - uses environment variable or defaults to local development
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9012";

export interface FetchNewsParams {
  sourceType?: SourceType;
}

export async function fetchNews(
  params: FetchNewsParams = {}
): Promise<NewsApiResponse> {
  const url = new URL("/api/news", API_BASE_URL);

  if (params.sourceType) {
    url.searchParams.append("sourceType", params.sourceType);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
