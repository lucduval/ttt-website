/* eslint-disable @typescript-eslint/no-require-imports */
// Usage: node inspect-pdf-fields.js path/to/file.pdf
// Lists every AcroForm field (name + type) so we can map them in loe-pdf.ts.

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const pdfPath = process.argv[2];
if (!pdfPath) {
    console.error("Usage: node inspect-pdf-fields.js <path-to-pdf>");
    process.exit(1);
}

(async () => {
    const absPath = path.resolve(pdfPath);
    const bytes = await fs.promises.readFile(absPath);
    const doc = await PDFDocument.load(bytes);

    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    console.log(`File:    ${absPath}`);
    console.log(`Pages:   ${doc.getPageCount()}`);
    console.log(`Page 1:  ${width.toFixed(2)} x ${height.toFixed(2)}\n`);

    let form;
    try {
        form = doc.getForm();
    } catch (err) {
        console.log("No AcroForm present.");
        return;
    }

    const fields = form.getFields();
    if (fields.length === 0) {
        console.log("AcroForm exists but has 0 fields.");
        return;
    }

    console.log(`${fields.length} form field(s):`);
    fields.forEach((f, i) => {
        console.log(`  [${i + 1}] "${f.getName()}"  (${f.constructor.name})`);
    });
})().catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
});
