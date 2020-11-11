'use strict'

const ACORD = require("../acord.js");

module.exports = class AcordGL extends ACORD{

    async create(){

        await this.dataInit('GL');

        const pdfList = [];

        pdfList.push(await this.createAcord125());
        pdfList.push(await this.createAcord126());
        pdfList.push(await this.createQuestionsTable());

        const pdf = this.createMultiPagePDF(pdfList);

        return pdf;
    }
}