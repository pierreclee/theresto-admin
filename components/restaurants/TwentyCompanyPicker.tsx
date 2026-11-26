'use client';

// Choix facultatif d'une fiche Twenty pour préremplir l'invitation (SIREN validé, photo
// validée). La photo n'est jamais affichée ici (la CSP bloque son hôte) : seulement un lien
// vers elle. Elle n'est reprise que si la case d'accord du restaurateur est cochée.

import { useEffect, useId, useRef, useState } from 'react';
import { Building2, CheckCircle2, ExternalLink, Loader2, X, XCircle } from 'lucide-react';
import { searchTwentyCompaniesAction } from '@/lib/actions/invitations';
import {
  normalizeTwentyQuery,
  prefillLines,
  PREFILL_NOT_APPLIED_MESSAGE,
  TWENTY_SEARCH_DELAY_MS,
  type InvitationPrefillResult,
  type TwentyCompany,
} from '@/lib/utils/twentyPrefill';

interface PickerProps {
  value: TwentyCompany | null;
  onChange: (company: TwentyCompany | null) => void;
  photoConsent: boolean;
  onPhotoConsentChange: (consent: boolean) => void;
  disabled?: boolean;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-md">
      <CheckCircle2 size={10} />
      {children}
    </span>
  );
}

function CompanyBadges({ company }: { company: TwentyCompany }) {
  if (!company.sirenValidated && !company.photoValidated) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {company.sirenValidated && <Badge>SIREN validé</Badge>}
      {company.photoValidated && <Badge>Photo validée</Badge>}
    </span>
  );
}

export function TwentyCompanyPicker({ value, onChange, photoConsent, onPhotoConsentChange, disabled }: PickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TwentyCompany[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Seule la dernière recherche lancée est affichée (une réponse plus lente arrive après).
  const lastRequest = useRef(0);
  const inputId = useId();
  const listId = useId();
  const consentId = useId();

  useEffect(() => {
    if (value) return;
    const q = normalizeTwentyQuery(query);
    // Invalide toute recherche en cours ; une requête trop courte est remise à zéro par onChange.
    const request = ++lastRequest.current;
    if (!q) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchTwentyCompaniesAction(q);
        if (request !== lastRequest.current) return;
        if (result.ok) {
          setResults(result.companies);
          setError('');
          setActive(result.companies.length > 0 ? 0 : -1);
        } else {
          setResults([]);
          setError(result.error);
        }
        setSearched(true);
        setOpen(true);
      } catch {
        if (request !== lastRequest.current) return;
        setResults([]);
        setError('La recherche dans Twenty a échoué. Vous pouvez inviter sans fiche.');
        setSearched(true);
      } finally {
        if (request === lastRequest.current) setLoading(false);
      }
    }, TWENTY_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, value]);

  const select = (company: TwentyCompany) => {
    onChange(company);
    onPhotoConsentChange(false);
    setOpen(false);
    setActive(-1);
  };

  const clear = () => {
    onChange(null);
    onPhotoConsentChange(false);
    setQuery('');
    setResults([]);
    setSearched(false);
    setError('');
  };

  const listVisible = open && searched && !error && !value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listVisible || results.length === 0) {
      if (e.key === 'Enter' && normalizeTwentyQuery(query)) e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Ne valide pas le formulaire de l'invitation : choisit la fiche en surbrillance.
      e.preventDefault();
      if (active >= 0 && results[active]) select(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  if (value) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fiche Twenty (facultatif)</p>
        <div className="flex items-start gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
          <Building2 size={14} className="shrink-0 mt-0.5 text-[#FF6B35]" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {value.name}
              {value.city && <span className="font-normal text-gray-500"> · {value.city}</span>}
            </p>
            <CompanyBadges company={value} />
            {!value.sirenValidated && !value.photoValidated && (
              <p className="text-xs text-gray-500">Ni SIREN ni photo validés : rien ne sera prérempli.</p>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            <X size={12} />
            Retirer
          </button>
        </div>

        {value.photoValidated && (
          <div className="space-y-2">
            {value.photoUrl && (
              <a
                href={value.photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6B35] hover:underline"
              >
                <ExternalLink size={12} />
                Voir la photo
                {value.photoLabel && <span className="font-normal text-gray-500"> ({value.photoLabel})</span>}
              </a>
            )}
            <div className="flex items-start gap-2">
              <input
                id={consentId}
                type="checkbox"
                checked={photoConsent}
                disabled={disabled}
                onChange={(e) => onPhotoConsentChange(e.target.checked)}
                className="mt-0.5 accent-[#FF6B35]"
              />
              <label htmlFor={consentId} className="text-xs text-gray-600">
                Le restaurateur accepte que TheResto utilise cette photo pour la fiche de son restaurant
              </label>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Fiche Twenty (facultatif)
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listVisible}
          aria-controls={listId}
          aria-activedescendant={listVisible && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          maxLength={80}
          disabled={disabled}
          placeholder="Nom du restaurant dans Twenty"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!normalizeTwentyQuery(e.target.value)) {
              setResults([]);
              setSearched(false);
              setLoading(false);
              setError('');
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
        />
        {loading && (
          <Loader2
            size={14}
            aria-label="Recherche en cours"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {listVisible && results.length === 0 && (
        <p className="text-xs text-gray-500">Aucune fiche trouvée.</p>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label="Fiches Twenty"
        hidden={!listVisible || results.length === 0}
        className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100"
      >
        {results.map((company, i) => (
          <li
            key={company.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(company)}
            onMouseEnter={() => setActive(i)}
            className={`px-3 py-2 cursor-pointer space-y-1 ${i === active ? 'bg-[#FF6B35]/10' : 'hover:bg-gray-50'}`}
          >
            <p className="text-sm text-gray-900">
              {company.name}
              {company.city && <span className="text-gray-500"> · {company.city}</span>}
            </p>
            <CompanyBadges company={company} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Résultat du préremplissage, après la création de l'invitation. [requested] : une fiche avait
 * été choisie (une réponse sans préremplissage veut alors dire que la fonction n'est pas à jour).
 */
export function InvitationPrefillSummary({
  prefill,
  requested,
}: {
  prefill: InvitationPrefillResult | null | undefined;
  requested: boolean;
}) {
  if (!requested) return null;
  if (!prefill) {
    return (
      <p role="status" className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        {PREFILL_NOT_APPLIED_MESSAGE}
      </p>
    );
  }
  return (
    <ul aria-label="Préremplissage" className="space-y-1 text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
      {prefillLines(prefill).map((line) => (
        <li key={line.text} className={`flex items-start gap-1.5 ${line.ok ? 'text-green-700' : 'text-gray-600'}`}>
          {line.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <XCircle size={13} className="shrink-0 mt-0.5 text-gray-400" />}
          {line.text}
        </li>
      ))}
      <li className="text-gray-400">Le restaurateur pourra les modifier.</li>
    </ul>
  );
}
