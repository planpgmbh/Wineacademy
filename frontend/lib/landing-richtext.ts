import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import { mediaUrl } from "./api";

type StrapiBlockMark = {
  type?: string | null;
  attrs?: Record<string, unknown> | null;
};

type StrapiBlockNode = {
  type?: string | null;
  attrs?: Record<string, unknown> | null;
  content?: StrapiBlockNode[] | null;
  text?: string | null;
  marks?: StrapiBlockMark[] | null;
};

type TiptapJSON = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJSON[];
  text?: string;
  marks?: StrapiBlockMark[] | null;
};

export type RichTextValue = string | TiptapJSON | null | undefined;

const isStrapiBlockDocument = (value: unknown): value is StrapiBlockNode => {
  return Boolean(value && typeof value === "object" && (value as StrapiBlockNode).type === "doc");
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

const renderBlockMarks = (text: string, marks?: StrapiBlockMark[] | null): string => {
  if (!Array.isArray(marks) || marks.length === 0) {
    return escapeHtml(text);
  }

  return marks.reduce((acc, mark) => {
    if (!mark?.type) {
      return acc;
    }
    if (mark.type === "bold") {
      return `<strong>${acc}</strong>`;
    }
    if (mark.type === "italic") {
      return `<em>${acc}</em>`;
    }
    if (mark.type === "underline") {
      return `<u>${acc}</u>`;
    }
    if (mark.type === "strike") {
      return `<s>${acc}</s>`;
    }
    if (mark.type === "code") {
      return `<code>${acc}</code>`;
    }
    if (mark.type === "link") {
      const hrefRaw =
        typeof mark.attrs?.href === "string" && mark.attrs.href.trim().length > 0 ? mark.attrs.href : "#";
      const href = escapeHtml(hrefRaw);
      const targetRaw = typeof mark.attrs?.target === "string" ? mark.attrs.target : null;
      const target = targetRaw && targetRaw.trim().length > 0 ? escapeHtml(targetRaw) : null;
      const relRaw = typeof mark.attrs?.rel === "string" ? mark.attrs.rel : null;
      const rel =
        relRaw && relRaw.trim().length > 0 ? escapeHtml(relRaw) : target === "_blank" ? "noopener noreferrer" : null;
      const className =
        typeof mark.attrs?.class === "string" && mark.attrs.class.trim().length > 0
          ? ` class="${escapeHtml(mark.attrs.class)}"`
          : "";
      const targetAttr = target ? ` target="${target}"` : "";
      const relAttr = rel ? ` rel="${rel}"` : "";
      return `<a href="${href}"${targetAttr}${relAttr}${className}>${acc}</a>`;
    }
    return acc;
  }, escapeHtml(text));
};

const renderBlockNodes = (nodes?: StrapiBlockNode[] | null): string => {
  if (!Array.isArray(nodes)) {
    return "";
  }
  return nodes.map((node) => renderBlockNode(node)).join("");
};

const renderBlockNode = (node: StrapiBlockNode): string => {
  const type = node.type ?? "";
  if (type === "text") {
    return node.text ? renderBlockMarks(node.text, node.marks) : "";
  }
  if (type === "hardBreak") {
    return "<br />";
  }
  if (type === "paragraph") {
    const align = typeof node.attrs?.textAlign === "string" ? node.attrs.textAlign : null;
    const style = align ? ` style="text-align:${escapeHtml(align)};"` : "";
    return `<p${style}>${renderBlockNodes(node.content)}</p>`;
  }
  if (type === "horizontalRule") {
    return "<hr />";
  }
  if (type === "codeBlock") {
    const language =
      typeof node.attrs?.language === "string" && node.attrs.language.trim().length > 0
        ? ` class="language-${escapeHtml(node.attrs.language)}"`
        : "";
    return `<pre><code${language}>${renderBlockNodes(node.content)}</code></pre>`;
  }
  if (type === "heading") {
    const levelRaw = node.attrs?.level;
    const level = typeof levelRaw === "number" && levelRaw >= 1 && levelRaw <= 6 ? levelRaw : 2;
    const align = typeof node.attrs?.textAlign === "string" ? node.attrs.textAlign : null;
    const style = align ? ` style="text-align:${escapeHtml(align)};"` : "";
    return `<h${level}${style}>${renderBlockNodes(node.content)}</h${level}>`;
  }
  if (type === "bulletList") {
    return `<ul>${renderBlockNodes(node.content)}</ul>`;
  }
  if (type === "orderedList") {
    return `<ol>${renderBlockNodes(node.content)}</ol>`;
  }
  if (type === "listItem") {
    return `<li>${renderBlockNodes(node.content)}</li>`;
  }
  if (type === "table") {
    return `<table><tbody>${renderBlockNodes(node.content)}</tbody></table>`;
  }
  if (type === "tableRow") {
    return `<tr>${renderBlockNodes(node.content)}</tr>`;
  }
  if (type === "tableHeader" || type === "tableCell") {
    const Tag = type === "tableHeader" ? "th" : "td";
    const align = typeof node.attrs?.textAlign === "string" ? node.attrs.textAlign : null;
    const style = align ? ` style="text-align:${escapeHtml(align)};"` : "";
    const colSpan =
      typeof node.attrs?.colspan === "number" && node.attrs.colspan > 1
        ? ` colspan="${node.attrs.colspan}"`
        : "";
    const rowSpan =
      typeof node.attrs?.rowspan === "number" && node.attrs.rowspan > 1
        ? ` rowspan="${node.attrs.rowspan}"`
        : "";
    return `<${Tag}${style}${colSpan}${rowSpan}>${renderBlockNodes(node.content)}</${Tag}>`;
  }
  if (type === "blockquote") {
    return `<blockquote>${renderBlockNodes(node.content)}</blockquote>`;
  }
  if (type === "image") {
    const attrs = node.attrs ?? {};
    const srcRaw = typeof attrs.src === "string" ? attrs.src : "";
    const src = mediaUrl(srcRaw);
    if (!src) {
      return "";
    }
    const alt = typeof attrs.alt === "string" ? ` alt="${escapeHtml(attrs.alt)}"` : ' alt=""';
    const title =
      typeof attrs.title === "string" && attrs.title.trim().length > 0
        ? ` title="${escapeHtml(attrs.title)}"`
        : "";
    const width =
      typeof attrs.width === "string" && attrs.width.trim().length > 0
        ? `max-width:${escapeHtml(attrs.width)};`
        : "";
    const height =
      typeof attrs.height === "string" && attrs.height.trim().length > 0
        ? `height:${escapeHtml(attrs.height)};`
        : "";
    const align = typeof (attrs as any).align === "string" ? (attrs as any).align : null;
    const baseMarginReset = "margin-left:0;margin-right:0;";
    const alignStyle =
      align === "center"
        ? `display:block;${baseMarginReset}`
        : align === "right"
          ? `display:block;${baseMarginReset}`
          : align === "left"
            ? `display:block;${baseMarginReset}`
            : baseMarginReset;
    const styles = [width, height, alignStyle].filter(Boolean).join("");
    const styleAttr = styles.length > 0 ? ` style="${styles}"` : "";
    return `<img src="${escapeHtml(src)}"${alt}${title}${styleAttr} />`;
  }
  if (type === "doc") {
    return renderBlockNodes(node.content);
  }
  return "";
};

const RICH_TEXT_IMAGE_SRC_REGEX = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi;

const rewriteRichTextMediaSources = (value: string): string => {
  return value.replace(RICH_TEXT_IMAGE_SRC_REGEX, (match, prefix, quote, src) => {
    const resolved = mediaUrl(src);
    if (!resolved || resolved === src) {
      return match;
    }
    return `${prefix}${quote}${resolved}${quote}`;
  });
};

const renderStrapiBlocksToHtml = (value: StrapiBlockNode): string | null => {
  const rendered = renderBlockNode(value);
  if (rendered.trim().length === 0) {
    return null;
  }
  return rendered;
};

const TIPTAP_EXTENSIONS = [
  StarterKit,
  Link.configure({ openOnClick: true }),
  Image.configure({ HTMLAttributes: { loading: "lazy" } })
];

const extractPlainText = (node?: TiptapJSON | null): string => {
  if (!node) return "";
  if (node.text) return node.text;
  return (node.content ?? []).map(extractPlainText).join(" ").trim();
};

const hasAlignmentAttrs = (node: TiptapJSON | null | undefined): boolean => {
  if (!node) {
    return false;
  }
  const attrs = node.attrs ?? {};
  if (typeof attrs.textAlign === "string") {
    return true;
  }
  if (typeof (attrs as any).align === "string") {
    return true;
  }
  return (node.content ?? []).some((child) => hasAlignmentAttrs(child));
};

export const normaliseRichText = (value: RichTextValue): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return rewriteRichTextMediaSources(trimmed);
  }

  if (typeof value === "object") {
    const typed = value as TiptapJSON;
    if (hasAlignmentAttrs(typed) || isStrapiBlockDocument(typed)) {
      return renderStrapiBlocksToHtml(typed as StrapiBlockNode);
    }
    try {
      const html = generateHTML(typed, TIPTAP_EXTENSIONS);
      const trimmed = typeof html === "string" ? html.trim() : "";
      return trimmed ? rewriteRichTextMediaSources(trimmed) : null;
    } catch {
      const fallback = extractPlainText(typed);
      return fallback ? `<p>${escapeHtml(fallback)}</p>` : null;
    }
  }

  return null;
};
