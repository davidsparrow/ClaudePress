# Guarded Media — Stage 2 Plan

Stage 1 (current): read-only browse of `MediaAsset` records imported from WordPress. No upload, metadata editing, or optimization.

Stage 2 adds upload, validation, optimization, and safe slot replacement.

## Target `MediaAsset` shape

```typescript
interface MediaAssetV2 {
  id: string;
  siteId: string;
  originalUrl?: string;
  publicUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  altText?: string;
  title?: string;
  caption?: string;
  source: 'wordpress-import' | 'upload' | 'external';
  optimizedVariants?: Array<{
    label: string; // e.g. webp-80, avif-75
    publicUrl: string;
    sizeBytes: number;
    width?: number;
    height?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

## Stage 2 pipeline (TODO)

1. **Upload endpoint** — `POST /api/sites/:siteId/media` with multipart file upload; store original under site public dir.
2. **File validation** — max size, allowed MIME types (jpeg, png, gif, webp); reject SVG with scripts.
3. **Storage provider abstraction** — local filesystem default; placeholders for TinyPNG, Cloudinary, imgix.
4. **Sharp optimization** — generate WebP/AVIF derivatives; track original vs optimized size.
5. **Guardian media rules** — required alt text before publish; block dangerous SVG; warn on oversized files.
6. **Replace image slot flow** — pick media from library when editing image slots in the Editor.
7. **Usage tracking** — which pages/slots reference each asset.

## Migration notes

- Extend existing `MediaAsset` in [`src/content/blog-types.ts`](../src/content/blog-types.ts) with optional fields; migrate WP-import records with `source: 'wordpress-import'`.
- Do not break Stage 1 read-only API; add PATCH when metadata persistence is ready.

## UI (Stage 2)

- Upload button with progress
- Metadata edit form (alt, title, caption)
- Optimization status card (original size, optimized size, savings %)
- Provider settings under Admin → Integrations or site Settings
