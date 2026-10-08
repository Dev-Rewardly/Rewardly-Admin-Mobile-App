// lib/api/coalition.ts
// Which coalition this admin is working in: its name, region and currency.
//
// Read the way the portal's /api/coalition route reads it (2026-10-08):
// coalition-info by the token's own coalition_id, and -- only when that has no
// name yet, as for a coalition not yet verified -- the authenticated
// /settings/coalition.
//
// The coalition_id always comes from the admin's token, never from anything
// the app chose: an admin is shown their own coalition or nothing.

import { API } from '../../constants/api';
import { apiFetch } from './client';

export interface Coalition {
  id: string;
  /** null when the service has no name for it yet. Never invented. */
  name: string | null;
  region: string | null;
  /** ISO 4217, e.g. "USD". null when the service did not say. */
  currency: string | null;
}

interface CoalitionInfoBody {
  coalition_id?: string;
  coalition_name?: string | null;
  organization_name?: string | null;
  region?: string | null;
  currency?: string | null;
}

export async function getCoalition(
  getAccessToken: () => Promise<string | null>,
  coalitionId: string,
): Promise<Coalition> {
  const info = await apiFetch<CoalitionInfoBody>(API.coalitionInfo(coalitionId), { getAccessToken });

  let name = text(info.coalition_name) ?? text(info.organization_name);
  if (!name) {
    try {
      const settings = await apiFetch<{ name?: string | null }>(API.settingsCoalition, { getAccessToken });
      name = text(settings.name);
    } catch {
      // The name is a nicety; without it the header shows the Admin marker alone.
    }
  }

  return {
    id: text(info.coalition_id) ?? coalitionId,
    name,
    region: text(info.region),
    currency: text(info.currency)?.toUpperCase() ?? null,
  };
}

/**
 * An amount in its currency, in the reader's locale: 17.91 + "USD" → "$17.91".
 *
 * With no currency the bare number is shown rather than a guessed symbol -- a
 * wrong currency is worse than none.
 */
export function formatAmount(amount: number, currency: string | null, locale?: string): string {
  if (!currency) return String(amount);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    // An unknown code, or a runtime without currency formatting.
    return `${currency} ${amount}`;
  }
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
