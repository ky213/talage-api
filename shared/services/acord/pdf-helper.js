const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const path = require('path');

const createPDF = async (sourcePDFString, dataFieldsObj) => {
    const pathToPdfString = path.resolve(__dirname, './pdf/' + sourcePDFString);

    try {
        const pdfPage = await PDFDocument.load(fs.readFileSync(pathToPdfString));
        const form = pdfPage.getForm();

        for (const i of Object.keys(dataFieldsObj)) {
            if (!dataFieldsObj[i]) {
                continue;
            }
            const field = form.getField(i);
            console.log('hitz', dataFieldsObj[i], typeof dataFieldsObj[i], field.constructor.name);
            switch (field.constructor.name) {
                case 'PDFTextField':
                    field.setText(dataFieldsObj[i].toString());
                    break;
                
                case 'PDFCheckBox':
                    if (dataFieldsObj[i]) {
                        field.check()
                    } else {
                        field.uncheck();
                    }
                    break;
                
                default:
                    throw new Error(`Unknown type: ${field.constructor.name}`);
            }            
        }
        return pdfPage;
    }
    catch(err){
        log.error('Failed to generate PDF ' + err + __location);
        throw err;
    }
    return null;
}

const createMultiPagePDF = async (pdfList) => {
    const mergedPdf = await PDFDocument.create();

    for (const pdf of pdfList) {
        if (!pdf) {
            throw new Error("Invalid PDF file passed in")
            console.log('BAD PDF:', pdfList);
        }
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    return mergedPdf;
}

module.exports = {
    createPDF,
    createMultiPagePDF
}