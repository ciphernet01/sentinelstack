export type PricingCurrency = 'USD' | 'INR';
export type BillingPeriod = 'monthly' | 'yearly';

export const PRICING = {
  USD: {
    FREE: {
      monthly: 0,
      yearly: 0,
    },
    PRO: {
      monthly: 99,
      yearly: 990, // 2 months free
    },
  },
  INR: {
    FREE: {
      monthly: 0,
      yearly: 0,
    },
    PRO: {
      monthly: 2999,
      yearly: 29990, // 2 months free (monthly * 10)
      launchMonthly: 1999,
    },
  },
} as const;

export function formatMoney(amount: number, currency: PricingCurrency): string {
  return currency === 'USD' ? `$${amount}` : `₹${amount}`;
}

export function inferCurrencyFromTimezone(): PricingCurrency {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Kolkata' ? 'INR' : 'USD';
  } catch {
    return 'USD';
  }
}

export function getProPrice(params: {
  currency: PricingCurrency;
  billingPeriod: BillingPeriod;
  showLaunchOffer?: boolean;
}): { display: string; billedLine: string; alsoLine?: string } {
  const { currency, billingPeriod } = params;

  const showLaunchOffer = Boolean(params.showLaunchOffer) && currency === 'INR' && billingPeriod === 'monthly';

  if (currency === 'INR') {
    if (billingPeriod === 'monthly') {
      const launch = PRICING.INR.PRO.launchMonthly;
      const normal = PRICING.INR.PRO.monthly;
      const display = formatMoney(showLaunchOffer ? launch : normal, 'INR');
      const billedLine = showLaunchOffer ? `Normally ${formatMoney(normal, 'INR')}/month` : '';
      const alsoLine = `Also: ${formatMoney(PRICING.USD.PRO.monthly, 'USD')}/month`;
      return { display, billedLine, alsoLine };
    }

    const yearly = PRICING.INR.PRO.yearly;
    const perMonth = Math.round(yearly / 12);
    return {
      display: formatMoney(perMonth, 'INR'),
      billedLine: `Billed ${formatMoney(yearly, 'INR')}/year`,
      alsoLine: `Also: Billed ${formatMoney(PRICING.USD.PRO.yearly, 'USD')}/year`,
    };
  }

  // USD
  if (billingPeriod === 'monthly') {
    return {
      display: formatMoney(PRICING.USD.PRO.monthly, 'USD'),
      billedLine: '',
      alsoLine: `Also: ${formatMoney(PRICING.INR.PRO.launchMonthly, 'INR')}/month launch (then ${formatMoney(PRICING.INR.PRO.monthly, 'INR')}/month)`,
    };
  }

  const yearly = PRICING.USD.PRO.yearly;
  const perMonth = Math.round(yearly / 12);
  return {
    display: formatMoney(perMonth, 'USD'),
    billedLine: `Billed ${formatMoney(yearly, 'USD')}/year`,
    alsoLine: `Also: Billed ${formatMoney(PRICING.INR.PRO.yearly, 'INR')}/year`,
  };
}
