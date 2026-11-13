'use client';

// Choix des formes du QR par boutons, chacun avec une petite vignette de la forme.

import type { ReactNode } from 'react';
import type { QrEyeShape, QrModuleShape } from '@/lib/links/qrStyle';

export const MODULE_SHAPE_LABELS: Record<QrModuleShape, string> = {
  square: 'Carrés',
  rounded: 'Arrondis',
  dots: 'Points',
  diamond: 'Losanges',
  star: 'Étoiles',
};

export const EYE_SHAPE_LABELS: Record<QrEyeShape, string> = {
  square: 'Carré',
  rounded: 'Arrondi',
  circle: 'Rond',
  leaf: 'Feuille',
};

/** Une case de module (côté 1) centrée en (cx, cy), dans la forme choisie. */
function moduleMark(shape: QrModuleShape, cx: number, cy: number, key: string): ReactNode {
  switch (shape) {
    case 'square':
      return <rect key={key} x={cx - 0.5} y={cy - 0.5} width={1} height={1} />;
    case 'rounded':
      return <rect key={key} x={cx - 0.5} y={cy - 0.5} width={1} height={1} rx={0.35} />;
    case 'dots':
      return <circle key={key} cx={cx} cy={cy} r={0.45} />;
    case 'diamond':
      return <path key={key} d={`M${cx} ${cy - 0.56}L${cx + 0.56} ${cy}L${cx} ${cy + 0.56}L${cx - 0.56} ${cy}z`} />;
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (-90 + i * 45) * (Math.PI / 180);
        const r = i % 2 === 0 ? 0.6 : 0.32;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`);
      }
      return <path key={key} d={`M${pts.join('L')}z`} />;
    }
  }
}

/** Motif de 3×3 cases (5 foncées) dans la forme des modules. */
export function ModuleShapeIcon({ shape }: { shape: QrModuleShape }) {
  const cells: [number, number][] = [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]];
  return (
    <svg viewBox="-0.2 -0.2 3.4 3.4" width={28} height={28} aria-hidden="true" className="fill-current">
      {cells.map(([c, r]) => moduleMark(shape, c + 0.5, r + 0.5, `${c}-${r}`))}
    </svg>
  );
}

/** Chemin d'un carré de côté `side` en (x, y) dans une forme de repère (feuille : coin droit en bas à droite). */
function eyePath(shape: QrEyeShape, x: number, y: number, side: number, rounded: number, leaf: number): string {
  const radii = shape === 'square' ? [0, 0, 0, 0]
    : shape === 'rounded' ? [rounded, rounded, rounded, rounded]
      : shape === 'circle' ? [side / 2, side / 2, side / 2, side / 2]
        : [leaf, 0, leaf, 0];
  const [tl, tr, br, bl] = radii;
  const arc = (r: number, ex: number, ey: number) => (r > 0 ? `A${r} ${r} 0 0 1 ${ex} ${ey}` : '');
  return `M${x + tl} ${y}H${x + side - tr}${arc(tr, x + side, y + tr)}V${y + side - br}${arc(br, x + side - br, y + side)}`
    + `H${x + bl}${arc(bl, x, y + side - bl)}V${y + tl}${arc(tl, x + tl, y)}Z`;
}

/** Vignette d'un repère : cadre (`part = frame`) ou point (`part = dot`) mis en avant. */
export function EyeShapeIcon({ shape, part }: { shape: QrEyeShape; part: 'frame' | 'dot' }) {
  if (part === 'frame') {
    return (
      <svg viewBox="-0.5 -0.5 8 8" width={28} height={28} aria-hidden="true" className="fill-current">
        <path fillRule="evenodd" d={eyePath(shape, 0, 0, 7, 2, 3) + eyePath(shape, 1, 1, 5, 1, 2)} />
        <rect x={2} y={2} width={3} height={3} opacity={0.3} />
      </svg>
    );
  }
  return (
    <svg viewBox="-0.5 -0.5 8 8" width={28} height={28} aria-hidden="true" className="fill-current">
      <path fillRule="evenodd" opacity={0.3} d={eyePath('square', 0, 0, 7, 0, 0) + eyePath('square', 1, 1, 5, 0, 0)} />
      <path d={eyePath(shape, 2, 2, 3, 0.75, 1.3)} />
    </svg>
  );
}

interface ShapePickerProps<T extends string> {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  icon: (shape: T) => ReactNode;
}

export function ShapePicker<T extends string>({ label, options, labels, value, onChange, icon }: ShapePickerProps<T>) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-gray-600">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={`${label} : ${labels[option]}`}
              onClick={() => onChange(option)}
              className={`flex flex-col items-center gap-1 w-[72px] px-2 py-2 rounded-lg border text-[11px] ${
                selected
                  ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35] font-semibold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className={selected ? 'text-[#FF6B35]' : 'text-gray-800'}>{icon(option)}</span>
              {labels[option]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
