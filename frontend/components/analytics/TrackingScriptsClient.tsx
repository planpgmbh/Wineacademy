 "use client";

import Script from "next/script";

type TrackingSnippet = {
  label: string;
  typ: string;
  position: "head" | "body_end";
  code: string;
  remark?: string;
};

type Props = {
  snippets: TrackingSnippet[];
};

export function TrackingScriptsClient({ snippets }: Props) {
  if (!Array.isArray(snippets) || snippets.length === 0) {
    return null;
  }

  const normaliseSnippet = (snippet: TrackingSnippet, index: number) => {
    const raw = (snippet.code || "").trim();
    if (!raw.toLowerCase().startsWith("<script")) {
      return { inline: raw, src: null, dataAttrs: {} as Record<string, string>, index };
    }
    const srcMatch = raw.match(/src=["']([^"']+)["']/i);
    const bodyMatch = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const dataAttrs: Record<string, string> = {};
    const dataRegex = /data-([\w-]+)=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = dataRegex.exec(raw)) !== null) {
      dataAttrs[`data-${m[1]}`] = m[2];
    }
    return {
      src: srcMatch?.[1] ?? null,
      inline: bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : null,
      dataAttrs,
      index,
    };
  };

  return (
    <>
      {snippets.map((snippet, index) => {
        const parsed = normaliseSnippet(snippet, index);
        const strategy = snippet.position === "head" ? "beforeInteractive" : "afterInteractive";
        const scripts = [];
        if (parsed.src) {
          scripts.push(
            <Script
              key={`tracking-src-${index}`}
              id={`tracking-src-${index}`}
              src={parsed.src}
              strategy={strategy}
              {...parsed.dataAttrs}
            />
          );
        }
        if (parsed.inline) {
          scripts.push(
            <Script
              key={`tracking-inline-${index}`}
              id={`tracking-inline-${index}`}
              strategy={strategy}
              dangerouslySetInnerHTML={{ __html: parsed.inline }}
            />
          );
        }
        if (!parsed.src && !parsed.inline) {
          scripts.push(
            <Script
              key={`tracking-raw-${index}`}
              id={`tracking-raw-${index}`}
              strategy={strategy}
              dangerouslySetInnerHTML={{ __html: snippet.code }}
            />
          );
        }
        return scripts;
      })}
    </>
  );
}
