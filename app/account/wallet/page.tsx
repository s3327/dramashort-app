"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Coins,
  Crown,
  CreditCard,
  Gift,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import CoinPurchaseModal from "@/components/wallet/CoinPurchaseModal";
import DailyCheckInModal from "@/components/rewards/DailyCheckInModal";
import { useAuth } from "@/contexts/AuthContext";
import { useDailyReward } from "@/contexts/DailyRewardContext";
import {
  getClientWallet,
  getClientCoinTransactions,
} from "@/lib/services/wallet.service";
import type { WalletInfo, CoinTransaction, CoinTransactionType } from "@/types/wallet";

export default function AccountWalletPage() {
  const { user } = useAuth();
  const { openRewardModal, canCheckIn } = useDailyReward();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<string>("all");

  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

  const fetchWalletAndTransactions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [walletRes, txRes] = await Promise.all([
        getClientWallet(),
        getClientCoinTransactions({ page, pageSize: 15 }),
      ]);

      if (walletRes?.wallet) {
        setWallet(walletRes.wallet);
      }
      if (txRes) {
        setTransactions(txRes.items);
        setTotalPages(Math.max(1, txRes.totalPages));
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    fetchWalletAndTransactions();
  }, [fetchWalletAndTransactions]);

  const handlePurchaseSuccess = (newBalance: number, isVip?: boolean) => {
    setWallet((prev) =>
      prev
        ? {
            ...prev,
            balance: newBalance,
            isVip: isVip !== undefined ? isVip : prev.isVip,
          }
        : null
    );
    fetchWalletAndTransactions();
  };

  const handleBalanceUpdated = (newBalance: number) => {
    setWallet((prev) => (prev ? { ...prev, balance: newBalance } : null));
    fetchWalletAndTransactions();
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === "all") return true;
    if (filterType === "purchase") return tx.transactionType === "purchase";
    if (filterType === "unlock") return tx.transactionType === "episode_unlock";
    if (filterType === "rewards") {
      return (
        tx.transactionType === "daily_checkin" ||
        tx.transactionType === "streak_bonus" ||
        tx.transactionType === "referral" ||
        tx.transactionType === "admin_grant"
      );
    }
    return true;
  });

  const isVipActive =
    Boolean(wallet?.isVip) &&
    (!wallet?.vipExpiresAt || new Date(wallet.vipExpiresAt) > new Date());

  const formattedVipExpiry =
    wallet?.vipExpiresAt && isVipActive
      ? new Date(wallet.vipExpiresAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          {/* Sidebar Navigation */}
          <AccountSidebar />

          {/* Main Content Area */}
          <section className="flex-1 w-full space-y-6">
            {/* Page Header */}
            <div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-text">
                Wallet &amp; Coins
              </h1>
              <p className="text-xs sm:text-sm text-text-muted mt-1">
                Manage your drama coin balance, top up packages, track unlocks, and view transaction history.
              </p>
            </div>

            {/* Balance Overview Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coin Balance Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface to-surface-elevated border border-border p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Coin Balance
                    </span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <Coins size={32} className="text-amber-400 self-center" />
                      <span className="font-display font-black text-4xl text-text">
                        {isLoading ? "..." : wallet?.balance ?? 0}
                      </span>
                      <span className="text-xs font-bold text-text-muted">Coins</span>
                    </div>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Coins size={24} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 mt-6 pt-4 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsTopUpModalOpen(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <CreditCard size={15} />
                    <span>Top Up Coins</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openRewardModal();
                      setIsCheckInModalOpen(true);
                    }}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      canCheckIn
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        : "bg-surface-elevated border-border text-text hover:bg-surface"
                    }`}
                  >
                    <Gift size={15} className={canCheckIn ? "animate-pulse" : ""} />
                    <span>{canCheckIn ? "Claim Free" : "Check-in"}</span>
                  </button>
                </div>
              </div>

              {/* VIP Status Card */}
              <div
                className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm flex flex-col justify-between ${
                  isVipActive
                    ? "bg-gradient-to-br from-purple-900/20 via-surface to-purple-950/10 border-purple-500/40"
                    : "bg-surface border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Membership Status
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      {isVipActive ? (
                        <>
                          <Crown size={28} className="text-purple-400" />
                          <span className="font-display font-black text-2xl text-purple-300">
                            VIP Unlimited
                          </span>
                        </>
                      ) : (
                        <span className="font-display font-black text-2xl text-text">
                          Standard Member
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${
                      isVipActive
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-surface-elevated border-border text-text-muted"
                    }`}
                  >
                    <Crown size={24} />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/60">
                  {isVipActive ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Unlimited Episode Streaming</span>
                      <span className="font-bold text-purple-300 flex items-center gap-1">
                        <Clock size={13} />
                        Expires {formattedVipExpiry}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-text-muted">
                        Binge any episode with 0 coin cost
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsTopUpModalOpen(true)}
                        className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                      >
                        Get VIP Pass
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction Ledger Section */}
            <div className="rounded-2xl bg-surface border border-border p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-display font-bold text-lg text-text">
                    Transaction History
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Ledger of all coin purchases, episode unlocks, and daily streak rewards.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: "all", label: "All" },
                    { id: "purchase", label: "Purchases" },
                    { id: "unlock", label: "Unlocks" },
                    { id: "rewards", label: "Rewards" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setFilterType(filter.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        filterType === filter.id
                          ? "bg-primary text-primary-text font-bold"
                          : "bg-surface-elevated text-text-muted hover:text-text hover:bg-surface-elevated/80"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transactions Table / List */}
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="text-xs">Loading transactions...</span>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-12 text-center rounded-xl bg-surface-elevated/40 border border-border/40">
                  <Coins size={32} className="mx-auto text-text-muted/40 mb-2" />
                  <p className="text-sm font-bold text-text">No transactions found</p>
                  <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                    Transactions from coin purchases, episode unlocks, and rewards will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-muted font-bold uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Date</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Description</th>
                        <th className="pb-3 font-semibold text-right">Amount</th>
                        <th className="pb-3 font-semibold text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredTransactions.map((tx) => {
                        const isCredit = tx.amount > 0;
                        const isZero = tx.amount === 0;

                        return (
                          <tr key={tx.id} className="hover:bg-surface-elevated/40 transition-colors">
                            <td className="py-3 text-text-muted whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>

                            <td className="py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  tx.transactionType === "purchase"
                                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                    : tx.transactionType === "episode_unlock"
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {tx.transactionType === "purchase"
                                  ? "Purchase"
                                  : tx.transactionType === "episode_unlock"
                                  ? "Unlock"
                                  : "Reward"}
                              </span>
                            </td>

                            <td className="py-3 font-medium text-text max-w-xs truncate">
                              {tx.description}
                            </td>

                            <td className="py-3 text-right whitespace-nowrap font-bold">
                              {isZero ? (
                                <span className="text-text-muted">0</span>
                              ) : isCredit ? (
                                <span className="text-emerald-400 inline-flex items-center gap-0.5">
                                  <ArrowUpRight size={13} />
                                  +{tx.amount}
                                </span>
                              ) : (
                                <span className="text-red-400 inline-flex items-center gap-0.5">
                                  <ArrowDownLeft size={13} />
                                  {tx.amount}
                                </span>
                              )}
                            </td>

                            <td className="py-3 text-right whitespace-nowrap text-text-muted font-mono font-medium">
                              {tx.balanceAfter}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border text-xs">
                  <span className="text-text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg border border-border text-text hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded-lg border border-border text-text hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Support and Refund Policy Card */}
            <div className="rounded-2xl bg-surface-elevated/40 border border-border p-5 text-xs text-text-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <HelpCircle size={18} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-text">Questions about your coins or billing?</p>
                  <p className="mt-0.5 leading-relaxed">
                    Coins are credited instantly upon purchase. If you experience an issue or need assistance, our support team is available.
                  </p>
                </div>
              </div>

              <Link
                href="/contact?category=billing"
                className="px-3.5 py-2 rounded-xl border border-border text-text hover:bg-surface font-semibold shrink-0 transition-colors"
              >
                Contact Support
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Coin Purchase Modal */}
      <CoinPurchaseModal
        open={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        onSuccess={handlePurchaseSuccess}
      />

      {/* Daily Check-in Modal */}
      <DailyCheckInModal
        open={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        onBalanceUpdated={handleBalanceUpdated}
      />
    </div>
  );
}
