"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Modal from "@/components/Modal";
import { useTheme } from "@/contexts/ThemeContext";

const SUBJECTS = ["General", "Report", "Request Title"] as const;
const REPORT_TYPES = ["Title Error", "Video Not Working", "Report Bug"] as const;

type Subject = (typeof SUBJECTS)[number];

function isSubject(value: string | null): value is Subject {
  return SUBJECTS.includes(value as Subject);
}

function ContactForm() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();

  const initialSubject = searchParams.get("subject");
  const initialMessage = searchParams.get("message");

  const [subject, setSubject] = useState<Subject>(
    isSubject(initialSubject) ? initialSubject : "General"
  );
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>(REPORT_TYPES[0]);
  const [content, setContent] = useState(initialMessage ?? "");
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up to the real contact/support API once it exists.
    // Outcome is simulated here so both the success and failure popups
    // are actually reachable during review — real logic will just set
    // submitStatus based on the API response instead.
    const succeeded = Math.random() > 0.15;
    setSubmitStatus(succeeded ? "success" : "error");
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[600px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-1">Contact Us</h1>
        <p className="text-sm text-text-muted mb-8">
          Have a question, a problem to report, or a title to request? Send us a message.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-semibold mb-1.5">
              Subject
            </label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {subject === "Report" && (
            <div>
              <label htmlFor="reportType" className="block text-sm font-semibold mb-1.5">
                What's the issue?
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as (typeof REPORT_TYPES)[number])}
                className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold mb-1.5">
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              placeholder="Jamie Doe"
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
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
              placeholder="Tell us what's going on..."
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors"
          >
            Send
          </button>
        </form>
      </main>

      <Footer />

      <Modal open={submitStatus !== null} onClose={() => setSubmitStatus(null)}>
        <div className="text-center">
          {submitStatus === "success" ? (
            <>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700">
                <CheckCircle2 size={22} strokeWidth={2} />
              </div>
              <h2 className="font-display font-bold text-lg mb-1.5">Message sent</h2>
              <p className="text-sm text-text-muted mb-6">
                Thanks for reaching out — our team will get back to you by email soon.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
                <XCircle size={22} strokeWidth={2} />
              </div>
              <h2 className="font-display font-bold text-lg mb-1.5">Something went wrong</h2>
              <p className="text-sm text-text-muted mb-6">
                Your message couldn&apos;t be sent. Please try again in a moment.
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
