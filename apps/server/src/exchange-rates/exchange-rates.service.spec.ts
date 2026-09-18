import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExchangeRatesService, parseCbrDailyRates } from './exchange-rates.service';

const cbrResponse = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="18.09.2026" name="Foreign Currency Market">
  <Valute ID="R01235"><CharCode>USD</CharCode><Nominal>1</Nominal><Value>84,5093</Value><VunitRate>84,5093</VunitRate></Valute>
  <Valute ID="R01239"><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>99,3304</Value><VunitRate>99,3304</VunitRate></Valute>
  <Valute ID="R01375"><CharCode>CNY</CharCode><Nominal>10</Nominal><Value>118,7000</Value><VunitRate>11,8700</VunitRate></Valute>
</ValCurs>`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('parseCbrDailyRates', () => {
  it('reads unit rates and the effective date', () => {
    expect(parseCbrDailyRates(cbrResponse)).toEqual({
      effectiveDate: '2026-09-18',
      rates: { CNY: 11.87, EUR: 99.3304, RUB: 1, USD: 84.5093 },
    });
  });
});

describe('ExchangeRatesService', () => {
  it('caches a successful response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(cbrResponse, { headers: { 'Content-Type': 'application/xml' }, status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const service = new ExchangeRatesService();

    const first = await service.getRates();
    const second = await service.getRates();

    expect(first).toMatchObject({ effectiveDate: '2026-09-18', stale: false });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the last successful rates as stale when refresh fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T09:00:00.000Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(cbrResponse, { status: 200 }))
      .mockRejectedValueOnce(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new ExchangeRatesService();

    await service.getRates();
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);

    await expect(service.getRates()).resolves.toMatchObject({ stale: true });
  });

  it('returns 503 when no rates have ever been loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    const service = new ExchangeRatesService();

    await expect(service.getRates()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
