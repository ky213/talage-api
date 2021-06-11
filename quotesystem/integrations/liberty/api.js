/* eslint-disable object-curly-newline */
/* eslint-disable object-shorthand */
const axios = require('axios');
const oauth = require('axios-oauth-client');

const prefix = 'https://';
const host = 'apis.us-east-1.libertymutual.com';
const authPath = '/oauth/token';
const proposalPath = '/bl-partnerships/quoteProposal?quoteProposalId=';

const getLibertyOAuthToken = async() => {
    const url = `${prefix}${host}${authPath}`;
    log.debug(`Getting Access Token for Liberty from: ${url}`);

    // auth for request (url never changes)
    const getClientCredentials = oauth.client(axios.create(), {
        url,
        grant_type: 'client_credentials',
        client_id: '6GWGDIi18sFDkm7K06vMl88m604NbsVe',
        client_secret: 'CuLf3niGL2HPlAeE',
        scope: 'quoteApi'
    });

    let auth = null;
    try {
        auth = await getClientCredentials();
    }
    catch (e) {
        throw new Error(`An error occurred while trying to authenticate: ${e}. `);
    }

    return auth;
}

const getLibertyQuoteProposal = async(quoteProposalId, auth) => {
    const url = `${prefix}${host}${proposalPath}${quoteProposalId}`;
    log.debug(`Getting Quote Proposal for Liberty from: ${url}`);

    // attempt to get the quote proposal letter
    let proposalResult = null;
    try {
        proposalResult = await axios.get(url, {headers: {Authorization: `Bearer ${auth.access_token}`}});
    }
    catch (e) {
        throw new Error(`An error occurred while trying to retrieve the quote proposal letter: ${e}. `);
    }

    return proposalResult.data;
}

module.exports = {
    getLibertyOAuthToken,
    getLibertyQuoteProposal
}