import type { CoinPackage, CoinPackageId } from "@/types/wallet";

/**
 * Standard coin packages and VIP passes available in DramaShort.
 * Phase 8 Monetization Engine.
 */
export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: "coins_starter_100",
    name: "Pocket Starter",
    coins: 100,
    bonusCoins: 0,
    totalCoins: 100,
    priceUsd: 0.99,
    formattedPrice: "$0.99",
    description: "10 episode unlocks to kickstart your drama binge.",
  },
  {
    id: "coins_popular_350",
    name: "Popular Pack",
    coins: 300,
    bonusCoins: 50,
    totalCoins: 350,
    priceUsd: 2.99,
    formattedPrice: "$2.99",
    popular: true,
    badge: "Most Popular",
    description: "35 episodes with 50 bonus coins included.",
  },
  {
    id: "coins_binge_800",
    name: "Drama Binge",
    coins: 600,
    bonusCoins: 200,
    totalCoins: 800,
    priceUsd: 5.99,
    formattedPrice: "$5.99",
    bestValue: true,
    badge: "Best Value",
    description: "80 episodes with 200 bonus coins for serious drama lovers.",
  },
  {
    id: "vip_weekly_pass",
    name: "VIP Weekly Pass",
    coins: 0,
    bonusCoins: 0,
    totalCoins: 0,
    priceUsd: 9.99,
    formattedPrice: "$9.99",
    isVipPass: true,
    vipDays: 7,
    badge: "Unlimited",
    description: "7 days of unlimited access to all locked episodes across the platform.",
  },
];

/**
 * Retrieves a coin package by its canonical ID.
 */
export function getCoinPackageById(packageId: string): CoinPackage | undefined {
  return COIN_PACKAGES.find((pkg) => pkg.id === packageId);
}

/**
 * Validates whether an ID matches a known coin package.
 */
export function isValidCoinPackageId(packageId: string): packageId is CoinPackageId {
  return COIN_PACKAGES.some((pkg) => pkg.id === packageId);
}
