

//global.queueHandler

const abandonquoteProcessor = require('./task-abandonquote');
const abandonAppProcessor = require('./task-abandonapplication.js');

/**
 * Task Distributor
 *
 * @param {string} message - message from queue
 * @returns {void}
 */
exports.distributeTask = async function (queueMessage){


    const messageBody = JSON.parse(queueMessage.Body);

    if(messageBody.taskname){
        switch(messageBody.taskname){
            case "abandonquote" :
                log.debug('abandonquote task')
                abandonquoteProcessor.processtask(queueMessage)
                break;
             case "abandonapplication" :
                log.debug('abandonapplication task')
                abandonAppProcessor.processtask(queueMessage)
                break;
            default:
                log.error('Bad taskname message ' + JSON.stringify(queueMessage) );
                 break;
        }
    
    }
    else{
        //Bad taskqueue message
        log.error('Bad taskqueue message ' + JSON.stringify(queueMessage) );

        //delete the message ???



    }
    

}


