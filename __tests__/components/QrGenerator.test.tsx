import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QrGenerator } from '@/components/links/QrGenerator';
import type { ShortLink } from '@/lib/types/shortLinks';
import { TextDecoder, TextEncoder } from 'util';

// jsdom n'a pas TextEncoder (utilisé par qrcode).
Object.assign(globalThis, { TextEncoder, TextDecoder });

const LOGO = fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8');
const mutate = jest.fn();

jest.mock('@/lib/hooks/useShortLinks', () => ({
  useQrLogo: () => ({ data: undefined, isPending: false, isError: false, error: null }),
  useSaveQrStyle: () => ({ mutate, isPending: false }),
}));
jest.mock('@/lib/links/browserFiles', () => ({
  ...jest.requireActual('@/lib/links/browserFiles'),
  loadQrLogoSvg: () => Promise.resolve(LOGO),
}));

const link: ShortLink = {
  id: '11111111-2222-4333-8444-555555555555', slug: 'flyer-lyon', label: null, kind: 'web',
  targetDefault: 'https://app.theresto.fr/', targetIos: null, targetAndroid: null, forwardParams: 'none',
  src: null, ville: null, persona: null, campaign: null, acceptsQueryAttributes: false, active: true,
  expiresAt: null, qrStyle: null, createdAt: '2026-11-27T10:00:00Z', updatedAt: '2026-11-27T10:00:00Z',
};

const previewSrc = () => (screen.getByTestId('qr-preview') as HTMLImageElement).getAttribute('src');
const NOTE = /Combinaison moins bien lue par certains lecteurs/;

describe('QrGenerator', () => {
  beforeEach(() => mutate.mockReset());

  it('choisir une forme change l aperçu et active « Enregistrer le style »', async () => {
    render(<QrGenerator link={link} domain="go.theresto.fr" defaultTitle="TheResto" />);
    await waitFor(() => expect(screen.getByTestId('qr-preview')).toBeInTheDocument());
    const save = screen.getByRole('button', { name: /Enregistrer le style/ });
    expect(save).toBeDisabled();
    expect(screen.queryByText('Modifications non enregistrées')).not.toBeInTheDocument();
    const before = previewSrc();

    fireEvent.click(screen.getByRole('button', { name: 'Petits carrés : Points' }));

    expect(previewSrc()).not.toBe(before);
    expect(save).toBeEnabled();
    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument();
    fireEvent.click(save);
    expect(mutate).toHaveBeenCalledWith(
      { link, draft: { style: expect.objectContaining({ v: 1, modules: 'dots', logo: 'theresto' }) } },
      expect.anything(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Revenir au style enregistré/ }));
    expect(previewSrc()).toBe(before);
    expect(save).toBeDisabled();
  });

  it('note de lecture quand le cadre et le point des coins diffèrent', async () => {
    render(<QrGenerator link={link} domain="go.theresto.fr" defaultTitle="TheResto" />);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cadre des coins : Rond' }));
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Point des coins : Rond' }));
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});
