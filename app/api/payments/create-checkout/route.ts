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

    let body: any;
    try {
      body = await req.json();
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

    const pkg = getCoinPackageById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "INVALID_PACKAGE_ID", message: `Unknown package ID: ${packageId}` },
        { status: 400 }
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
