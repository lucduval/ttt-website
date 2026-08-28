require('fs').readFile('.env.production', 'utf8', async (err, data) => {
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

        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
                resource: resource
            }).toString()
        });
        const { access_token: token } = await tokenRes.json();

        const baseUrl = resource.endsWith('/') ? resource.slice(0, -1) : resource;

        const searchTerms = ['taxcrew', 'netasha', 'andrew', 'sheri', 'tori', 'brandon', 'cameron'];

        let allUsers = [];
        let nextLink = `${baseUrl}/api/data/v9.2/systemusers?$select=systemuserid,fullname,internalemailaddress,domainname,isdisabled`;
        while (nextLink) {
            const req = await fetch(nextLink, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'odata.maxpagesize=500'
                }
            });
            const result = await req.json();
            if (result.error) {
                console.log('ERROR:', result.error.message);
                break;
            }
            allUsers = allUsers.concat(result.value);
            nextLink = result['@odata.nextLink'] || null;
        }

        console.log(`Total users fetched: ${allUsers.length}\n`);

        const tttDomains = ['ttt-tax.co.za', 'ttt-insurance.co.za', 'ttt-finance.co.za', 'ttt-accounting.co.za'];
        console.log('=== All TTT-domain users ===');
        const tttUsers = allUsers.filter(u => {
            const email = (u.internalemailaddress || u.domainname || '').toLowerCase();
            return tttDomains.some(d => email.includes(d));
        }).sort((a, b) => (a.internalemailaddress || '').localeCompare(b.internalemailaddress || ''));
        for (const u of tttUsers) {
            console.log(`  ${(u.fullname || '').padEnd(35)} | ${(u.internalemailaddress || u.domainname || '').padEnd(40)} | id=${u.systemuserid} | disabled=${u.isdisabled}`);
        }
        console.log('');

        for (const term of searchTerms) {
            const hits = allUsers.filter(u => {
                const blob = `${u.fullname || ''} ${u.internalemailaddress || ''} ${u.domainname || ''}`.toLowerCase();
                return blob.includes(term);
            });
            console.log(`=== "${term}" (${hits.length} hit${hits.length === 1 ? '' : 's'}) ===`);
            for (const u of hits) {
                console.log(`  ${u.fullname} | ${u.internalemailaddress || u.domainname} | id=${u.systemuserid}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
});
