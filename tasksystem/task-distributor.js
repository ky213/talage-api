

//global.queueHandler

const abandonquoteProcessor = require('./task-abandonquote');

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


