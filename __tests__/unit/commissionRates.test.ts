import {
  INVOICE_STATUS_LABELS,
  formatEuro,
  formatPeriod,
  isEssentielPlan,
  parseEuroInput,
  parseMonthsInput,
} from '@/lib/utils/commissionRates';

describe('parseEuroInput', () => {
  it('accepte la virgule et le point', () => {
    expect(parseEuroInput('0,25')).toBe(0.25);
    expect(parseEuroInput('1.5')).toBe(1.5);
    expect(parseEuroInput(' 2 ')).toBe(2);
  });

  it('refuse les valeurs invalides', () => {
    expect(parseEuroInput('')).toBeNull();
    expect(parseEuroInput('abc')).toBeNull();
    expect(parseEuroInput('-1')).toBeNull();
    expect(parseEuroInput('100.01')).toBeNull();
    expect(parseEuroInput('0,255')).toBeNull();
  });

  it('refuse les écritures que le serveur refuse', () => {
    expect(parseEuroInput('1e1')).toBeNull();
    expect(parseEuroInput('0x10')).toBeNull();
    expect(parseEuroInput('.5')).toBeNull();
    expect(parseEuroInput('+1')).toBeNull();
  });

  it('respecte le maximum fourni', () => {
    expect(parseEuroInput('500', 1000)).toBe(500);
    expect(parseEuroInput('500')).toBeNull();
  });
});

describe('parseMonthsInput', () => {
  it('accepte un entier entre 0 et 12', () => {
    expect(parseMonthsInput('0')).toBe(0);
    expect(parseMonthsInput('3')).toBe(3);
    expect(parseMonthsInput('12')).toBe(12);
  });

  it('refuse le reste', () => {
    expect(parseMonthsInput('')).toBeNull();
    expect(parseMonthsInput('1.5')).toBeNull();
    expect(parseMonthsInput('13')).toBeNull();
    expect(parseMonthsInput('1e1')).toBeNull();
  });
});

describe('formatage', () => {
  it('formatEuro', () => {
    expect(formatEuro(0.25)).toMatch(/^0,25\s€$/);
    expect(formatEuro(1)).toMatch(/^1,00\s€$/);
  });

  it('formatPeriod', () => {
    expect(formatPeriod('2026-10-01')).toBe('octobre 2026');
  });

  it('libellés des statuts de facture', () => {
    expect(INVOICE_STATUS_LABELS.draft).toBe('En préparation');
    expect(INVOICE_STATUS_LABELS.open).toBe('En attente de paiement');
  });
});

describe('isEssentielPlan', () => {
  it('suit public.plan_rank : tout plan non payant est Essentiel', () => {
    expect(isEssentielPlan('essentiel')).toBe(true);
    expect(isEssentielPlan('free')).toBe(true);
    expect(isEssentielPlan(null)).toBe(true);
    expect(isEssentielPlan('Croissance')).toBe(false);
    expect(isEssentielPlan('liberte')).toBe(false);
    expect(isEssentielPlan('premium')).toBe(false);
  });
});
