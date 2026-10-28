import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname } from "node:path";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePng(path, width, height, rgba) {
  // rgba: Uint8Array length width*height*4
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // raw scanlines with filter type 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * (width * 4 + 1);
    raw[rowOff] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = rowOff + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const idatData = deflateSync(raw, { level: 9 });

  const out = Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out);
}

// helpers
function lerp(a, b, t) { return a + (b - a) * t; }
function inRoundedRect(x, y, rx, ry, rw, rh, r) {
  // point in rect with rounded corners
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  // corner regions
  const cx = x - rx, cy = y - ry;
  // determine corner
  let qx = 0, qy = 0;
  if (cx < r) qx = r - cx; else if (cx > rw - r) qx = cx - (rw - r); else qx = 0;
  if (cy < r) qy = r - cy; else if (cy > rh - r) qy = cy - (rh - r); else qy = 0;
  if (qx === 0 && qy === 0) return true;
  return (qx * qx + qy * qy) <= r * r;
}

function setPixel(rgba, w, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= w) return;
  const h = rgba.length / (w * 4);
  if (y >= h) return;
  const i = (y * w + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}

// ---- icon.png 1024x1024 ----
const ICON = 1024;
const iconRgba = new Uint8Array(ICON * ICON * 4);

const bgTop = [10, 42, 54]; // #0a2a36
const bgBot = [7, 26, 34]; // #071a22

function bgAt(y) {
  const t = y / (ICON - 1);
  return [
    Math.round(lerp(bgTop[0], bgBot[0], t)),
    Math.round(lerp(bgTop[1], bgBot[1], t)),
    Math.round(lerp(bgTop[2], bgBot[2], t)),
  ];
}

const cornerR = 200;
for (let y = 0; y < ICON; y++) {
  for (let x = 0; x < ICON; x++) {
    const inside = inRoundedRect(x, y, 0, 0, ICON, ICON, cornerR);
    if (!inside) {
      // transparent
      const i = (y * ICON + x) * 4;
      iconRgba[i + 3] = 0;
      continue;
    }
    const [r, g, b] = bgAt(y);
    const i = (y * ICON + x) * 4;
    iconRgba[i] = r; iconRgba[i + 1] = g; iconRgba[i + 2] = b; iconRgba[i + 3] = 255;
  }
}

// mark scaled
const s = 3.2;
const off = (ICON - 256 * s) / 2;
// mark vertical gradient colors
const markTop = [155, 232, 220]; // #9be8dc
const markBot = [79, 184, 201]; // #4fb8c9
const markMinY = 40 * s + off;
const markMaxY = (40 + 176) * s + off;

function markColorAt(y) {
  let t = (y - markMinY) / (markMaxY - markMinY);
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(lerp(markTop[0], markBot[0], t)),
    Math.round(lerp(markTop[1], markBot[1], t)),
    Math.round(lerp(markTop[2], markBot[2], t)),
  ];
}

const rects = [
  { x: 54, y: 40, w: 56, h: 176, r: 28 },
  { x: 146, y: 40, w: 56, h: 176, r: 28 },
  { x: 54, y: 96, w: 148, h: 64, r: 32 },
];

for (const rr of rects) {
  const rx = rr.x * s + off;
  const ry = rr.y * s + off;
  const rw = rr.w * s;
  const rh = rr.h * s;
  const rr2 = rr.r * s;
  const x0 = Math.floor(rx);
  const x1 = Math.ceil(rx + rw);
  const y0 = Math.floor(ry);
  const y1 = Math.ceil(ry + rh);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inRoundedRect(x + 0.5, y + 0.5, rx, ry, rw, rh, rr2)) continue;
      const [r, g, b] = markColorAt(y + 0.5);
      const i = (y * ICON + x) * 4;
      iconRgba[i] = r; iconRgba[i + 1] = g; iconRgba[i + 2] = b; iconRgba[i + 3] = 255;
    }
  }
}

writePng("D:/Code/HiyoLauncher/build/icon.png", ICON, ICON, iconRgba);

// ---- tray.png 32x32 ----
const TRAY = 32;
const trayRgba = new Uint8Array(TRAY * TRAY * 4);
// transparent bg
for (let i = 0; i < trayRgba.length; i += 4) trayRgba[i + 3] = 0;

const trayColor = [111, 214, 228]; // #6fd6e4
const trayRects = [
  { x: 6, y: 6, w: 7, h: 20, r: 3 },
  { x: 19, y: 6, w: 7, h: 20, r: 3 },
  { x: 6, y: 13, w: 20, h: 6, r: 3 },
];
for (const rr of trayRects) {
  const x0 = Math.floor(rr.x);
  const x1 = Math.ceil(rr.x + rr.w);
  const y0 = Math.floor(rr.y);
  const y1 = Math.ceil(rr.y + rr.h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inRoundedRect(x + 0.5, y + 0.5, rr.x, rr.y, rr.w, rr.h, rr.r)) continue;
      const i = (y * TRAY + x) * 4;
      trayRgba[i] = trayColor[0];
      trayRgba[i + 1] = trayColor[1];
      trayRgba[i + 2] = trayColor[2];
      trayRgba[i + 3] = 255;
    }
  }
}
writePng("D:/Code/HiyoLauncher/build/tray.png", TRAY, TRAY, trayRgba);

// copy icon.png -> resources/icon.png
copyFileSync("D:/Code/HiyoLauncher/build/icon.png", "D:/Code/HiyoLauncher/resources/icon.png");
console.log("done");