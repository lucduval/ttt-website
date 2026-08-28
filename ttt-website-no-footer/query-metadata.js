require('fs').readFile('.env.local', 'utf8', async (err, data) => {
    if (err) { console.error(err); return; }
    data.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
    });

    try {
        const tenantId = process.env.DYNAMICS_TENANT_ID;
        const clientId = process.env.DYNAMICS_CLIENT_ID;
        const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;
        const resource = process.env.DYNAMICS_RESOURCE_URL;

        const url = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            resource: resource
        });

        const tokenRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;

        const baseUrl = resource.endsWith('/') ? resource.slice(0, -1) : resource;

        // Fetch metadata for new_lead about ManyToOneRelationships
        const apiUrl = `${baseUrl}/api/data/v9.2/EntityDefinitions(LogicalName='new_lead')/ManyToOneRelationships`;

        const req = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data2 = await req.json();
        const rel = data2.value.find(r => r.ReferencingAttribute === 'riivo_industry_lookup');
        console.log("Relationship:", JSON.stringify(rel, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
});
