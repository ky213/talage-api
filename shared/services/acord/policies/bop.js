'use strict'

const ACORD = require("../acord.js");
const PdfHelper = require('../pdf-helper');

module.exports = class AcordBOP extends ACORD{
    async create(){

        await this.dataInit('BOP');

        const pdfList = [];

        pdfList.push(await this.createAcord125());
        pdfList.push(await this.createAcord140());
        pdfList.push(await this.createQuestionsTable());

        const pdf = PdfHelper.createMultiPagePDF(pdfList);

        return pdf;
    }
}