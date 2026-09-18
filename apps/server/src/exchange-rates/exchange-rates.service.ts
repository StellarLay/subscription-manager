import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ExchangeRatesResponseDto } from './dto/exchange-rates-response.dto';

const CBR_DAILY_RATES_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

interface CachedRates {
  effectiveDate: string;
  fetchedAt: string;
  fetchedAtTimestamp: number;
  rates: Record<string, number>;
}

function readTag(block: string, tag: string): string | null {
  return new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(block)?.[1]?.trim() ?? null;
}

function parseEffectiveDate(xml: string): string {
  const match = /<ValCurs[^>]*Date="(\d{2})\.(\d{2})\.(\d{4})"/.exec(xml);

  if (!match) throw new Error('CBR response does not contain an effective date');

  const [, day, month, year] = match;

  return `${year}-${month}-${day}`;
}

export function parseCbrDailyRates(xml: string): Pick<CachedRates, 'effectiveDate' | 'rates'> {
  const rates: Record<string, number> = { RUB: 1 };

  for (const match of xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g)) {
    const block = match[1];
    if (!block) continue;

    const currency = readTag(block, 'CharCode');
    const rawUnitRate = readTag(block, 'VunitRate');

    if (!currency || !rawUnitRate) continue;

    const unitRate = Number(rawUnitRate.replace(',', '.'));
    if (Number.isFinite(unitRate) && unitRate > 0) rates[currency] = unitRate;
  }

  if (!rates.USD || !rates.EUR) {
    throw new Error('CBR response does not contain required currencies');
  }

  return { effectiveDate: parseEffectiveDate(xml), rates };
}

@Injectable()
export class ExchangeRatesService {
  private cache: CachedRates | null = null;
  private refreshPromise: Promise<CachedRates> | null = null;

  async getRates(): Promise<ExchangeRatesResponseDto> {
    const now = Date.now();

    if (this.cache && now - this.cache.fetchedAtTimestamp < CACHE_TTL_MS) {
      return this.toResponse(this.cache, false);
    }

    try {
      this.refreshPromise ??= this.fetchRates();
      const rates = await this.refreshPromise;
      this.cache = rates;

      return this.toResponse(rates, false);
    } catch {
      if (this.cache) return this.toResponse(this.cache, true);

      throw new ServiceUnavailableException('Exchange rates are temporarily unavailable');
    } finally {
      this.refreshPromise = null;
    }
  }

  private async fetchRates(): Promise<CachedRates> {
    const response = await fetch(CBR_DAILY_RATES_URL, {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`CBR responded with ${response.status}`);

    const parsed = parseCbrDailyRates(await response.text());
    const fetchedAtTimestamp = Date.now();

    return {
      ...parsed,
      fetchedAt: new Date(fetchedAtTimestamp).toISOString(),
      fetchedAtTimestamp,
    };
  }

  private toResponse(rates: CachedRates, stale: boolean): ExchangeRatesResponseDto {
    return {
      baseCurrency: 'RUB',
      effectiveDate: rates.effectiveDate,
      fetchedAt: rates.fetchedAt,
      rates: rates.rates,
      source: 'CBR',
      stale,
    };
  }
}
