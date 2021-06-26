
// *************  non-Standard BO *****************************
module.exports = class QuoteLimitBO {


    getById(id) {
        return new Promise(async(resolve, reject) => {
            const limits = [{
                "id": 1,
                "description":"Employers Liability Per Occurrence"
            },
            {
                "id": 2,
                "description":"Employers Liability Disease Per Employee"
            },
            {
                "id": 3,
                "description":"Employers Liability Disease Policy Limit"
            },
            {
                "id": 4,
                "description":"Each Occurrence"
            },
            {
                "id": 5,
                "description":"Damage to Rented Premises"
            },
            {
                "id": 6,
                "description":"Medical Expense"
            },
            {
                "id": 7,
                "description":"Personal & Advertising Injury"
            },
            {
                "id": 8,
                "description":"General Aggregate"
            },
            {
                "id": 9,
                "description":"Products & Completed Operations"
            },
            {
                "id": 10,
                "description":"Business Personal Property"
            },
            {
                "id": 11,
                "description":"Aggregate"
            },
            {
                "id": 12,
                "description":"Deductible"
            }]
            //validate
            if(id && id > 0){
                const limitMatch = limits.find((limit) => limit.id === id)
                if(limitMatch){
                    resolve(limitMatch);
                }
                else {
                    resolve({})
                }
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


}