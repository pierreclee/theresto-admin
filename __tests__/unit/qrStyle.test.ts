/**
 * @jest-environment node
 *
 * Style du QR (short_links.qr_style) : parseQrStyle applique les règles de la base
 * (short_link_qr_style_valid, migration 20261128100000 de theresto_app) ; mêmes cas que
 * supabase/tests/short_link_qr_style_test.sql, plus ceux propres au JavaScript.
 */
import { DEFAULT_QR_STYLE, parseQrStyle, qrStyleOrDefault, type QrStyle } from '@/lib/links/qrStyle';

const OK = { v: 1, modules: 'dots', eyeFrame: 'rounded', eyeDot: 'circle', fg: '#111111', bg: '#FFFFFF', logo: 'theresto' };
const PATH = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const without = (key: string) => Object.fromEntries(Object.entries(OK).filter(([k]) => k !== key));

describe('parseQrStyle : styles acceptés', () => {
  it('style valide, rendu à l identique', () => {
    expect(parseQrStyle(OK)).toEqual(OK);
    expect(parseQrStyle(JSON.parse(JSON.stringify(OK)))).toEqual(OK);
  });

  it('sans logo, couleur en casse mélangée', () => {
    const s = { ...OK, logo: 'none', modules: 'star', eyeFrame: 'leaf', eyeDot: 'square', fg: '#a0B1c2' };
    expect(parseQrStyle(s)).toEqual(s);
  });

  it.each(['svg', 'png', 'jpg'])('logo importé (%s)', (ext) => {
    const s = { ...OK, logo: 'custom', logoPath: `${PATH}.${ext}` };
    expect(parseQrStyle(s)).toEqual(s);
  });

  it('toutes les formes', () => {
    for (const modules of ['square', 'rounded', 'dots', 'diamond', 'star']) {
      for (const eye of ['square', 'rounded', 'circle', 'leaf']) {
        expect(parseQrStyle({ ...OK, modules, eyeFrame: eye, eyeDot: eye })).not.toBeNull();
      }
    }
  });

  it('style par défaut : valide, carré, couleurs de l écran, logo TheResto', () => {
    expect(parseQrStyle(DEFAULT_QR_STYLE)).toEqual(DEFAULT_QR_STYLE);
    expect(DEFAULT_QR_STYLE).toEqual({
      v: 1, modules: 'square', eyeFrame: 'square', eyeDot: 'square', fg: '#0F1629', bg: '#FFFFFF', logo: 'theresto',
    });
    expect(Object.isFrozen(DEFAULT_QR_STYLE)).toBe(true);
  });
});

describe('parseQrStyle : styles refusés (comme la base)', () => {
  const refused: [string, unknown][] = [
    ['clé en trop', { ...OK, extra: 1 }],
    ['clé absente', without('bg')],
    ['custom sans logoPath', { ...OK, logo: 'custom' }],
    ['logoPath sans custom', { ...OK, logoPath: `${PATH}.png` }],
    ['logoPath avec ../', { ...OK, logo: 'custom', logoPath: `../${PATH}.png` }],
    ['logoPath dans un dossier', { ...OK, logo: 'custom', logoPath: `dossier/${PATH}.png` }],
    ['logoPath en majuscules', { ...OK, logo: 'custom', logoPath: `${PATH.toUpperCase()}.png` }],
    ['logoPath .jpeg', { ...OK, logo: 'custom', logoPath: `${PATH}.jpeg` }],
    ['logoPath .gif', { ...OK, logo: 'custom', logoPath: `${PATH}.gif` }],
    ['logoPath suivi d un saut de ligne', { ...OK, logo: 'custom', logoPath: `${PATH}.png\n` }],
    ['logoPath non texte', { ...OK, logo: 'custom', logoPath: 1 }],
    ['couleur trop courte', { ...OK, fg: '#11111' }],
    ['couleur hors hexadécimal', { ...OK, fg: '#GGGGGG' }],
    ['couleur sans #', { ...OK, bg: 'FFFFFF' }],
    ['couleur suivie d un espace', { ...OK, bg: '#FFFFFF ' }],
    ['couleur suivie d un saut de ligne', { ...OK, bg: '#FFFFFF\n' }],
    ['couleur nommée', { ...OK, fg: 'black' }],
    ['version 2', { ...OK, v: 2 }],
    ['version en texte', { ...OK, v: '1' }],
    ['version 1.5', { ...OK, v: 1.5 }],
    ['version vraie', { ...OK, v: true }],
    ['forme de module inconnue', { ...OK, modules: 'hexagon' }],
    ['cadre inconnu', { ...OK, eyeFrame: 'dots' }],
    ['point inconnu', { ...OK, eyeDot: 'star' }],
    ['logo inconnu', { ...OK, logo: 'autre' }],
    ['forme en tableau', { ...OK, modules: ['dots'] }],
    ['forme en majuscules', { ...OK, modules: 'Square' }],
    ['clé __proto__', JSON.parse(`{${JSON.stringify(OK).slice(1, -1)},"__proto__":{}}`)],
    ['tableau', []],
    ['texte', 'square'],
    ['objet vide', {}],
    ['null', null],
    ['undefined', undefined],
    ['nombre', 1],
  ];

  it.each(refused)('%s', (_label, value) => {
    expect(parseQrStyle(value)).toBeNull();
  });
});

describe('qrStyleOrDefault', () => {
  it('style valide gardé ; NULL ou style refusé : défaut', () => {
    expect(qrStyleOrDefault(OK)).toEqual(OK);
    expect(qrStyleOrDefault(null)).toBe(DEFAULT_QR_STYLE);
    expect(qrStyleOrDefault({ ...OK, v: 2 })).toBe(DEFAULT_QR_STYLE);
  });

  it('le résultat est une copie (pas l objet lu)', () => {
    const input = { ...OK, logo: 'custom', logoPath: `${PATH}.svg` };
    const style = qrStyleOrDefault(input) as Extract<QrStyle, { logo: 'custom' }>;
    expect(style).not.toBe(input);
    expect(style.logoPath).toBe(`${PATH}.svg`);
  });
});
