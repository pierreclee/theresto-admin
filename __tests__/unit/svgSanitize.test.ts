/**
 * @jest-environment node
 *
 * Nettoyage des logos SVG du QR (liste blanche après analyse XML) : contournements d'un
 * filtre sur le texte refusés (préfixes d'espace de noms, entités, échappements CSS), éléments
 * actifs refusés, logos exportés par les logiciels de dessin acceptés, classes converties en
 * attributs, ids préfixés.
 */
import fs from 'fs';
import path from 'path';
import { sanitizeSvgLogo } from '@/lib/links/svgSanitize';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const wrap = (inner: string, attrs = '') => `<svg ${NS} viewBox="0 0 10 10"${attrs}>${inner}</svg>`;

describe('svgSanitize : refus', () => {
  const refused: [string, string][] = [
    ['script préfixé dans l espace SVG', wrap('<x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script>')],
    ['script XHTML', wrap('<h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script>')],
    ['set préfixé vers javascript encodé', wrap('<x:set xmlns:x="http://www.w3.org/2000/svg" attributeName="href" to="jav&#x61;script:alert(1)"/>')],
    ['@import échappé', wrap('<style>@\\69mport "https://evil/t.css";</style>')],
    ['url() échappée', wrap('<rect style="fill:u\\72l(https://evil/t)" width="1" height="1"/>')],
    ['url() échappée dans une feuille', wrap('<style>.a{fill:u\\72l(https://evil/t)}</style><rect class="a"/>')],
    ['script', wrap('<script>alert(1)</script>')],
    ['foreignObject', wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>')],
    ['image', wrap('<image width="1" height="1"/>')],
    ['use', wrap('<rect id="a"/><use/>')],
    ['a', wrap('<a><rect/></a>')],
    ['animate', wrap('<rect><animate attributeName="fill" to="red"/></rect>')],
    ['set', wrap('<rect><set attributeName="fill" to="red"/></rect>')],
    ['svg imbriqué', wrap(`<svg ${NS} viewBox="0 0 1 1"/>`)],
    ['text', wrap('<text>x</text>')],
    ['DOCTYPE', `<!DOCTYPE svg>${wrap('')}`],
    ['ENTITY', `<!DOCTYPE svg [<!ENTITY a "b">]>${wrap('<rect fill="&a;"/>')}`],
    ['instruction de traitement', `<?xml-stylesheet href="https://evil/t.css"?>${wrap('')}`],
    ['on click avec retours ligne', wrap('<rect\nonclick\n=\n"x()"/>')],
    ['onload sur la racine', `<svg ${NS} viewBox="0 0 1 1" onload="x()"></svg>`],
    ['href', wrap('<linearGradient id="g" href="#h"/>')],
    ['xlink:href', wrap('<linearGradient xmlns:xlink="http://www.w3.org/1999/xlink" id="g" xlink:href="#h"/>')],
    ['attribut préfixé', wrap('<rect xmlns:e="urn:x" e:foo="1"/>')],
    ['javascript: dans une valeur', wrap('<rect fill="javascript:x"/>')],
    ['expression()', wrap('<rect style="fill:expression(alert(1))"/>')],
    ['url externe', wrap('<rect fill="url(https://evil/t)"/>')],
    ['url vers un id absent', wrap('<rect fill="url(#nope)"/>')],
    ['url sans parenthèse fermante propre', wrap('<rect id="g"/><rect fill="url(#g) url(https://x)"/>')],
    ['@font-face', wrap('<style>@font-face{font-family:x;src:url(https://evil/f)}</style>')],
    ['sélecteur d élément', wrap('<style>rect{fill:red}</style>')],
    ['sélecteur d id', wrap('<style>#a{fill:red}</style>')],
    ['sélecteur universel', wrap('<style>*{fill:red}</style>')],
    ['combinateur', wrap('<style>.a .b{fill:red}</style>')],
    ['élément dans un style', wrap('<style><rect/></style>')],
    ['longueur en %', wrap('<rect width="100%" height="1"/>')],
    ['racine hors espace SVG', '<svg viewBox="0 0 1 1"><rect/></svg>'],
    ['racine préfixée', '<s:svg xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'],
    ['élément remis hors espace', wrap('<rect xmlns=""/>')],
    ['racine autre que svg', `<g ${NS}/>`],
    ['viewBox absent', `<svg ${NS} width="10" height="10"></svg>`],
    ['viewBox vide', `<svg ${NS} viewBox="0 0 0 10"></svg>`],
    ['viewBox illisible', `<svg ${NS} viewBox="0 0 a 10"></svg>`],
    ['mal formé', `<svg ${NS} viewBox="0 0 1 1"><rect></svg>`],
    ['pas du SVG', 'bonjour'],
  ];

  it.each(refused)('%s', (_label, svg) => {
    expect(() => sanitizeSvgLogo(svg)).toThrow(/^Logo SVG refusé : /);
  });
});

describe('svgSanitize : acceptés', () => {
  it('SVG Illustrator : classes converties en attributs, ids préfixés', () => {
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: Adobe Illustrator 28.0 -->\n'
      + `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" id="Calque_1" data-name="Calque 1" version="1.1" `
      + 'viewBox="0 0 100 50" xml:space="preserve" width="100%">'
      + '<defs><style>.cls-1{fill:#ff6b35;}.cls-2{fill:url(#grad);}.cls-1, .cls-3 { stroke : #000 ; }</style>'
      + '<linearGradient id="grad" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">'
      + '<stop offset="0" stop-color="#1f3a5f"/><stop offset="1" style="stop-color:#ff6b35"/></linearGradient></defs>'
      + '<title>Logo</title><path class="cls-1" data-name="forme" d="M0 0h10v10H0z"/>'
      + '<rect class="cls-2 cls-3" fill="#00f" style="opacity:.5" width="20" height="10"/></svg>';
    const { inner, viewBox } = sanitizeSvgLogo(svg, 'lg-7-');
    expect(viewBox).toEqual([0, 0, 100, 50]);
    expect(inner).not.toMatch(/class=|style|data-name|title|xlink|Calque/);
    expect(inner).toContain('<linearGradient id="lg-7-grad"');
    expect(inner).toContain('<stop offset="1" stop-color="#ff6b35"/>');
    expect(inner).toContain('<path d="M0 0h10v10H0z" fill="#ff6b35" stroke="#000"/>');
    // Feuille de style au-dessus de l'attribut, style= en ligne au-dessus de tout.
    expect(inner).toContain('<rect fill="url(#lg-7-grad)" width="20" height="10" stroke="#000" opacity=".5"/>');
  });

  it('CDATA et commentaires CSS dans la feuille', () => {
    const { inner } = sanitizeSvgLogo(wrap('<style><![CDATA[ /* x */ .a { fill: #123456 } ]]></style><rect class="a"/>'));
    expect(inner).toBe('<rect fill="#123456"/>');
  });

  it('attributs de présentation de la racine reportés sur un groupe', () => {
    const { inner } = sanitizeSvgLogo(`<svg ${NS} viewBox="0 0 1 1" fill="#f00"><rect width="1" height="1"/></svg>`);
    expect(inner).toBe('<g fill="#f00"><rect width="1" height="1"/></g>');
  });

  it('logo TheResto (public/qr-logo.svg)', () => {
    const logo = fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8');
    const { inner, viewBox } = sanitizeSvgLogo(logo);
    expect(viewBox).toEqual([0, 0, 100, 100]);
    expect(inner).toMatch(/^<rect width="100" height="100" rx="22" fill="#FF6B35"\/><path /);
  });

  it('références url( #id) internes, textes et inconnus inoffensifs retirés', () => {
    const { inner } = sanitizeSvgLogo(wrap('texte<clipPath id="c"><circle r="1"/></clipPath>'
      + '<g clip-path="url( \'#c\' )" filter="blur" data-x="1"><rect/></g>'), 'p-');
    expect(inner).toBe('<clipPath id="p-c"><circle r="1"/></clipPath><g clip-path="url(#p-c)"><rect/></g>');
  });
});
