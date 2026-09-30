"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { faqItems } from "@/data/faq.mock";
import { useTheme } from "@/contexts/ThemeContext";

export default function FaqPage() {
  const { theme } = useTheme();
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[720px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-1">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-text-muted mb-8">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link href="/contact" className="font-semibold text-link hover:text-link-hover transition-colors">
            Contact us
          </Link>
          .
        </p>

        <div className="bg-surface border border-border rounded-lg shadow-sm divide-y divide-border overflow-hidden">
          {faqItems.map((item) => {
            const open = openId === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-text">{item.question}</span>
                  <ChevronDown
                    size={16}
                    strokeWidth={2.5}
                    className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-brand ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-text-muted leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
