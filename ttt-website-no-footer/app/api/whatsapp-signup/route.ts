import { NextRequest, NextResponse } from "next/server";
import { sendTeamNotificationEmail, sendClientThankYouEmail } from "@/app/lib/email";
import type { EmailData } from "@/app/lib/email-templates";

export const runtime = "nodejs";

const ALLOWED_SERVICES = new Set(["tax", "accounting", "insurance", "advisory"]);

interface WhatsAppSignupPayload {
    name: string;
    email: string;
    phone: string;
    service: string;
    companyName?: string;
    clientType?: number;
    dynamicsId?: string | null;
    services?: Record<string, boolean | string | undefined>;
}

function badRequest(message: string) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
    const expectedToken = process.env.WHATSAPP_SIGNUP_TOKEN;
    if (!expectedToken) {
        console.error("WHATSAPP_SIGNUP_TOKEN is not configured on the server.");
        return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
    }

    const providedToken = req.headers.get("x-whatsapp-signup-token");
    if (providedToken !== expectedToken) {
        return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    let payload: WhatsAppSignupPayload;
    try {
        payload = await req.json();
    } catch {
        return badRequest("Invalid JSON body.");
    }

    const name = (payload.name || "").trim();
    const email = (payload.email || "").trim();
    const phone = (payload.phone || "").trim();
    const service = (payload.service || "").trim().toLowerCase();

    if (!name) return badRequest("`name` is required.");
    if (!email) return badRequest("`email` is required.");
    if (!phone) return badRequest("`phone` is required.");
    if (!ALLOWED_SERVICES.has(service)) {
        return badRequest(`\`service\` must be one of: ${Array.from(ALLOWED_SERVICES).join(", ")}.`);
    }

    const data: EmailData = {
        name,
        contactPerson: name,
        email,
        phone,
        companyName: payload.companyName?.trim() || undefined,
        clientType: typeof payload.clientType === "number" ? payload.clientType : undefined,
        services: payload.services,
    };

    try {
        await Promise.all([
            sendTeamNotificationEmail(data, service, payload.dynamicsId ?? null),
            sendClientThankYouEmail(data, service),
        ]);
    } catch (err) {
        console.error("WhatsApp signup email send failed:", err);
        return NextResponse.json(
            { ok: false, error: "Failed to send signup emails." },
            { status: 502 }
        );
    }

    return NextResponse.json({ ok: true });
}
