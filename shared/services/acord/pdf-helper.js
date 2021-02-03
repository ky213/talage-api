const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const path = require('path');

const createPDF = async(sourcePDFString, dataFieldsObj) => {
    const pathToPdfString = path.resolve(__dirname, './pdf/' + sourcePDFString);

    try {
        const pdfPage = await PDFDocument.load(fs.readFileSync(pathToPdfString).buffer);
        const form = pdfPage.getForm();

        for (const formFieldString of Object.keys(dataFieldsObj)) {
            if (!dataFieldsObj[formFieldString]) {
                continue;
            }
            const field = form.getField(formFieldString);
            switch (field.constructor.name) {
                case 'PDFTextField':
                    field.setText(dataFieldsObj[formFieldString].toString());
                    break;

                case 'PDFCheckBox':
                    if (dataFieldsObj[formFieldString]) {
                        field.check()
                    }
                    else {
                        field.uncheck();
                    }
                    break;

                default:
                    log.error(`Unknown type: ${field.constructor.name}` + __location);
                    throw new Error(`Unknown type: ${field.constructor.name}`);
            }
        }

        return pdfPage.save();
    }
    catch(err){
        log.error('Failed to generate PDF ' + err + __location);
        throw err;
    }
}

const createMultiPagePDF = async(pdfList) => {
    let multiPagePDF = null;
    try {
        const mergedPdf = await PDFDocument.create();

        for (const pdf of pdfList) {
            if (!pdf) {
                log.error('Invalid PDF file passed in' + __location);
                throw new Error("Invalid PDF file passed in");
            }
            const pdfDoc = await PDFDocument.load(pdf);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        multiPagePDF = mergedPdf.save();
    }
    catch (err) {
        log.error('Failed generating multi page PDF ' + err + __location);
        throw err;
    }

    return multiPagePDF;
}

module.exports = {
    createPDF,
    createMultiPagePDF
}
