/**
 * FEP Master Autofill Suite — Icon Generator
 * Run with:  node generate-icons.js
 * Outputs:   icons/icon16.png  icons/icon32.png  icons/icon48.png  icons/icon128.png
 */

"use strict";
const fs   = require("fs");
const zlib = require("zlib");
const path = require("path");

/* ── PNG encoder (no dependencies) ──────────────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = (c >>> 8) ^ CRC_TABLE[(c ^ b) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, "ascii");
  const d   = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}

/** Build a PNG from an RGBA Uint8Array (width×height×4 bytes, row-major). */
function buildPNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 6; // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // One filter-byte (0 = None) per scanline
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const base = y * (1 + width * 4);
    raw[base] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = base + 1 + x * 4;
      raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
    }
  }

  const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([
    PNG_SIG,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/* ── Geometry helpers ───────────────────────────────────────────────────── */

/** True if (px,py) is inside a rounded rect at (0,0,w,h) with corner radius r. */
function inRoundedRect(px, py, w, h, r) {
  if (px < 0 || py < 0 || px >= w || py >= h) return false;
  if (px < r   && py < r)       return (px-r)**2   + (py-r)**2   <= r*r;
  if (px>=w-r  && py < r)       return (px-(w-r))**2 + (py-r)**2 <= r*r;
  if (px < r   && py >= h-r)    return (px-r)**2   + (py-(h-r))**2 <= r*r;
  if (px >= w-r && py >= h-r)   return (px-(w-r))**2 + (py-(h-r))**2 <= r*r;
  return true;
}

/** Ray-casting point-in-polygon. */
function inPolygon(px, py, poly) {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n-1; i < n; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj-xi)*(py-yi)/(yj-yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Blend src colour (with alpha) over dst. */
function blendOver(dr, dg, db, da, sr, sg, sb, sa) {
  const a = sa / 255;
  const oa = da / 255 + a * (1 - da / 255);
  if (oa === 0) return [0, 0, 0, 0];
  const r = (dr/255*(da/255)*(1-a) + sr/255*a) / oa;
  const g = (dg/255*(da/255)*(1-a) + sg/255*a) / oa;
  const b = (db/255*(da/255)*(1-a) + sb/255*a) / oa;
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255), Math.round(oa*255)];
}

/* ── Lightning bolt polygon (designed on 128×128 grid) ─────────────────── */
const BOLT_128 = [[71,15],[37,70],[61,70],[53,113],[89,58],[65,58]];

/* ── Icon renderer ──────────────────────────────────────────────────────── */
function renderIcon(size) {
  const s    = size / 128;                    // universal scale
  const rgba = new Uint8Array(size * size * 4);

  // Teal gradient: top #1dd1a1 → bottom #16a085
  const TOP    = [29, 209, 161];
  const BOTTOM = [22, 160, 133];

  const cornerR = Math.round(22 * s);
  const boltPoly = BOLT_128.map(([x,y]) => [x*s, y*s]);

  // Sun glow parameters (visible at 48 px+)
  const sunCX = 64 * s, sunCY = 34 * s, sunR = 13 * s;
  const showSun = size >= 48;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      if (!inRoundedRect(x + 0.5, y + 0.5, size, size, cornerR)) {
        // Fully transparent outside the rounded rect
        rgba.fill(0, idx, idx + 4);
        continue;
      }

      // Teal gradient background
      const t  = y / (size - 1);
      let [r, g, b] = TOP.map((c, i) => Math.round(c + (BOTTOM[i]-c)*t));
      let a = 255;

      // Sun glow layer (48 px+)
      if (showSun) {
        const dx = x - sunCX, dy = y - sunCY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < sunR * 2.2) {
          // Radial glow: bright core fading out
          const glow = Math.max(0, 1 - dist / (sunR * 2.2));
          const alpha = Math.round(glow * glow * 100); // soft falloff
          [r, g, b, a] = blendOver(r, g, b, a, 255, 255, 210, alpha);
        }
      }

      // Lightning bolt (white)
      if (inPolygon(x + 0.5, y + 0.5, boltPoly)) {
        [r, g, b, a] = blendOver(r, g, b, a, 255, 255, 255, 255);
      }

      rgba[idx]   = r;
      rgba[idx+1] = g;
      rgba[idx+2] = b;
      rgba[idx+3] = a;
    }
  }

  return buildPNG(size, size, rgba);
}

/* ── Write all sizes ─────────────────────────────────────────────────────── */
const outDir = path.join(__dirname, "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

for (const size of [16, 32, 48, 128]) {
  const buf  = renderIcon(size);
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`✓  icons/icon${size}.png  (${buf.length} bytes)`);
}

console.log("\nAll icons generated. Now re-add the icons block to manifest.json.");
