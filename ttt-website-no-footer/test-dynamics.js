require('fs').readFile('.env.local', 'utf8', (err, data) => {
    if (err) { console.error(err); return; }
    data.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
    });

    async function test() {
        const tenantId = process.env.DYNAMICS_TENANT_ID;
        const clientId = process.env.DYNAMICS_CLIENT_ID;
        const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;
        const resource = process.env.DYNAMICS_RESOURCE_URL;

        console.log("Credentials loaded:", !!tenantId, !!clientId, !!clientSecret, !!resource);

        const url = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            resource: resource
        });

        try {
            const tokenRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });

            if (!tokenRes.ok) throw new Error("Token failed: " + await tokenRes.text());
            const tokenData = await tokenRes.json();
            const token = tokenData.access_token;
            console.log("Token retrieved successfully.");

            const baseUrl = resource.endsWith('/') ? resource.slice(0, -1) : resource;
            const query = "?$select=riivo_industry,riivo_industryid&$filter=statecode eq 0";
            // Dynamics oData endpoints require exact characters. Sometimes encodeURI acts weirdly.
            // Let's test the verbatim string as well since node-fetch often handles this cleanly.
            const apiUrl = `${baseUrl}/api/data/v9.2/riivo_industries${query}`;

            console.log("Fetching from:", apiUrl);
            const req = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!req.ok) {
                console.error("API Error Status:", req.status);
                // Print a small chunk so we see the 502/400 
                const text = await req.text();
                console.error(text.substring(0, 300));
                return;
            }

            const data = await req.json();
            console.log("Success! Found", data.value?.length, "industries.");
            if (data.value && data.value.length > 0) {
                 console.log("Sample:", data.value[0]);
            }

        } catch (e) {
            console.error("Error:", e);
        }
    }

    test();
});
