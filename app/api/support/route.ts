import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { createUserServerClient, createUserServiceRoleClient } from "@/lib/supabase/user-server";

import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support/types";
import {
  checkRateLimit,
  createRateLimitResponse,
  applyRateLimitHeaders,
  getRateLimitKey,
} from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/observability/error-reporter";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Malformed JSON request body", 400);
  }

  // 1. Honeypot check (spam bots)
  const honeypot = body?.hp || body?.honeypot || body?.website;
  if (honeypot && typeof honeypot === "string" && honeypot.trim().length > 0) {
    return apiError("VALIDATION_ERROR", "Spam submission rejected", 400);
  }

  // 2. Identify caller and apply rate limits
  let userId: string | null = null;
  try {
    const userClient = await createUserServerClient();
    const { data } = await userClient.auth.getUser();
    if (data?.user) {
      userId = data.user.id;
    }
  } catch {
    // Guest or unauthenticated caller
  }

  const rateLimitKey = getRateLimitKey(req, userId);
  const rateLimitResult = checkRateLimit(rateLimitKey, "support");
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(
      rateLimitResult,
      "Too many support requests. Please try again later.",
      "TOO_MANY_REQUESTS"
    );
  }

  // 3. Payload validation
  const { email, category, subject, message, context } = body || {};

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim()) || email.length > 255) {
    return apiError("VALIDATION_ERROR", "A valid email address is required (max 255 chars).", 400, {
      field: "email",
    });
  }

  if (!category || typeof category !== "string" || !SUPPORT_CATEGORIES.includes(category as SupportCategory)) {
    return apiError(
      "VALIDATION_ERROR",
      `Invalid category. Must be one of: ${SUPPORT_CATEGORIES.join(", ")}`,
      400,
      { field: "category" }
    );
  }

  const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
  if (!trimmedSubject || trimmedSubject.length < 3 || trimmedSubject.length > 200) {
    return apiError("VALIDATION_ERROR", "Subject must be between 3 and 200 characters.", 400, {
      field: "subject",
    });
  }

  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (!trimmedMessage || trimmedMessage.length < 10 || trimmedMessage.length > 4000) {
    return apiError("VALIDATION_ERROR", "Message must be between 10 and 4000 characters.", 400, {
      field: "message",
    });
  }

  let sanitizedContext: Record<string, unknown> = {};
  if (context && typeof context === "object" && !Array.isArray(context)) {
    try {
      const stringified = JSON.stringify(context);
      if (stringified.length <= 10000) {
        sanitizedContext = JSON.parse(stringified);
      }
    } catch {
      sanitizedContext = {};
    }
  }

  // 4. Insert ticket using privileged service role client
  try {
    const serviceClient = createUserServiceRoleClient();
    const { data, error } = await serviceClient
      .from("support_tickets")
      .insert({
        user_id: userId,
        email: email.trim().toLowerCase(),
        category: category as SupportCategory,
        subject: trimmedSubject,
        message: trimmedMessage,
        context: sanitizedContext,
        status: "open",
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      console.error("[SUPPORT TICKET INSERT ERROR]", error);
      reportError(error || new Error("Failed to save support ticket"), {
        route: "/api/support",
        method: "POST",
        userId: userId ?? undefined,
        requestId: req.headers.get("x-request-id") || undefined,
      });
      return apiError("DATABASE_ERROR", "Failed to save support ticket. Please try again later.", 500);
    }

    // 5. Team notification hook (Telegram Ops Channel / Bot)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const opsChatId = process.env.TELEGRAM_OPS_CHAT_ID;
    if (botToken && opsChatId) {
      const snippet = trimmedMessage.length > 300 ? `${trimmedMessage.slice(0, 300)}...` : trimmedMessage;
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: opsChatId,
          parse_mode: "Markdown",
          text: `🎫 *New Support Ticket [${category.toUpperCase()}]*\n*ID:* \`${data.id}\`\n*Email:* ${email.trim()}\n*Subject:* ${trimmedSubject}\n*Message:*\n${snippet}`,
        }),
      }).catch((notifyErr) => {
        console.warn("[SUPPORT TICKET TELEGRAM NOTIFY ERROR]", notifyErr);
      });
    }

    const successRes = apiSuccess(
      {
        success: true,
        ticketId: data.id,
        message: "Support ticket received. We will respond by email shortly.",
      },
      201
    );
    applyRateLimitHeaders(successRes, rateLimitResult);
    return successRes;
  } catch (err: any) {
    console.error("[SUPPORT TICKET UNHANDLED ERROR]", err);
    reportError(err, {
      route: "/api/support",
      method: "POST",
      userId: userId ?? undefined,
      requestId: req.headers.get("x-request-id") || undefined,
    });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred while submitting your ticket.", 500);
  }
}
