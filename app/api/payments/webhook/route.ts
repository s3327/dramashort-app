import { NextRequest, NextResponse } from "next/server";
import { processPaymentFulfillmentServer } from "@/lib/server/wallet";
import { isValidCoinPackageId } from "@/lib/payments/packages";

export async function POST(req: NextRequest) {
  try {
    // Optional webhook secret verification
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature =
        req.headers.get("x-webhook-signature") ||
        req.headers.get("stripe-signature") ||
        "";
      if (!signature || signature !== webhookSecret) {
        return NextResponse.json(
          { error: "INVALID_SIGNATURE", message: "Webhook signature verification failed." },
          { status: 401 }
        );
      }
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const { eventType, userId, packageId, referenceId } = payload || {};

    if (!eventType) {
      return NextResponse.json(
        { error: "MISSING_EVENT_TYPE", message: "eventType is required." },
        { status: 400 }
      );
    }

    // Only process payment completion
    if (eventType !== "payment.completed") {
      return NextResponse.json({
        received: true,
        processed: false,
        message: `Ignored event type: ${eventType}`,
      });
    }

    if (!userId || !packageId || !referenceId) {
      return NextResponse.json(
        {
          error: "MISSING_REQUIRED_FIELDS",
          message: "userId, packageId, and referenceId are required for payment.completed.",
        },
        { status: 400 }
      );
    }

    if (!isValidCoinPackageId(packageId)) {
      return NextResponse.json(
        { error: "INVALID_PACKAGE_ID", message: `Unknown package ID: ${packageId}` },
        { status: 400 }
      );
    }

    const result = await processPaymentFulfillmentServer(userId, packageId, referenceId);
    if (!result.ok) {
      return NextResponse.json(
        { error: "FULFILLMENT_FAILED", message: result.error },
        { status: 500 }
      );
    }

    const fulfillment = result.value;

    return NextResponse.json({
      success: true,
      duplicate: Boolean(fulfillment.duplicate),
      coinsCredited: fulfillment.coinsCredited ?? 0,
      vipGranted: Boolean(fulfillment.vipGranted),
      newBalance: fulfillment.newBalance,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
