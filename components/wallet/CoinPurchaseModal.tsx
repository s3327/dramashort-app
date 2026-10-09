"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Coins,
  Sparkles,
  Crown,
  Check,
  Loader2,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import {
  COIN_PACKAGES,
  createCheckoutSessionClient,
} from "@/lib/services/wallet.service";
import type { CoinPackage, CoinPackageId } from "@/types/wallet";

export interface CoinPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number, isVip?: boolean) => void;
}

export default function CoinPurchaseModal({
  open,
  onClose,
  onSuccess,
}: CoinPurchaseModalProps) {
  const { user } = useAuth();
  const [selectedPackageId, setSelectedPackageId] = useState<CoinPackageId>("coins_popular_350");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedPackage =
    COIN_PACKAGES.find((pkg) => pkg.id === selectedPackageId) || COIN_PACKAGES[1];

  const handlePurchase = async () => {
    if (!user || isProcessing) return;
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const res = await createCheckoutSessionClient({
        packageId: selectedPackageId,
      });

      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }

      if (res.success) {
        const newBal = res.newBalance ?? 0;
        const isVip = Boolean(res.isVip);

        setSuccessMessage(
          selectedPackage.isVipPass
            ? "VIP Weekly Pass activated! Unlimited streaming unlocked."
            : `Successfully purchased ${selectedPackage.name}! +${selectedPackage.totalCoins} Coins added.`
        );

        if (onSuccess) {
          onSuccess(newBal, isVip);
        }

        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 2200);
      } else {
        setErrorMessage(
          res.error || "Purchases are temporarily unavailable. Please check back later."
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during checkout.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full text-center">
        {/* Header Icon */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm">
          <Coins size={28} className="animate-bounce" />
        </div>

        <h2 className="font-display font-extrabold text-xl text-text mb-1">
          Top Up Drama Coins
        </h2>
        <p className="text-xs text-text-muted mb-5 max-w-sm mx-auto">
          Unlock premium episodes instantly or enjoy 7 days of unlimited VIP streaming.
        </p>

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in"
          >
            <Sparkles size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center justify-center gap-2"
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 text-left">
          {COIN_PACKAGES.map((pkg) => {
            const isSelected = pkg.id === selectedPackageId;

            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`relative p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? pkg.isVipPass
                      ? "bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30 shadow-md"
                      : "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-md"
                    : "bg-surface hover:bg-surface-elevated border-border hover:border-border-hover"
                }`}
              >
                {/* Badge if available */}
                {pkg.badge && (
                  <span
                    className={`absolute -top-2 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm ${
                      pkg.isVipPass
                        ? "bg-purple-600 text-white"
                        : pkg.bestValue
                        ? "bg-amber-500 text-black"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {pkg.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-text">{pkg.name}</span>
                    <span
                      className={`text-sm font-extrabold ${
                        pkg.isVipPass ? "text-purple-400" : "text-amber-400"
                      }`}
                    >
                      {pkg.formattedPrice}
                    </span>
                  </div>

                  {pkg.isVipPass ? (
                    <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold my-1">
                      <Crown size={15} />
                      <span>7 Days Unlimited VIP</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1.5 my-1">
                      <span className="text-base font-black text-text flex items-center gap-1">
                        <Coins size={15} className="text-amber-400" />
                        {pkg.totalCoins}
                      </span>
                      {pkg.bonusCoins > 0 && (
                        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                          +{pkg.bonusCoins} Bonus
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
                    {pkg.description}
                  </p>
                </div>

                {/* Selection Radio Dot */}
                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">
                    {pkg.isVipPass ? "Instant VIP Pass" : `${pkg.totalCoins / 10} Episodes`}
                  </span>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? pkg.isVipPass
                          ? "border-purple-500 bg-purple-500 text-white"
                          : "border-amber-500 bg-amber-500 text-black"
                        : "border-border"
                    }`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-text-muted mb-5">
          <div className="flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Secure 256-bit Checkout</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap size={13} className="text-amber-400" />
            <span>Instant Coin Delivery</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2.5">
          {!user ? (
            <Link
              href="/login"
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard size={16} />
              <span>Sign In to Purchase Coins</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handlePurchase}
              disabled={isProcessing}
              className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                selectedPackage.isVipPass
                  ? "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-purple-600/20"
                  : "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-amber-500/20"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  <span>
                    Get {selectedPackage.name} for {selectedPackage.formattedPrice}
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-border text-text hover:bg-surface font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
