"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Video } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Modal from "@/components/Modal";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support/types";

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  general: "General Inquiry",
  playback: "Playback / Video Issue",
  billing: "Billing & Coins",
  content: "Content Request or Report",
  account: "Account & Profile",
};

function ContactForm() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const paramCategory = searchParams.get("category") as SupportCategory | null;
  const paramTitle = searchParams.get("title");
  const paramTitleName = searchParams.get("titleName");
  const paramEp = searchParams.get("ep");
  const initialSubjectParam = searchParams.get("subject");
  const initialMessageParam = searchParams.get("message");

  const defaultCategory: SupportCategory =
    paramCategory && SUPPORT_CATEGORIES.includes(paramCategory)
      ? paramCategory
      : paramTitle || paramEp
      ? "playback"
      : "general";

  const defaultSubject =
    initialSubjectParam ??
    (paramTitle
      ? `Playback Issue: ${paramTitleName || paramTitle}${paramEp ? ` (Ep ${paramEp})` : ""}`
      : "");

  const [category, setCategory] = useState<SupportCategory>(defaultCategory);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [content, setContent] = useState(initialMessageParam ?? "");
  const [honeypot, setHoneypot] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prepopulate email and display name if user is authenticated
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        name: fullName.trim() || undefined,
        email: email.trim(),
        category,
        subject: subject.trim(),
        message: content.trim(),
        context: {
          ...(paramTitle ? { title_slug: paramTitle } : {}),
          ...(paramEp ? { episode_number: parseInt(paramEp, 10) } : {}),
          ...(paramTitleName ? { drama_title: paramTitleName } : {}),
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
        hp: honeypot,
      };

      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitStatus("error");
        setErrorMessage(
          data.error?.message || "Failed to submit support request. Please try again."
        );
      } else {
        setSubmitStatus("success");
        setTicketId(data.data?.ticketId || null);
        setContent("");
        if (!paramTitle) {
          setSubject("");
        }
      }
    } catch {
      setSubmitStatus("error");
      setErrorMessage("Network error: Could not connect to the support server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[600px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-1">Contact Us</h1>
        <p className="text-sm text-text-muted mb-6">
          Have a question, a problem to report, or an issue with playback? Send us a message.
        </p>

        {/* Structured context notice when arriving from playback report */}
        {(paramTitle || paramEp) && (
          <div className="mb-6 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-2.5 text-xs text-text">
            <Video size={16} className="text-primary shrink-0" />
            <span>
              Reporting issue for{" "}
              <strong className="font-semibold text-primary">
                {paramTitleName || paramTitle}
              </strong>
              {paramEp && <span> (Episode {paramEp})</span>}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot field for bot deterrence */}
          <div className="hidden" aria-hidden="true">
            <input
              type="text"
              name="hp"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-semibold mb-1.5">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            >
              {SUPPORT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold mb-1.5">
              Full Name <span className="text-xs text-text-muted font-normal">(optional)</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jamie Doe"
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-semibold mb-1.5">
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your request"
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-semibold mb-1.5">
              Message
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Please describe what happened in detail..."
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? "Sending..." : "Send Message"}
          </button>
        </form>
      </main>

      <Footer />

      <Modal open={submitStatus !== null} onClose={() => setSubmitStatus(null)}>
        <div className="text-center">
          {submitStatus === "success" ? (
            <>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <CheckCircle2 size={24} strokeWidth={2} />
              </div>
              <h2 className="font-display font-bold text-lg mb-1.5">Message Received</h2>
              {ticketId && (
                <div className="mb-3">
                  <span className="text-xs font-mono text-text-muted bg-surface border border-border rounded-md px-2.5 py-1 inline-block">
                    Ticket #{ticketId.slice(0, 8)}
                  </span>
                </div>
              )}
              <p className="text-sm text-text-muted mb-6">
                Thanks for reaching out! Our team has logged your report and will follow up with you by email soon.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
                <XCircle size={24} strokeWidth={2} />
              </div>
              <h2 className="font-display font-bold text-lg mb-1.5">Something Went Wrong</h2>
              <p className="text-sm text-text-muted mb-6">
                {errorMessage || "Your message couldn't be sent. Please check your information and try again."}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => setSubmitStatus(null)}
            className="rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-6 py-2.5 shadow-sm transition-colors"
          >
            {submitStatus === "success" ? "Done" : "Close"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactForm />
    </Suspense>
  );
}
