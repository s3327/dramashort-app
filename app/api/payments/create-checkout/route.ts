import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { getCoinPackageById } from "@/lib/payments/packages";
import { processPaymentFulfillmentServer } from "@/lib/server/wallet";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sign in is required to purchase coins." },
        { status: 401 }
      );
    }

    interface CreateCheckoutBody {
      packageId?: string;
      returnUrl?: string;
    }

    let body: CreateCheckoutBody;
    try {
      body = (await req.json()) as CreateCheckoutBody;
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const { packageId, returnUrl } = body || {};
    if (!packageId) {
      return NextResponse.json(
        { error: "MISSING_PACKAGE_ID", message: "packageId is required." },
        { status: 400 }
      );
    }

    if (returnUrl !== undefined) {
      if (typeof returnUrl !== "string") {
        return NextResponse.json(
          { error: "INVALID_RETURN_URL", message: "returnUrl must be a string." },
          { status: 400 }
        );
      }
      const isRelative =
        returnUrl.startsWith("/") &&
        !returnUrl.startsWith("//") &&
        !returnUrl.includes("://");
      if (!isRelative) {
        return NextResponse.json(
          { error: "INVALID_RETURN_URL", message: "returnUrl must be a relative path." },
          { status: 400 }
        );
      }
    }

    const pkg = getCoinPackageById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "INVALID_PACKAGE_ID", message: `Unknown package ID: ${packageId}` },
        { status: 400 }
      );
    }

    // Step 1: Guard against simulated checkout in production or when not explicitly enabled
    const simulatedAllowed =
      process.env.NODE_ENV !== "production" &&
      process.env.ENABLE_SIMULATED_CHECKOUT === "true";

    if (!simulatedAllowed) {
      return NextResponse.json(
        {
          error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
          message: "Purchases are temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    // Generate unique order reference ID
    const referenceId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // In modern server environments, simulate instant settlement or connect to external checkout session
    const fulfillmentRes = await processPaymentFulfillmentServer(
      user.id,
      pkg.id,
      referenceId
    );

    if (!fulfillmentRes.ok) {
      return NextResponse.json(
        { error: "PAYMENT_FULFILLMENT_FAILED", message: fulfillmentRes.error },
        { status: 500 }
      );
    }

    const fulfillment = fulfillmentRes.value;

    return NextResponse.json({
      success: true,
      referenceId,
      simulatedInstantSuccess: true,
      packageId: pkg.id,
      packageName: pkg.name,
      coinsCredited: fulfillment.coinsCredited ?? 0,
      vipGranted: Boolean(fulfillment.vipGranted),
      newBalance: fulfillment.newBalance,
      returnUrl: returnUrl || "/account/wallet",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
