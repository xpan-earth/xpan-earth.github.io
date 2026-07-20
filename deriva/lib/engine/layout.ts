import type { ContentItem, EditorialLayout } from "../types";

export function selectLayout(item: ContentItem, index = 0): EditorialLayout {
  const media = item.media[0];
  if (item.kind === "video" || media?.type === "video" || item.kind === "audio" || media?.type === "audio") return "audiovisual";
  if (["pdf", "libro"].includes(item.kind) || media?.type === "pdf") return "document-viewer";
  if (["mapa", "patente"].includes(item.kind)) return "diagram-field";
  if (item.media.length > 1) return "sequence";
  if (item.relations.length > 0 && item.kind === "noticia") return "diptych";
  if (!media) return "type-led";
  const ratio = media.aspectRatio ?? (media.width && media.height ? media.width / media.height : 1.25);
  if (ratio < 0.83) return "vertical-split";
  if (ratio > 1.5 || index % 3 === 0) return "full-bleed";
  return index % 2 ? "vertical-split" : "type-led";
}

