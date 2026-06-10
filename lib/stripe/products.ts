export type CreditPackKey = "credits_50" | "credits_100" | "credits_200";

export interface CreditPack {
  key: CreditPackKey;
  label: string;
  description: string;
  credits: number;
  priceId: string;
  envName: string;
}

export interface PublicBillingOption {
  key: string;
  label: string;
  description: string;
  credits: number;
  enabled: boolean;
  setupError: string | null;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    key: "credits_50",
    label: "50 Credits",
    description: "Good for a few active projects.",
    credits: 50,
    priceId: process.env.STRIPE_CREDITS_50_PRICE_ID ?? "",
    envName: "STRIPE_CREDITS_50_PRICE_ID",
  },
  {
    key: "credits_100",
    label: "100 Credits",
    description: "Best for regular client work.",
    credits: 100,
    priceId: process.env.STRIPE_CREDITS_100_PRICE_ID ?? "",
    envName: "STRIPE_CREDITS_100_PRICE_ID",
  },
  {
    key: "credits_200",
    label: "200 Credits",
    description: "Best for busy freelancers and agencies.",
    credits: 200,
    priceId: process.env.STRIPE_CREDITS_200_PRICE_ID ?? "",
    envName: "STRIPE_CREDITS_200_PRICE_ID",
  },
];

export function isStripePriceId(value: string) {
  return /^price_[A-Za-z0-9]{8,}$/.test(value);
}

export function priceSetupError(option: {
  label: string;
  priceId: string;
  envName: string;
}) {
  if (!option.priceId) {
    return `${option.envName} is missing.`;
  }

  if (!isStripePriceId(option.priceId)) {
    return `${option.envName} must be the full Stripe Price ID that starts with price_, not a numeric amount or shortened value.`;
  }

  return null;
}

export function assertConfiguredPrice(option: {
  label: string;
  priceId: string;
  envName: string;
}) {
  const error = priceSetupError(option);

  if (error) {
    throw new Error(error);
  }
}

export function getCreditPack(key: string) {
  return CREDIT_PACKS.find((pack) => pack.key === key) ?? null;
}

export function getCreditPackByPriceId(priceId: string) {
  return CREDIT_PACKS.find((pack) => pack.priceId === priceId) ?? null;
}

export function publicBillingOptions() {
  return {
    creditPacks: CREDIT_PACKS.map(
      ({ key, label, description, credits, priceId, envName }) => {
        const setupError = priceSetupError({ label, priceId, envName });

        return {
          key,
          label,
          description,
          credits,
          enabled: setupError === null,
          setupError,
        } satisfies PublicBillingOption;
      },
    ),
  };
}
