// Sélecteur de fiche Twenty : recherche après 400 ms, badges, choix au clavier ou à la souris,
// retrait, case d'accord photo (seulement si la photo est validée, jamais cochée d'avance),
// lien vers la photo sans image, CRM indisponible.
import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InvitationPrefillSummary, TwentyCompanyPicker } from '@/components/restaurants/TwentyCompanyPicker';
import { searchTwentyCompaniesAction } from '@/lib/actions/invitations';
import {
  PREFILL_NOT_APPLIED_MESSAGE,
  TWENTY_UNAVAILABLE_MESSAGE,
  type TwentyCompany,
} from '@/lib/utils/twentyPrefill';

jest.mock('@/lib/actions/invitations', () => ({ searchTwentyCompaniesAction: jest.fn() }));
const search = searchTwentyCompaniesAction as jest.Mock;

const hygge: TwentyCompany = {
  id: 'c1', name: 'Hygge', city: 'Rouen', sirenValidated: true, photoValidated: true,
  photoLabel: 'Google Maps - devanture (1600x1200)', photoUrl: 'https://lh3.googleusercontent.com/p/x',
};
const bistro: TwentyCompany = {
  id: 'c2', name: 'Bistro', city: null, sirenValidated: true, photoValidated: false, photoLabel: null, photoUrl: null,
};

let latest: { company: TwentyCompany | null; consent: boolean } = { company: null, consent: false };

function Harness() {
  const [company, setCompany] = useState<TwentyCompany | null>(null);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    latest = { company, consent };
  }, [company, consent]);
  return (
    <TwentyCompanyPicker value={company} onChange={setCompany} photoConsent={consent} onPhotoConsentChange={setConsent} />
  );
}

const input = () => screen.getByLabelText('Fiche Twenty (facultatif)');

async function typeAndWait(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => { jest.advanceTimersByTime(400); });
}

beforeEach(() => {
  jest.useFakeTimers();
  search.mockReset();
  latest = { company: null, consent: false };
});
afterEach(() => jest.useRealTimers());

it('recherche après 400 ms de pause, une seule fois, et affiche nom, ville et badges', async () => {
  search.mockResolvedValue({ ok: true, companies: [hygge, bistro] });
  render(<Harness />);
  fireEvent.change(input(), { target: { value: 'Hy' } });
  act(() => { jest.advanceTimersByTime(200); });
  fireEvent.change(input(), { target: { value: 'Hyg' } });
  act(() => { jest.advanceTimersByTime(399); });
  expect(search).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith('Hyg');

  const options = await screen.findAllByRole('option');
  expect(options).toHaveLength(2);
  expect(options[0].textContent).toContain('Hygge');
  expect(options[0].textContent).toContain('Rouen');
  expect(options[0].textContent).toContain('SIREN validé');
  expect(options[0].textContent).toContain('Photo validée');
  expect(options[1].textContent).toContain('SIREN validé');
  expect(options[1].textContent).not.toContain('Photo validée');
});

it('moins de 2 caractères : aucune recherche', async () => {
  render(<Harness />);
  await typeAndWait(' H ');
  expect(search).not.toHaveBeenCalled();
});

it('au clavier : flèches puis Entrée choisissent la fiche sans valider le formulaire', async () => {
  search.mockResolvedValue({ ok: true, companies: [hygge, bistro] });
  const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
  render(<form onSubmit={onSubmit}><Harness /></form>);
  await typeAndWait('Hyg');
  await screen.findAllByRole('option');
  expect(input().getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(input(), { key: 'ArrowDown' });
  expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
  expect(input().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(latest.company).toEqual(bistro);
  expect(screen.getByText('Bistro')).toBeTruthy();
});

it('photo validée : lien « Voir la photo » sans image, case non cochée par défaut', async () => {
  search.mockResolvedValue({ ok: true, companies: [hygge] });
  const { container } = render(<Harness />);
  await typeAndWait('Hyg');
  fireEvent.click((await screen.findAllByRole('option'))[0]);

  expect(latest.company).toEqual(hygge);
  const link = screen.getByRole('link', { name: /Voir la photo/ });
  expect(link.getAttribute('href')).toBe(hygge.photoUrl);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(container.querySelector('img')).toBeNull();

  const box = screen.getByLabelText(/Le restaurateur accepte que TheResto utilise cette photo/) as HTMLInputElement;
  expect(box.checked).toBe(false);
  fireEvent.click(box);
  expect(latest.consent).toBe(true);
});

it('photo non validée : ni lien ni case', async () => {
  search.mockResolvedValue({ ok: true, companies: [bistro] });
  render(<Harness />);
  await typeAndWait('Bis');
  fireEvent.click((await screen.findAllByRole('option'))[0]);
  expect(screen.queryByRole('link', { name: /Voir la photo/ })).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('« Retirer » : fiche et accord effacés, retour à la recherche', async () => {
  search.mockResolvedValue({ ok: true, companies: [hygge] });
  render(<Harness />);
  await typeAndWait('Hyg');
  fireEvent.click((await screen.findAllByRole('option'))[0]);
  fireEvent.click(screen.getByLabelText(/Le restaurateur accepte/));
  expect(latest.consent).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: /Retirer/ }));
  expect(latest).toEqual({ company: null, consent: false });
  expect((input() as HTMLInputElement).value).toBe('');
});

it('changer de fiche remet l accord à non', async () => {
  search.mockResolvedValue({ ok: true, companies: [hygge] });
  render(<Harness />);
  await typeAndWait('Hyg');
  fireEvent.click((await screen.findAllByRole('option'))[0]);
  fireEvent.click(screen.getByLabelText(/Le restaurateur accepte/));
  fireEvent.click(screen.getByRole('button', { name: /Retirer/ }));
  await typeAndWait('Hyg');
  fireEvent.click((await screen.findAllByRole('option'))[0]);
  expect((screen.getByLabelText(/Le restaurateur accepte/) as HTMLInputElement).checked).toBe(false);
});

it('CRM Twenty indisponible : message dans le sélecteur, aucune fiche', async () => {
  search.mockResolvedValue({ ok: false, code: 'twenty-unavailable', error: TWENTY_UNAVAILABLE_MESSAGE });
  render(<Harness />);
  await typeAndWait('Hyg');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(TWENTY_UNAVAILABLE_MESSAGE));
  expect(screen.queryAllByRole('option')).toHaveLength(0);
});

it('aucun résultat : message', async () => {
  search.mockResolvedValue({ ok: true, companies: [] });
  render(<Harness />);
  await typeAndWait('Zzz');
  expect(await screen.findByText('Aucune fiche trouvée.')).toBeTruthy();
});

it('une réponse plus ancienne n écrase pas la dernière', async () => {
  let resolveFirst: (v: unknown) => void = () => {};
  search
    .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
    .mockResolvedValueOnce({ ok: true, companies: [bistro] });
  render(<Harness />);
  await typeAndWait('Hyg');
  await typeAndWait('Bis');
  await screen.findAllByRole('option');
  await act(async () => { resolveFirst({ ok: true, companies: [hygge] }); });
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(1);
  expect(options[0].textContent).toContain('Bistro');
});

describe('InvitationPrefillSummary', () => {
  beforeEach(() => jest.useRealTimers());

  it('sans fiche demandée : rien', () => {
    const { container } = render(<InvitationPrefillSummary prefill={null} requested={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('fiche demandée, réponse sans préremplissage : fonction pas à jour', () => {
    render(<InvitationPrefillSummary prefill={null} requested />);
    expect(screen.getByRole('status').textContent).toBe(PREFILL_NOT_APPLIED_MESSAGE);
  });

  it('résultat traduit', () => {
    render(<InvitationPrefillSummary prefill={{ siren: true, photo: 'too-small' }} requested />);
    const list = screen.getByRole('list', { name: 'Préremplissage' });
    expect(list.textContent).toContain('SIREN prérempli');
    expect(list.textContent).toContain('Photo non préremplie : image trop petite (800 × 600 minimum)');
  });
});
