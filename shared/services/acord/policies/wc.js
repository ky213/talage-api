'use strict'

const ACORD = require("../acord.js");

module.exports = class AcordWC extends ACORD{

    async create(){

        await this.dataInit('WC');

        const pdfList = [];

        pdfList.push(await this.createAcord130());
        pdfList.push(await this.createQuestionsTable());

        const pdf = this.createMultiPagePDF(pdfList);

        return pdf;
    }
}