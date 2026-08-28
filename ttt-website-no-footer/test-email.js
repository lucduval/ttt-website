// Quick test script to debug email sending via Microsoft Graph
// Run: node test-email.js

// Load .env.local manually
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
}

async function testEmail() {
    const tenantId = process.env.DYNAMICS_TENANT_ID;
    const clientId = process.env.DYNAMICS_CLIENT_ID;
    const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;
    const senderAddress = process.env.EMAIL_SENDER_ADDRESS;
    const teamAddresses = process.env.EMAIL_TEAM_ADDRESSES;

    console.log("=== Environment Check ===");
    console.log("DYNAMICS_TENANT_ID:", tenantId ? "SET" : "MISSING");
    console.log("DYNAMICS_CLIENT_ID:", clientId ? "SET" : "MISSING");
    console.log("DYNAMICS_CLIENT_SECRET:", clientSecret ? "SET" : "MISSING");
    console.log("EMAIL_SENDER_ADDRESS:", senderAddress || "MISSING");
    console.log("EMAIL_TEAM_ADDRESSES:", teamAddresses || "MISSING");

    if (!tenantId || !clientId || !clientSecret) {
        console.error("\nMissing Azure AD credentials. Cannot proceed.");
        return;
    }

    // Step 1: Get Graph token
    console.log("\n=== Step 1: Acquiring Graph Token ===");
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;
    const tokenBody = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        resource: "https://graph.microsoft.com",
    });

    try {
        const tokenRes = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenBody.toString(),
        });

        const tokenText = await tokenRes.text();
        if (!tokenRes.ok) {
            console.error("Token request FAILED:", tokenRes.status);
            console.error(tokenText);
            return;
        }

        const tokenData = JSON.parse(tokenText);
        console.log("Token acquired successfully. Expires in:", tokenData.expires_in, "seconds");
        const token = tokenData.access_token;

        // Step 2: Try sending a test email
        if (!senderAddress) {
            console.error("\nEMAIL_SENDER_ADDRESS not set. Cannot send email.");
            return;
        }

        const testRecipient = teamAddresses?.split(",")[0]?.trim() || senderAddress;
        console.log(`\n=== Step 2: Sending Test Email ===`);
        console.log(`From: ${senderAddress}`);
        console.log(`To: ${testRecipient}`);

        const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderAddress}/sendMail`;
        console.log(`URL: ${sendUrl}`);

        const emailRes = await fetch(sendUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: {
                    subject: "TTT Email Test — Please Ignore",
                    body: {
                        contentType: "Text",
                        content: "This is a test email from the TTT onboarding form email system.",
                    },
                    toRecipients: [
                        { emailAddress: { address: testRecipient } },
                    ],
                },
                saveToSentItems: false,
            }),
        });

        if (emailRes.ok) {
            console.log("\nEmail sent SUCCESSFULLY!");
        } else {
            const errorText = await emailRes.text();
            console.error("\nEmail send FAILED:", emailRes.status, emailRes.statusText);
            console.error(errorText);
        }
    } catch (err) {
        console.error("\nUnexpected error:", err);
    }
}

testEmail();
