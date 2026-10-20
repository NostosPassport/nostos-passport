import * as THREE from "three";

const GLYPHS: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "'": ["00100", "00100", "00010", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
};

const MAX_LINE_CHARS = 16;
const MAX_LINES = 2;
const GLYPH_COLS = 5;
const GLYPH_ROWS = 7;
const CELL_GAP = 1;
const LINE_GAP = 2;
const TITLE_WIDTH = 0.058;
const TITLE_HEIGHT = 0.014;

function clean(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9 &'!.?\/-]/g, " ").replace(/\s+/g, " ");
}

export function coverTitleLines(raw: string): string[] {
  const text = clean(raw);
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const pieces = word.length > MAX_LINE_CHARS
      ? Array.from({ length: Math.ceil(word.length / MAX_LINE_CHARS) }, (_, i) => word.slice(i * MAX_LINE_CHARS, (i + 1) * MAX_LINE_CHARS))
      : [word];
    for (const piece of pieces) {
      const next = line ? `${line} ${piece}` : piece;
      if (next.length <= MAX_LINE_CHARS) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = piece;
      if (lines.length >= MAX_LINES) return lines.slice(0, MAX_LINES);
    }
  }
  if (line && lines.length < MAX_LINES) lines.push(line);
  return lines.slice(0, MAX_LINES);
}

export function createCoverTitleMesh(raw: string, color: string): THREE.Mesh | null {
  const lines = coverTitleLines(raw);
  if (!lines.length) return null;
  const cols = Math.max(...lines.map((line) => Math.max(1, line.length * (GLYPH_COLS + CELL_GAP) - CELL_GAP)));
  const rows = lines.length * GLYPH_ROWS + Math.max(0, lines.length - 1) * LINE_GAP;
  const cell = Math.min(TITLE_WIDTH / cols, TITLE_HEIGHT / rows);
  const positions: number[] = [];
  const indices: number[] = [];
  let vertex = 0;

  lines.forEach((line, lineIndex) => {
    const lineCols = Math.max(1, line.length * (GLYPH_COLS + CELL_GAP) - CELL_GAP);
    const xStart = -lineCols * cell / 2;
    const yStart = rows * cell / 2 - lineIndex * (GLYPH_ROWS + LINE_GAP) * cell;
    Array.from(line).forEach((character, charIndex) => {
      if (character === " ") return;
      const glyph = GLYPHS[character] ?? GLYPHS["?"]!;
      glyph.forEach((row, rowIndex) => {
        Array.from(row).forEach((pixel, colIndex) => {
          if (pixel !== "1") return;
          const x = xStart + (charIndex * (GLYPH_COLS + CELL_GAP) + colIndex + 0.5) * cell;
          const y = yStart - (rowIndex + 0.5) * cell;
          const half = cell * 0.41;
          positions.push(
            x - half, y - half, 0,
            x + half, y - half, 0,
            x + half, y + half, 0,
            x - half, y + half, 0,
          );
          indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
          vertex += 4;
        });
      });
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.FrontSide, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "CollectionCoverTitle";
  mesh.renderOrder = 4;
  return mesh;
}
