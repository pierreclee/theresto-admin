// Nettoyage d'un logo SVG (intégré ou importé) avant de le recopier dans un QR, fonction pure
// partagée par le navigateur et le serveur. Le SVG exporté part chez des imprimeurs et sur des
// sites : rien de ce qu'il contient ne doit pouvoir exécuter, charger ou suivre quoi que ce soit.
//
// Liste blanche après analyse XML (@xmldom/xmldom), jamais un filtre sur le texte :
//   - avant l'analyse : DOCTYPE, ENTITY et toute déclaration `<!…>` (hors commentaire et CDATA),
//     instructions de traitement (hors déclaration XML en tête) et `&#` refusés ;
//   - racine `svg` de l'espace de noms SVG, viewBox de 4 nombres, largeur et hauteur > 0 ;
//   - éléments de l'espace SVG sans préfixe, de la liste ELEMENTS ; title, desc et metadata
//     retirés ; tout autre élément refuse le fichier ;
//   - attributs de la liste ATTRIBUTES ; on…, href (xlink compris) et tout attribut préfixé
//     refusent le fichier (sauf les déclarations xmlns:… et xml:space, retirées, sans effet
//     puisque tout nom préfixé est refusé) ; un autre attribut inconnu est retiré ;
//   - valeurs : refus de `\`, `javascript:`, `expression(`, `@`, d'une fonction autre que
//     url(#id interne), rgb(), hsl() ou une transformation, et des longueurs en % ;
//   - `<style>` : seulement `.classe[, .classe] { propriété: valeur; … }`, propriétés de
//     présentation de la liste, converties en attributs sur les éléments de la classe (ordre
//     des règles respecté, `style=` en ligne prioritaire) ; `<style>` et `class` retirés ;
//   - ids préfixés (préfixe fourni, unique par logo dessiné), références url(#…) comprises.

import { DOMParser, XMLSerializer, type Element, type Node } from '@xmldom/xmldom';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ELEMENTS = new Set([
  'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'style',
]);
/** Éléments sans rendu, retirés avec leur contenu. */
const DROPPED_ELEMENTS = new Set(['title', 'desc', 'metadata']);

/** Propriétés de présentation, permises en attribut, dans `<style>` et dans `style=`. */
const PRESENTATION = new Set([
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity',
  'fill-rule', 'clip-rule', 'clip-path', 'mask', 'stop-color', 'stop-opacity',
]);

const ATTRIBUTES = new Set([
  ...PRESENTATION,
  'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'fx', 'fy', 'x1', 'y1', 'x2', 'y2',
  'points', 'transform', 'offset', 'gradientUnits', 'gradientTransform', 'spreadMethod',
  'clipPathUnits', 'maskUnits', 'maskContentUnits', 'id', 'class', 'style',
]);

const ROOT_ATTRIBUTES = new Set([...ATTRIBUTES, 'viewBox', 'xmlns', 'version', 'preserveAspectRatio']);

/** Longueurs : un pourcentage se résoudrait sur le QR entier, pas sur le logo. */
const LENGTHS = new Set([
  'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'fx', 'fy', 'x1', 'y1', 'x2', 'y2',
  'stroke-width', 'stroke-dasharray', 'stroke-dashoffset',
]);

/** Fonctions permises dans une valeur (url() n'accepte qu'une référence interne). */
const FUNCTIONS = new Set(['url', 'rgb', 'rgba', 'hsl', 'hsla', 'matrix', 'translate', 'scale', 'rotate', 'skewx', 'skewy']);

const ID = /^[A-Za-z_][\w.-]*$/;
const CLASS_NAME = /^-?[A-Za-z_][\w-]*$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const URL_REF = /url\(\s*(['"]?)\s*#([^'")\s]+)\s*\1\s*\)/gi;

export interface SanitizedSvg {
  /** Contenu de la racine, nettoyé et resérialisé. */
  inner: string;
  viewBox: [number, number, number, number];
}

class SvgRefused extends Error {}

function refuse(reason: string): never {
  throw new SvgRefused(`Logo SVG refusé : ${reason}.`);
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

/** Valeur filtrée ; références url(#id) réécrites avec le préfixe. */
function cleanValue(name: string, raw: string, ids: Set<string>, prefix: string): string {
  const value = raw.trim();
  const compact = value.replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
  if (value.includes('\\')) refuse('caractère d\'échappement interdit');
  if (compact.includes('javascript:') || compact.includes('expression(')) refuse('il contient un script');
  if (value.includes('@')) refuse('valeur interdite');
  if (LENGTHS.has(name) && value.includes('%')) refuse('longueur en pourcentage');
  for (const m of value.matchAll(/([A-Za-z-]*)\s*\(/g)) {
    if (!FUNCTIONS.has(m[1].toLowerCase())) refuse('fonction interdite dans une valeur');
  }
  // Toute url( doit être une référence interne vers un id existant.
  const urls = (value.match(/url\s*\(/gi) ?? []).length;
  let refs = 0;
  const rewritten = value.replace(URL_REF, (_m, _q, id: string) => {
    refs += 1;
    if (!ids.has(id)) refuse('référence à une ressource inconnue ou externe');
    return `url(#${prefix}${id})`;
  });
  if (refs !== urls) refuse('il contient une ressource externe');
  return rewritten;
}

/** Déclarations `prop: valeur; …` d'un bloc CSS ou d'un `style=`, propriétés de présentation seulement. */
function parseDeclarations(block: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of block.split(';')) {
    if (!part.trim()) continue;
    const colon = part.indexOf(':');
    if (colon <= 0) refuse('style illisible');
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim().replace(/\s*!important$/i, '');
    if (!/^-?[a-z][a-z-]*$/.test(prop) || !value) refuse('style illisible');
    // Propriété ignorée : sa valeur doit tout de même être inoffensive. Les autres passent par
    // cleanValue une fois converties en attributs.
    if (PRESENTATION.has(prop)) out.push([prop, value]);
    else if (/[\\@]/.test(value) || /javascript:|expression\(|url\(/i.test(value.replace(/\s+/g, ''))) {
      refuse('valeur interdite dans un style');
    }
  }
  return out;
}

interface CssRule {
  classes: string[];
  declarations: [string, string][];
}

/** Feuille de style : seulement des règles de classes. */
function parseStyleSheet(css: string): CssRule[] {
  let rest = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (rest.includes('/*')) refuse('style illisible');
  if (rest.includes('@')) refuse('règle de style interdite (@import, @font-face…)');
  const rules: CssRule[] = [];
  const rule = /^\s*([^{}]+?)\s*\{([^{}]*)\}/;
  rest = rest.trim();
  while (rest) {
    const m = rule.exec(rest);
    if (!m) refuse('style illisible');
    const classes = m[1].split(',').map((s) => s.trim());
    for (const sel of classes) {
      if (!sel.startsWith('.') || !CLASS_NAME.test(sel.slice(1))) {
        refuse('sélecteur de style interdit (classes seules)');
      }
    }
    rules.push({ classes: classes.map((s) => s.slice(1)), declarations: parseDeclarations(m[2]) });
    rest = rest.slice(m[0].length).trim();
  }
  return rules;
}

function elementsOf(root: Element): Element[] {
  const out: Element[] = [];
  const walk = (el: Element) => {
    out.push(el);
    for (const child of Array.from(el.childNodes)) if (isElement(child)) walk(child);
  };
  walk(root);
  return out;
}

function parseViewBox(raw: string | null): [number, number, number, number] {
  const parts = (raw ?? '').trim().split(/[\s,]+/);
  if (parts.length !== 4 || !parts.every((p) => NUMBER.test(p))) refuse('viewBox attendu');
  const box = parts.map(Number) as [number, number, number, number];
  if (!box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) refuse('viewBox attendu');
  return box;
}

/**
 * Nettoie `logoSvg` ; ids préfixés par `idPrefix`. Renvoie le contenu de la racine et son
 * viewBox, ou lève une erreur en français (« Logo SVG refusé : … »).
 */
export function sanitizeSvgLogo(logoSvg: string, idPrefix = 'lg-'): SanitizedSvg {
  if (!/^[A-Za-z][\w-]*$/.test(idPrefix)) throw new Error('Préfixe d\'id invalide');
  if (typeof logoSvg !== 'string') refuse('fichier mal formé');
  const source = logoSvg.replace(/^﻿/, '').replace(/^\s*<\?xml\s[^?]*\?>/, '');
  if (/<!(?!--|\[CDATA\[)/.test(source)) refuse('DOCTYPE ou entité interdits');
  if (source.includes('<?')) refuse('instruction de traitement interdite');
  if (source.includes('&#')) refuse('caractère encodé interdit');

  let doc;
  try {
    doc = new DOMParser({
      onError: (level, msg) => {
        throw new SvgRefused(`${level}: ${msg}`);
      },
    }).parseFromString(source, 'text/xml');
  } catch {
    refuse('fichier mal formé');
  }
  const root = doc.documentElement;
  if (!root || root.namespaceURI !== SVG_NS || root.prefix || root.localName !== 'svg') {
    refuse('racine <svg> de l\'espace de noms SVG attendue');
  }
  const viewBox = parseViewBox(root.getAttribute('viewBox'));

  // 1. Éléments : liste blanche ; title, desc, metadata, textes, commentaires retirés.
  const prune = (el: Element) => {
    for (const child of Array.from(el.childNodes)) {
      if (isElement(child)) {
        if (el.localName === 'style') refuse('élément dans un style');
        if (child.namespaceURI !== SVG_NS || child.prefix) refuse(`élément interdit <${child.nodeName}>`);
        if (DROPPED_ELEMENTS.has(child.localName!)) {
          el.removeChild(child);
          continue;
        }
        if (!ELEMENTS.has(child.localName!)) refuse(`élément interdit <${child.localName}>`);
        prune(child);
      } else if (el.localName !== 'style' || (child.nodeType !== 3 && child.nodeType !== 4)) {
        el.removeChild(child);
      }
    }
  };
  prune(root);

  // 2. Attributs : noms (refus des href, on…, préfixes), ids et classes relevés.
  const all = elementsOf(root);
  const ids = new Set<string>();
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      const lower = name.toLowerCase();
      if (lower.startsWith('on') || lower.includes('href')) refuse(`attribut interdit « ${name} »`);
      if (name === 'xmlns') {
        if (attr.value !== SVG_NS) refuse('espace de noms interdit');
        continue;
      }
      if (lower.startsWith('xmlns:') || name === 'xml:space') {
        el.removeAttribute(name);
        continue;
      }
      if (name.includes(':')) refuse(`attribut interdit « ${name} »`);
      const allowed = el === root ? ROOT_ATTRIBUTES : ATTRIBUTES;
      if (!allowed.has(name)) el.removeAttribute(name);
    }
    if (el !== root && el.hasAttribute('id')) {
      const id = el.getAttribute('id')!.trim();
      if (!ID.test(id)) refuse('identifiant invalide');
      ids.add(id);
    }
  }

  // 3. Feuilles de style converties en attributs (règles dans l'ordre, puis style= en ligne).
  const rules: CssRule[] = [];
  for (const el of all) {
    if (el.localName !== 'style') continue;
    rules.push(...parseStyleSheet(el.textContent ?? ''));
    el.parentNode!.removeChild(el);
  }
  const elements = elementsOf(root);
  for (const el of elements) {
    const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    for (const rule of rules) {
      if (!rule.classes.some((c) => classes.includes(c))) continue;
      for (const [prop, value] of rule.declarations) el.setAttribute(prop, value);
    }
    if (el.hasAttribute('style')) {
      for (const [prop, value] of parseDeclarations(el.getAttribute('style')!)) el.setAttribute(prop, value);
    }
    el.removeAttribute('class');
    el.removeAttribute('style');
  }

  // 4. Valeurs filtrées, ids préfixés.
  for (const el of elements) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      if (el === root && !PRESENTATION.has(name)) continue;
      if (name === 'id') {
        el.setAttribute('id', `${idPrefix}${attr.value.trim()}`);
        continue;
      }
      el.setAttribute(name, cleanValue(name, attr.value, ids, idPrefix));
    }
  }

  // 5. Racine : ses attributs de présentation passent sur un <g> qui enveloppe le contenu.
  const inherited = Array.from(root.attributes).filter((a) => PRESENTATION.has(a.name));
  if (inherited.length) {
    const g = doc.createElementNS(SVG_NS, 'g');
    for (const a of inherited) g.setAttribute(a.name, a.value);
    while (root.firstChild) g.appendChild(root.firstChild);
    root.appendChild(g);
  }
  for (const a of Array.from(root.attributes)) if (a.name !== 'xmlns') root.removeAttribute(a.name);
  root.setAttribute('xmlns', SVG_NS);

  const xml = new XMLSerializer().serializeToString(root);
  const open = `<svg xmlns="${SVG_NS}">`;
  if (xml === `<svg xmlns="${SVG_NS}"/>`) return { inner: '', viewBox };
  if (!xml.startsWith(open) || !xml.endsWith('</svg>')) refuse('fichier mal formé');
  return { inner: xml.slice(open.length, -'</svg>'.length), viewBox };
}
