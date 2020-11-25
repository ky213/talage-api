'use strict'

const ACORD = require("../acord.js");
const PdfHelper = require('../pdf-helper');

module.exports = class AcordGL extends ACORD{

    async create(){

        await this.dataInit('GL');

        const pdfList = [];

        pdfList.push(await this.createAcord125());
        pdfList.push(await this.createAcord126());
        pdfList.push(await this.createQuestionsTable());

        const pdf = PdfHelper.createMultiPagePDF(pdfList);

        return pdf;
    }
}

