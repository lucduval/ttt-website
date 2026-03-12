import { action } from "./_generated/server";
import { v } from "convex/values";
import { createRecord, getRecords } from "./dynamics";

export const getIndustries = action({
    args: {},
    handler: async (ctx) => {
        try {
            if (!process.env.DYNAMICS_CLIENT_ID) {
                return [];
            }
            const res = await getRecords('riivo_industries', "?$select=riivo_industry,riivo_industryid&$filter=statecode eq 0");
            if (res.success && res.value) {
                return res.value.map((ind: any) => ({
                    id: ind.riivo_industryid,
                    name: ind.riivo_industry
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            }
            return [];
        } catch (error) {
            console.error("Failed to fetch industries:", error);
            return [];
        }
    }
});

export const submitTargetData = action({
    args: {
        data: v.object({
            companyName: v.optional(v.string()),
            vatNumber: v.optional(v.string()),
            taxNumber: v.optional(v.string()),
            idNumber: v.optional(v.string()),
            industry: v.optional(v.string()),
            notes: v.optional(v.string()),
            contactPerson: v.optional(v.string()),
            email: v.string(), // require email
            phone: v.string(), // require phone
            message: v.optional(v.string()),
            name: v.optional(v.string()),
            files: v.optional(v.array(v.object({
                name: v.string(),
                content: v.string(),
                type: v.string()
            })))
        }),
        serviceType: v.string()
    },
    handler: async (ctx, args) => {
        const { data, serviceType } = args;
        console.log(`Submitting data for service: ${serviceType}`);

        let subject = `New Inquiry - ${serviceType}`;
        let description = `Service Type: ${serviceType}\n\n`;

        // We must map these fields per user requirements
        const riivo_clienttype = 1; // Need correct integer based on CRM
        const riivo_leadtype = 1; // Example
        const riivo_leadsource = 1; // Example

        let _riivo_industry_lookup_value = data.industry || null;

        let leadData: Record<string, unknown> = {};

        if (serviceType === 'accounting') {
            subject = `New Accounting Client Onboarding - ${data.companyName || 'Unknown Company'}`;
            description += `Company: ${data.companyName || 'N/A'}\n`;
            description += `VAT: ${data.vatNumber || 'N/A'}\n`;
            description += `Notes: ${data.notes || 'N/A'}\n`;

            const nameParts = data.contactPerson?.trim().split(' ') || ['Unknown'];
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

            leadData = {
                ttt_firstname: firstName,
                ttt_lastname: lastName,
                ttt_email: data.email,
                ttt_mobilephone: data.phone,
                riivo_companyname: data.companyName,
                riivo_vatnumber: data.vatNumber,
                riivo_incometaxnumber: data.taxNumber,
                riivo_notes: description, // Was previously \`description\`
                // Required CRM Fields:
                riivo_clienttype,
                riivo_leadtype,
                riivo_leadsource,
                ...(_riivo_industry_lookup_value && { "riivo_industry_lookup@odata.bind": `/riivo_industries(${_riivo_industry_lookup_value})` })
            };

        } else {
            description += `Message: ${data.message || 'N/A'}`;

            const nameParts = data.name?.trim().split(' ') || ['Unknown'];
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

            leadData = {
                ttt_firstname: firstName,
                ttt_lastname: lastName,
                ttt_email: data.email,
                ttt_mobilephone: data.phone,
                ttt_idnumber: data.idNumber, // Mapping the ID Number
                // Mapping the other CRM fields:
                riivo_notes: description, // Was previously \`description\`
                // Required CRM Fields:
                riivo_clienttype,
                riivo_leadtype,
                riivo_leadsource,
                ...(_riivo_industry_lookup_value && { "riivo_industry_lookup@odata.bind": `/riivo_industries(${_riivo_industry_lookup_value})` })
            };
        }

        try {
            if (!process.env.DYNAMICS_CLIENT_ID) {
                console.warn("Dynamics credentials not found. simulating success.");
                return { success: true, simulated: true };
            }

            console.log("Creating Lead in Dynamics...");
            const result = await createRecord('new_leads', leadData);
            const dynamicsId = result.id;

            // Handle Documents (Annotations)
            if (dynamicsId && data.files && data.files.length > 0) {
                console.log(`Uploading ${data.files.length} documents for lead ${dynamicsId}...`);

                for (const file of data.files) {
                    const annotationData = {
                        subject: `Document: ${file.name}`,
                        filename: file.name,
                        documentbody: file.content, // Base64 content
                        mimetype: file.type,
                        "objectid_new_lead@odata.bind": `/new_leads(${dynamicsId})`
                    };

                    await createRecord('annotations', annotationData);
                }
            }

            return { success: true, dynamicsId: dynamicsId };
        } catch (error: any) {
            console.error("Failed to submit to Dynamics:", error);
            throw new Error(`Failed to submit to Dynamics CRM: ${error.message}`);
        }
    }
});
