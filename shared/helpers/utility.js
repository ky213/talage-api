'use strict';

//const exports = module.exports = {};

exports.Sleep = async function(ms){
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

exports.getInsurer = async function(insurerSlug) {
    const sql = `
		SELECT id, name, slug
		FROM clw_talage_insurers
		WHERE slug = '${insurerSlug}'
	`;
    const result = await db.query(sql);
    if (result === null) {
        console.log(`Could not retrieve insurer information for slug = ${insurerSlug}`);
        return null;
    }
    return result[0];
}