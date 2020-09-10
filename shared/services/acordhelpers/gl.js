'use strict';

const PdfPrinter = require('pdfmake');
const crypt = global.requireShared('./services/crypt.js');
const moment = require('moment');

const signature = require('./signature.js');
const styles = require('./document-style/acord-form-gl/styles.js');
const pos = require('./document-style/acord-form-gl/positions.js');
const {createLogger} = require('restify/lib/bunyan_helper');

exports.createGL = async function(application_id, insurer_id){
    // PREP THE PDF

    // Define font files
    const fonts = {
        'Courier': {
            'bold': 'Courier-Bold',
            'bolditalics': 'Courier-BoldOblique',
            'italics': 'Courier-Oblique',
            'normal': 'Courier'
        },
        'Helvetica': {
            'bold': 'Helvetica-Bold',
            'bolditalics': 'Helvetica-BoldOblique',
            'italics': 'Helvetica-Oblique',
            'normal': 'Helvetica'
        },
        'Times': {
            'bold': 'Times-Bold',
            'bolditalics': 'Times-BoldItalic',
            'italics': 'Times-Italic',
            'normal': 'Times-Roman'
        }
    };

    const printer = new PdfPrinter(fonts);

    const img = [{
        'height': 792,
        'image': `${__dirname}/img/acord_form_gl_page1.jpeg`,
        'width': 612
    },
    {
        'height': 792,
        'image': `${__dirname}/img/acord_form_gl_page2.jpeg`,
        'width': 612
    },
    {
        'height': 792,
        'image': `${__dirname}/img/acord_form_gl_page3.jpeg`,
        'width': 612
    },
    {
        'height': 792,
        'image': `${__dirname}/img/acord_form_gl_page4.jpeg`,
        'width': 612
    },
    {
        'height': 792,
        'image': `${__dirname}/img/question_table.jpeg`,
        'width': 612
    }];

    const docDefinition = {
        'background': function(currentPage){
            // 1:1 background function for acord pages
            if(currentPage > 0 && currentPage <= 4){
                return img[currentPage - 1];
            }
            return img[4];

        },
        'content': [],
        'defaultStyle': {
            'font': 'Helvetica',
            'fontSize': 10
        },
        'pageSize': 'LETTER'
    }

    // RETRIEVE DATA
    let message = '';

    // Application data
    const application_sql = `SELECT
					ag.name AS agency,
					ic.naics AS naic_code,
					DATE_FORMAT(a.gl_effective_date, "%m/%d/%Y") AS effective_date,
					a.limits,
					b.name,
					apt.policy_type,
					ac.description
				FROM clw_talage_applications AS a
				INNER JOIN clw_talage_agencies AS ag ON a.agency = ag.id
				LEFT JOIN clw_talage_businesses AS b ON a.business = b.id
				LEFT JOIN clw_talage_industry_codes AS ic ON ic.id = b.industry_code
				LEFT JOIN clw_talage_application_policy_types AS apt ON apt.application = a.id
				LEFT JOIN clw_talage_addresses AS ad ON ad.business = b.id
				LEFT JOIN clw_talage_address_activity_codes AS aac ON ad.id = aac.address
				LEFT JOIN clw_talage_activity_codes AS ac ON ac.id = aac.ncci_code

				WHERE a.id = ${application_id};`;

    // Run the query
    const application_data = await db.query(application_sql).catch(function(error){
        message = 'ACORD form generation failed due to database error.';
        log.error(message + error + __location);
        return {'error': message};
    });

    // Check the number of rows returned
    if(application_data.length === 0){
        message = 'ACORD form generation failed. Invalid Application ID '
        log.error(message + __location);
        return {'error': message};
    }

    // Replace any null values with an empty string
    application_data.forEach(row => Object.values(row).map(element => element === null ? '' : element))

    // Check that the applicant applied for GL
    const gl_check = application_data.find(entry => entry.policy_type === 'GL');

    if(!gl_check){
        message = 'The requested application is not for General Liability';
        log.error(message + __location);
        return {'error': message};
    }

    const general = gl_check;

    // Retrieve insurer name if an insurer id was given

    if(insurer_id){
        const insurer_sql = `SELECT i.name
							FROM clw_talage_insurers AS i
							WHERE i.id = ${insurer_id}`

        const insurer_data = await db.query(insurer_sql).catch(function(error){
            message = 'ACORD form generation failed due to database error.';
            log.error(message + error + __location);
            return {'error': message};
        });

        general.carrier = insurer_data[0].name;
    }

    // Create array of unique activity code descriptions (only up to 3 since thats all that can fit on the form)
    const activity_codes = [... new Set(application_data.map(row => row.description))].slice(0,2);

    // PREP PAGE 1 DATA

    // Check for a business name
    let applicant_name = '';
    if(general.name && general.name.byteLength){
        applicant_name = await crypt.decrypt(general.name);
    }
    else{
        message = 'ACORD form generation failed. Business name missing for application.';
        log.error(message + __location);
        return {'error': message};
    }

    // Separate the limits
    general.limits = general.limits.match(/[1-9]+0+/g);

    // ADD PAGE 1 DATA
    docDefinition.content = docDefinition.content.concat([
        {
            'absolutePosition': pos.date,
            'text': moment().format('L')
        },
        {
            'text': general.agency,
            'absolutePosition': pos.agency
        },
        {
            'text': general.carrier ? general.carrier : '',
            'absolutePosition': pos.carrier
        },
        {
            'text': general.naic_code,
            'absolutePosition': pos.naic_code,
            'style': styles.naic_code
        },
        {
            'text': general.effective_date === '0000-00-00' ? '' : general.effective_date,
            'absolutePosition': pos.effective_date
        },
        {
            'text': applicant_name,
            'absolutePosition': pos.name
        },
        {
            'text': 'X',
            'absolutePosition': pos.commercial_gl
        },
        {
            'text': general.limits[1],
            'absolutePosition': pos.general_aggregate
        },
        {
            'text': 'X',
            'absolutePosition': pos.per_policy
        },
        {
            'text': general.limits[1],
            'absolutePosition': pos.pco_aggregate
        },
        {
            'text': general.limits[0],
            'absolutePosition': pos.each_occurence
        }
    ])

    // Classification descriptions
    activity_codes.forEach((code, index) => {
        docDefinition.content.push({
            'text': code,
            'absolutePosition': {
                'x': pos.classification_description.x,
                'y': pos.classification_description.y + index * 73
            }
        })
    })

    // Claims made
    for(let index = 0; index <= 4; index++){
        docDefinition.content.push({
            'text': 'N',
            'absolutePosition': pos[`claims_made_${index}`]
        })
    }

    // PAGE 2
    docDefinition.content.push({
        'pageBreak': 'before',
        'text': ''
    });

    // Question mapping
    const questions = {
        'contractors': {
            1: 1160,
            6: 1142,
            7: 969,
            '7a': 970,
            '7b': 1045
        },
        'products': {
            1: 671,
            5: 789,
            7: 1147,
            8: 999
        },
        'general_info': {
            2: 464,
            3: 1145,
            6: 997,
            13: 1013,
            17: 995
        }
    }

    const question_sql = `SELECT 
								q.id,
								q.question,
								qa.answer,
								q.parent,
								q.sub_level,
								aq.text_answer
							FROM clw_talage_application_questions AS aq
							INNER JOIN clw_talage_questions AS q ON q.id = aq.question
							INNER JOIN clw_talage_question_answers AS qa ON qa.id = aq.answer
							WHERE aq.application = ${application_id}`

    const question_data = await db.query(question_sql).catch(function(error){
        message = 'ACORD form generation failed due to database error.';
        log.error(message + error + __location);
        return {'error': message};
    });

    const question_ids = question_data.reduce((acc, el, i) => {
        acc[el.id] = i;
        return acc;
    }, {});

    const question_tree = [];

    question_data.forEach(question => {
        if(question.parent === null){
            question_tree.push(question);
            return
        }
        const parent_question = question_data[question_ids[question.parent]];

        if(parent_question){
            parent_question.children = [...parent_question.children || [], question];
        }
        else{
            question_tree.push(question);
        }

    });

    // PAGE 3
    docDefinition.content.push({
        'pageBreak': 'before',
        'text': ''
    });

    // PAGE 4
    docDefinition.content.push({
        'pageBreak': 'before',
        'text': ''
    });

    // Questions table
    docDefinition.content.push({
        'pageBreak': 'before',
        'text': ''
    });
    const total = 0;
    writeQuestions(question_tree, docDefinition, 0, total);

    const doc = printer.createPdfKitDocument(docDefinition);

    return {'doc': doc};

}

function writeQuestions(question_tree, docDefinition, level, total){
    question_tree.forEach(question => {

        let indentation = '| ';
        for(let index = 0; index < level; index++){
            indentation += '    ';
        }
        if(level > 0){
            indentation += '¬ ';
        }
        question.question = indentation + question.question.replace(/\\n/g, ' ');

        let result = '';
        while(question.question.length > 0){
            result += question.question.substring(0, 105) + '\n|  ';
            question.question = question.question.substring(105);
        }

        question.question = result;

        docDefinition.content.push({
            'text': question.question,
            'absolutePosition': {
                'x': pos.questions.x,
                'y': pos.questions.y + total * 33
            },
            'style': styles.questions
        })

        docDefinition.content.push({
            'text': question.answer,
            'absolutePosition': {
                'x': pos.answers.x,
                'y': pos.answers.y + total * 33
            }
        })

        total++;
        if(total % 17 === 0){
            docDefinition.content.push({
                'pageBreak': 'before',
                'text': ''
            })
            total = 0;
        }

        if(question.children && question.answer.toLowerCase() === 'yes'){
            total = writeQuestions(question.children, docDefinition, level + 1, total);
        }

    });
    return total;

}