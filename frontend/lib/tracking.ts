import { fetchJson } from "./api";

export type TrackingSnippet = {
  label: string;
  typ: string;
  position: "head" | "body_end";
  code: string;
  remark?: string;
};

export async function getTrackingSnippets(): Promise<TrackingSnippet[]> {
  try {
    const snippets = await fetchJson<TrackingSnippet[]>("/public/settings/tracking", {
      cache: "no-store"
    });
    if (!Array.isArray(snippets)) {
      return [];
    }
    return snippets.filter((item) => typeof item.code === "string" && item.code.trim().length > 0);
  } catch (error) {
    console.warn("[tracking] Konnte Tracking Snippets nicht laden:", error);
    return [];
  }
}
