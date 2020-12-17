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
    const mergedPdf = await PDFDocument.create();

    for (const pdf of pdfList) {
        if (!pdf) {
            throw new Error("Invalid PDF file passed in")
        }
        const test = await PDFDocument.load(pdf);
        const copiedPages = await mergedPdf.copyPages(test, test.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    return mergedPdf.save();
}

module.exports = {
    createPDF,
    createMultiPagePDF
}
