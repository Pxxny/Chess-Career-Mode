import { getOption, sanitizeAppearance } from '@/data/appearance';
import type { Appearance } from '@/types';

/**
 * Draws a character portrait as an SVG string. Pure and dependency-free so it
 * can be rendered anywhere. Every value comes from the fixed option tables in
 * data/appearance.ts (unknown values are replaced), so the output is safe to inject.
 */

const CX = 100;
const CY = 92;

interface FaceParams { w: number; h: number; jaw: number; eye: number; eyeY: number; nose: number; mouth: number }
const FACES: Record<string, FaceParams> = {
  classic: { w: 40, h: 47, jaw: 0.5, eye: 14, eyeY: 2, nose: 4, mouth: 11 },
  round: { w: 44, h: 44, jaw: 0.15, eye: 15, eyeY: 4, nose: 5, mouth: 12 },
  square: { w: 42, h: 46, jaw: 1, eye: 14.5, eyeY: 2, nose: 5, mouth: 13 },
  long: { w: 36, h: 53, jaw: 0.45, eye: 13, eyeY: 4, nose: 4, mouth: 10 },
  soft: { w: 40, h: 45, jaw: 0.25, eye: 14.5, eyeY: 3, nose: 3.5, mouth: 10 },
  angular: { w: 38, h: 49, jaw: 0.05, eye: 13.5, eyeY: 1, nose: 4.5, mouth: 11 },
};

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}
/** Positive lightens, negative darkens. */
function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  return amount >= 0
    ? toHex([r + (255 - r) * (amount / 100), g + (255 - g) * (amount / 100), b + (255 - b) * (amount / 100)])
    : toHex([r * (1 + amount / 100), g * (1 + amount / 100), b * (1 + amount / 100)]);
}
function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  return toHex([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t]);
}

const n = (v: number) => Math.round(v * 10) / 10;

function headPath(w: number, h: number, jaw: number): string {
  const top = CY - h;
  const bot = CY + h;
  const a = CY + h * (0.42 + 0.22 * jaw);
  const k = 0.38 + 0.5 * jaw;
  return `M${CX} ${n(top)}C${n(CX + w * 0.58)} ${n(top)} ${CX + w} ${n(CY - h * 0.55)} ${CX + w} ${CY}C${CX + w} ${n(a)} ${n(CX + w * k)} ${bot} ${CX} ${bot}C${n(CX - w * k)} ${bot} ${CX - w} ${n(a)} ${CX - w} ${CY}C${CX - w} ${n(CY - h * 0.55)} ${n(CX - w * 0.58)} ${n(top)} ${CX} ${n(top)}Z`;
}

function beardPath(w: number, h: number, jaw: number, extra: number): string {
  const bot = CY + h + extra;
  const a = CY + h * (0.42 + 0.22 * jaw) + extra * 0.4;
  const k = 0.38 + 0.5 * jaw;
  const inner = CY + h * 0.38;
  return `M${CX - w} ${CY + 2}C${CX - w} ${n(a)} ${n(CX - w * k)} ${bot} ${CX} ${bot}C${n(CX + w * k)} ${bot} ${CX + w} ${n(a)} ${CX + w} ${CY + 2}C${n(CX + w * 0.7)} ${n(CY + h * 0.28)} ${n(CX + w * 0.4)} ${n(inner)} ${CX} ${n(inner)}C${n(CX - w * 0.4)} ${n(inner)} ${n(CX - w * 0.7)} ${n(CY + h * 0.28)} ${CX - w} ${CY + 2}Z`;
}

function cap(w: number, h: number, lift: number, hairline: number): string {
  const top = CY - h - lift;
  return `M${CX - w - 1} ${CY - 4}C${CX - w - 3} ${n(CY - h * 0.9)} ${n(CX - w * 0.55)} ${n(top)} ${CX} ${n(top)}C${n(CX + w * 0.55)} ${n(top)} ${CX + w + 3} ${n(CY - h * 0.9)} ${CX + w + 1} ${CY - 4}C${n(CX + w * 0.9)} ${n(CY - h * hairline)} ${n(CX - w * 0.9)} ${n(CY - h * hairline)} ${CX - w - 1} ${CY - 4}Z`;
}

function sideLocks(w: number, h: number, length: number): string {
  const l = CY + h * length;
  const left = `M${CX - w - 1} ${CY - 4}C${CX - w - 6} ${n(CY + h * 0.2)} ${CX - w - 8} ${n(l - 12)} ${CX - w - 6} ${n(l)}L${CX - w + 4} ${n(l - 2)}C${CX - w + 2} ${n(CY + h * 0.3)} ${CX - w + 4} ${n(CY + h * 0.05)} ${CX - w + 6} ${CY - 8}Z`;
  const right = `M${CX + w + 1} ${CY - 4}C${CX + w + 6} ${n(CY + h * 0.2)} ${CX + w + 8} ${n(l - 12)} ${CX + w + 6} ${n(l)}L${CX + w - 4} ${n(l - 2)}C${CX + w - 2} ${n(CY + h * 0.3)} ${CX + w - 4} ${n(CY + h * 0.05)} ${CX + w - 6} ${CY - 8}Z`;
  return left + right;
}

export function renderPortraitSvg(input: Partial<Appearance> | undefined, label = 'Character portrait'): string {
  const a = sanitizeAppearance(input);
  const p = FACES[a.facePreset] ?? FACES.classic;
  const { w, h, jaw } = p;
  const skin = getOption('skinTone', a.skinTone).color!;
  const hair = getOption('hairColor', a.hairColor).color!;
  const eye = getOption('eyeColor', a.eyeColor).color!;
  const cloth = getOption('clothingColor', a.clothingColor).color!;
  const skinShade = shade(skin, -14);
  const skinDeep = shade(skin, -38);
  const hairEdge = shade(hair, -28);
  const bald = a.hairStyle === 'bald';
  const browColor = bald ? '#4a372c' : shade(hair, -12);
  const facial = a.hairColor === 'blue' ? '#3b2a20' : hair;
  const ey = CY + p.eyeY;
  const ny = CY + h * 0.34;
  const my = CY + h * 0.58;
  const out: string[] = [];
  const hairPaint = `fill="${hair}" stroke="${hairEdge}" stroke-width="1" stroke-linejoin="round"`;

  // ---------- hair behind the head ----------
  const back: string[] = [];
  switch (a.hairStyle) {
    case 'afro': back.push(`<circle cx="${CX}" cy="${CY - 12}" r="${w + 26}" ${hairPaint}/>`); break;
    case 'bob':
      back.push(`<path d="M${CX - w - 9} ${n(CY + h * 0.58)}C${CX - w - 16} ${n(CY - h)} ${n(CX - w * 0.6)} ${CY - h - 11} ${CX} ${CY - h - 11}C${n(CX + w * 0.6)} ${CY - h - 11} ${CX + w + 16} ${n(CY - h)} ${CX + w + 9} ${n(CY + h * 0.58)}Z" ${hairPaint}/>`); break;
    case 'long':
      back.push(`<path d="M${CX - w - 11} 170C${CX - w - 17} ${n(CY - h * 0.2)} ${CX - w - 10} ${CY - h - 9} ${CX} ${CY - h - 10}C${CX + w + 10} ${CY - h - 9} ${CX + w + 17} ${n(CY - h * 0.2)} ${CX + w + 11} 170Z" ${hairPaint}/>`); break;
    case 'ponytail':
      back.push(`<ellipse cx="${CX + w + 9}" cy="${CY + 12}" rx="8" ry="25" transform="rotate(14 ${CX + w + 9} ${CY + 12})" ${hairPaint}/>`); break;
    default: break;
  }
  out.push(...back);

  // ---------- body and clothing ----------
  if (a.clothing === 'hoodie') {
    out.push(`<path d="M${CX - 32} 160C${CX - 36} 138 ${CX - 20} 132 ${CX} 132C${CX + 20} 132 ${CX + 36} 138 ${CX + 32} 160Z" fill="${shade(cloth, -22)}"/>`);
  }
  out.push(`<path d="M${CX - 16} ${n(CY + h - 14)}L${CX - 16} 160L${CX + 16} 160L${CX + 16} ${n(CY + h - 14)}Z" fill="${skinShade}"/>`);
  out.push(`<path d="M12 200C12 168 50 154 ${CX} 154C150 154 188 168 188 200Z" fill="${cloth}"/>`);
  const trim = shade(cloth, -20);
  const light = shade(cloth, 38);
  switch (a.clothing) {
    case 'tshirt':
      out.push(`<path d="M${CX - 19} 154Q${CX} 174 ${CX + 19} 154Z" fill="${skinShade}"/><path d="M${CX - 19} 154Q${CX} 174 ${CX + 19} 154" fill="none" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>`);
      break;
    case 'hoodie':
      out.push(`<path d="M${CX - 17} 154Q${CX} 170 ${CX + 17} 154Z" fill="${skinShade}"/><path d="M${CX - 17} 154Q${CX} 170 ${CX + 17} 154" fill="none" stroke="${trim}" stroke-width="3"/><path d="M${CX - 7} 163L${CX - 9} 184M${CX + 7} 163L${CX + 9} 184" stroke="${shade(cloth, 55)}" stroke-width="2" stroke-linecap="round"/><path d="M${CX - 22} 196Q${CX} 186 ${CX + 22} 196" fill="none" stroke="${trim}" stroke-width="2"/>`);
      break;
    case 'sweater':
      out.push(`<path d="M${CX - 21} 153Q${CX} 172 ${CX + 21} 153" fill="none" stroke="${trim}" stroke-width="7" stroke-linecap="round"/><path d="M${CX - 21} 153Q${CX} 172 ${CX + 21} 153" fill="none" stroke="${shade(cloth, 12)}" stroke-width="2" stroke-dasharray="2 3"/>`);
      break;
    case 'shirt':
      out.push(`<path d="M${CX - 16} 154L${CX} 184L${CX + 16} 154Z" fill="${light}"/><path d="M${CX - 17} 150L${CX - 1} 168L${CX - 14} 173L${CX - 25} 157Z" fill="${light}" stroke="${trim}" stroke-width="1"/><path d="M${CX + 17} 150L${CX + 1} 168L${CX + 14} 173L${CX + 25} 157Z" fill="${light}" stroke="${trim}" stroke-width="1"/><path d="M${CX - 4} 168L${CX + 4} 168L${CX + 6} 198L${CX} 203L${CX - 6} 198Z" fill="#d4a94a" stroke="#b88a2e" stroke-width="1"/><path d="M${CX - 5} 164h10v6h-10z" fill="#b88a2e"/>`);
      break;
    case 'blazer':
      out.push(`<path d="M${CX - 15} 154L${CX} 190L${CX + 15} 154Z" fill="#f3f3f0"/><path d="M${CX - 18} 152L${CX - 1} 192L${CX - 24} 198L${CX - 40} 168Z" fill="${trim}"/><path d="M${CX + 18} 152L${CX + 1} 192L${CX + 24} 198L${CX + 40} 168Z" fill="${trim}"/>`);
      break;
    case 'polo':
      out.push(`<path d="M${CX - 18} 152L${CX - 3} 165L${CX - 12} 169L${CX - 24} 158Z" fill="${light}" stroke="${trim}" stroke-width="1"/><path d="M${CX + 18} 152L${CX + 3} 165L${CX + 12} 169L${CX + 24} 158Z" fill="${light}" stroke="${trim}" stroke-width="1"/><path d="M${CX} 164V186" stroke="${trim}" stroke-width="2"/><circle cx="${CX}" cy="172" r="1.5" fill="${light}"/><circle cx="${CX}" cy="180" r="1.5" fill="${light}"/>`);
      break;
    default: break;
  }

  // ---------- ears, shadow, head ----------
  out.push(`<ellipse cx="${CX - w}" cy="${CY + 6}" rx="6.5" ry="10" fill="${skin}"/><ellipse cx="${CX + w}" cy="${CY + 6}" rx="6.5" ry="10" fill="${skin}"/>`);
  out.push(`<ellipse cx="${CX - w}" cy="${CY + 7}" rx="2.6" ry="5.5" fill="${skinShade}"/><ellipse cx="${CX + w}" cy="${CY + 7}" rx="2.6" ry="5.5" fill="${skinShade}"/>`);
  out.push(`<ellipse cx="${CX}" cy="${CY + h + 3}" rx="22" ry="7" fill="${skinDeep}" opacity="0.32"/>`);
  out.push(`<path d="${headPath(w, h, jaw)}" fill="${skin}" stroke="${shade(skin, -22)}" stroke-width="1"/>`);
  out.push(`<ellipse cx="${CX - w * 0.55}" cy="${CY + h * 0.3}" rx="7" ry="4.5" fill="#e0707a" opacity="0.14"/><ellipse cx="${CX + w * 0.55}" cy="${CY + h * 0.3}" rx="7" ry="4.5" fill="#e0707a" opacity="0.14"/>`);

  // ---------- facial hair below the nose line ----------
  const mustache = `<path d="M${CX} ${n(ny + 3)}C${CX - 4} ${n(ny + 1)} ${n(CX - p.mouth - 2)} ${n(ny + 2)} ${n(CX - p.mouth - 3)} ${n(ny + 7)}C${n(CX - p.mouth * 0.6)} ${n(ny + 6)} ${CX - 3} ${n(my - 3)} ${CX} ${n(my - 4)}C${CX + 3} ${n(my - 3)} ${n(CX + p.mouth * 0.6)} ${n(ny + 6)} ${n(CX + p.mouth + 3)} ${n(ny + 7)}C${n(CX + p.mouth + 2)} ${n(ny + 2)} ${CX + 4} ${n(ny + 1)} ${CX} ${n(ny + 3)}Z" fill="${facial}" stroke="${shade(facial, -25)}" stroke-width="0.8"/>`;
  switch (a.facialHair) {
    case 'stubble': out.push(`<path d="${beardPath(w, h, jaw, 0)}" fill="${facial}" opacity="0.3"/>`); break;
    case 'goatee':
      out.push(`<path d="M${CX - 9} ${n(my + 5)}Q${CX} ${n(my + 1)} ${CX + 9} ${n(my + 5)}L${CX + 7} ${n(CY + h + 1)}Q${CX} ${n(CY + h + 8)} ${CX - 7} ${n(CY + h + 1)}Z" fill="${facial}" stroke="${shade(facial, -25)}" stroke-width="0.8"/>`);
      out.push(mustache);
      break;
    case 'mustache': out.push(mustache); break;
    case 'beard':
      out.push(`<path d="${beardPath(w, h, jaw, 7)}" fill="${facial}" stroke="${shade(facial, -25)}" stroke-width="1"/>`);
      out.push(mustache);
      break;
    default: break;
  }

  // ---------- eyes, brows, nose, mouth ----------
  for (const s of [-1, 1]) {
    const ex = CX + s * p.eye;
    out.push(`<ellipse cx="${ex}" cy="${ey}" rx="6.4" ry="4.3" fill="#fbfbfa"/><circle cx="${ex}" cy="${ey}" r="3.5" fill="${eye}"/><circle cx="${ex}" cy="${ey}" r="1.6" fill="#15110f"/><circle cx="${n(ex + 1.2)}" cy="${n(ey - 1.2)}" r="0.9" fill="#fff"/>`);
    out.push(`<path d="M${n(ex - 6.8)} ${ey}C${n(ex - 3)} ${n(ey - 5.8)} ${n(ex + 3)} ${n(ey - 5.8)} ${n(ex + 6.8)} ${ey}" fill="none" stroke="${skinDeep}" stroke-width="1.4" stroke-linecap="round"/>`);
    out.push(`<path d="M${n(ex - 7.5)} ${n(ey - 10.5 + (s === 1 ? 0.5 : 0))}Q${ex} ${n(ey - 14.5)} ${n(ex + 7.5)} ${n(ey - 10.5 + (s === -1 ? 0.5 : 0))}" fill="none" stroke="${browColor}" stroke-width="2.9" stroke-linecap="round"/>`);
  }
  out.push(`<path d="M${CX} ${n(ey + 3)}L${n(CX - p.nose * 0.4)} ${n(ny - 2)}Q${n(CX - p.nose)} ${n(ny + 2)} ${n(CX - p.nose * 0.2)} ${n(ny + 2.5)}Q${CX} ${n(ny + 3.5)} ${n(CX + p.nose * 0.2)} ${n(ny + 2.5)}Q${n(CX + p.nose)} ${n(ny + 2)} ${n(CX + p.nose * 0.4)} ${n(ny - 2)}" fill="none" stroke="${skinDeep}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`);
  const lip = mix(skin, '#a83a40', 0.6);
  out.push(`<path d="M${n(CX - p.mouth)} ${n(my)}Q${CX} ${n(my + 4.5)} ${n(CX + p.mouth)} ${n(my)}" fill="none" stroke="${lip}" stroke-width="2.8" stroke-linecap="round"/><path d="M${n(CX - p.mouth * 0.65)} ${n(my - 0.8)}Q${CX} ${n(my - 3)} ${n(CX + p.mouth * 0.65)} ${n(my - 0.8)}" fill="none" stroke="${lip}" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>`);

  // ---------- glasses ----------
  if (a.glasses !== 'none') {
    const frame = '#24252b';
    const r = 10.5;
    const lens = (cx: number) =>
      a.glasses === 'round'
        ? `<circle cx="${cx}" cy="${ey}" r="${r}" fill="#ffffff" fill-opacity="0.14" stroke="${frame}" stroke-width="2.2"/>`
        : `<rect x="${n(cx - 11.5)}" y="${n(ey - 8.5)}" width="23" height="17" rx="${a.glasses === 'sunglasses' ? 5 : 3.5}" fill="${a.glasses === 'sunglasses' ? '#15171c' : '#ffffff'}" fill-opacity="${a.glasses === 'sunglasses' ? 0.92 : 0.14}" stroke="${frame}" stroke-width="2.2"/>`;
    out.push(lens(CX - p.eye) + lens(CX + p.eye));
    out.push(`<path d="M${n(CX - p.eye + r)} ${ey}L${n(CX + p.eye - r)} ${ey}M${n(CX - p.eye - r)} ${ey}L${CX - w} ${ey - 1}M${n(CX + p.eye + r)} ${ey}L${CX + w} ${ey - 1}" stroke="${frame}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    if (a.glasses === 'sunglasses') out.push(`<path d="M${n(CX - p.eye - 6)} ${n(ey - 4)}l5 -2M${n(CX + p.eye - 6)} ${n(ey - 4)}l5 -2" stroke="#fff" stroke-opacity="0.35" stroke-width="1.5" stroke-linecap="round"/>`);
  }

  // ---------- hair in front ----------
  const front: string[] = [];
  const withCap = (lift: number, hl: number) => `<path d="${cap(w, h, lift, hl)}" ${hairPaint}/>`;
  switch (a.hairStyle) {
    case 'buzz': front.push(`<path d="${cap(w, h, 2, 0.8)}" fill="${hair}" opacity="0.88"/>`); break;
    case 'short': front.push(withCap(7, 0.7)); break;
    case 'sidepart':
      front.push(withCap(8, 0.62));
      front.push(`<path d="M${n(CX - w * 0.2)} ${CY - h - 6}C${n(CX + w * 0.3)} ${n(CY - h * 0.9)} ${n(CX + w * 0.95)} ${n(CY - h * 0.7)} ${CX + w + 1} ${CY - 4}L${n(CX + w * 0.9)} ${n(CY - h * 0.45)}C${n(CX + w * 0.4)} ${n(CY - h * 0.65)} ${CX} ${n(CY - h * 0.75)} ${n(CX - w * 0.2)} ${CY - h - 6}Z" fill="${shade(hair, -10)}" stroke="${hairEdge}" stroke-width="1"/>`);
      break;
    case 'curly': {
      front.push(withCap(5, 0.72));
      for (let i = 0; i < 9; i++) {
        const t = Math.PI + (i / 8) * Math.PI;
        front.push(`<circle cx="${n(CX + (w + 3) * Math.cos(t))}" cy="${n(CY - 8 + (h + 4) * Math.sin(t))}" r="9.5" ${hairPaint}/>`);
      }
      front.push(withCap(2, 0.76));
      break;
    }
    case 'afro': front.push(withCap(4, 0.78)); break;
    case 'bob': front.push(withCap(7, 0.65), `<path d="${sideLocks(w, h, 0.6)}" ${hairPaint}/>`); break;
    case 'long': front.push(withCap(7, 0.66), `<path d="${sideLocks(w, h, 1.3)}" ${hairPaint}/>`); break;
    case 'ponytail':
      front.push(withCap(7, 0.68), `<circle cx="${CX + w + 5}" cy="${CY - 10}" r="3.6" fill="#d4a94a"/>`);
      break;
    case 'bun':
      front.push(`<circle cx="${CX}" cy="${CY - h - 9}" r="12.5" ${hairPaint}/>`, withCap(6, 0.7));
      break;
    case 'mohawk':
      front.push(`<path d="${cap(w, h, 0, 0.82)}" fill="${hair}" opacity="0.22"/>`);
      front.push(`<path d="M${CX - 9} ${n(CY - h * 0.5)}C${CX - 10} ${CY - h - 6} ${CX - 6} ${CY - h - 20} ${CX} ${CY - h - 22}C${CX + 6} ${CY - h - 20} ${CX + 10} ${CY - h - 6} ${CX + 9} ${n(CY - h * 0.5)}Z" ${hairPaint}/>`);
      break;
    default: break;
  }
  if (a.accessory !== 'cap') out.push(...front);

  // ---------- accessories ----------
  const gold = '#d4a94a';
  switch (a.accessory) {
    case 'earring': out.push(`<circle cx="${CX - w - 1}" cy="${CY + 17}" r="3.2" fill="${gold}" stroke="#b88a2e" stroke-width="1"/>`); break;
    case 'headband': {
      const y = CY - h * 0.62;
      out.push(`<path d="M${CX - w - 1} ${n(y)}C${n(CX - w * 0.5)} ${n(y - h * 0.16)} ${n(CX + w * 0.5)} ${n(y - h * 0.16)} ${CX + w + 1} ${n(y)}L${CX + w + 1} ${n(y + 9)}C${n(CX + w * 0.5)} ${n(y - h * 0.16 + 9)} ${n(CX - w * 0.5)} ${n(y - h * 0.16 + 9)} ${CX - w - 1} ${n(y + 9)}Z" fill="${gold}" stroke="#b88a2e" stroke-width="1"/>`);
      break;
    }
    case 'cap': {
      const capColor = shade(cloth, -10);
      const y = CY - h * 0.55;
      out.push(`<path d="M${CX - w - 3} ${n(y)}C${CX - w - 3} ${CY - h - 16} ${CX + w + 3} ${CY - h - 16} ${CX + w + 3} ${n(y)}Z" fill="${capColor}" stroke="${shade(capColor, -30)}" stroke-width="1"/>`);
      out.push(`<ellipse cx="${CX}" cy="${n(y)}" rx="${w + 9}" ry="5.5" fill="${shade(capColor, -18)}" stroke="${shade(capColor, -40)}" stroke-width="1"/>`);
      out.push(`<circle cx="${CX}" cy="${n(y - h * 0.55)}" r="2.6" fill="${gold}"/>`);
      break;
    }
    case 'headphones':
      out.push(`<path d="M${CX - w - 4} ${CY + 4}C${CX - w - 4} ${CY - h - 18} ${CX + w + 4} ${CY - h - 18} ${CX + w + 4} ${CY + 4}" fill="none" stroke="#2a2d36" stroke-width="6" stroke-linecap="round"/>`);
      out.push(`<rect x="${CX - w - 13}" y="${CY - 5}" width="12" height="26" rx="5.5" fill="#2a2d36" stroke="${gold}" stroke-width="1.5"/><rect x="${CX + w + 1}" y="${CY - 5}" width="12" height="26" rx="5.5" fill="#2a2d36" stroke="${gold}" stroke-width="1.5"/>`);
      break;
    case 'scarf':
      out.push(`<path d="M${CX - 28} 148Q${CX} 170 ${CX + 28} 148L${CX + 32} 162Q${CX} 187 ${CX - 32} 162Z" fill="#8a2f3f" stroke="#5f1f2b" stroke-width="1"/><path d="M${CX + 10} 170L${CX + 25} 198L${CX + 12} 200L${CX + 2} 174Z" fill="#8a2f3f" stroke="#5f1f2b" stroke-width="1"/>`);
      break;
    case 'pin': out.push(`<circle cx="${CX + 38}" cy="178" r="5" fill="${gold}" stroke="#b88a2e" stroke-width="1"/><path d="M${CX + 36} 181l1.2-5.5q2-1.6 3.4 0l-.6 5.5z" fill="#14161b"/>`); break;
    default: break;
  }

  const defs = `<defs><radialGradient id="ccm-bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#2b3d63"/><stop offset="1" stop-color="#121b30"/></radialGradient><clipPath id="ccm-clip"><circle cx="100" cy="100" r="100"/></clipPath></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label="${label.replace(/[<>&"]/g, '')}">${defs}<g clip-path="url(#ccm-clip)"><circle cx="100" cy="100" r="100" fill="url(#ccm-bg)"/><g transform="translate(100 112) scale(1.22) translate(-100 -112)">${out.join('')}</g></g></svg>`;
}
