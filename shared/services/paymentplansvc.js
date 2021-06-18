/* eslint-disable require-jsdoc */
const paymentPlans = [
    {
        "id": 1,
        "name": "Annual",
        "description": "1 single payment covering the entire payment. Pros, you are done. One less thing to worry about. Cons, it could be a lot of money upfront."
    },
    {
        "id": 2,
        "name": "Semi-Annual",
        "description": "One payment now and one payment in 6 months. Pros, breaks up a potentialy large payment, without making it part of your daily thoughts and activities. Cons, could still be larger payments."
    },
    {
        "id": 3,
        "name": "Quarterly",
        "description": "25% up front, then 3 more payments. Pros, even steady payments. Cons, have to remember to pay quarterly."
    },
    {
        "id": 4,
        "name": "10 pay",
        "description": "One payment now, 9 more to follow in the next 9 months. Pros, small payments, will have no payments the 2 months prior to the renewal of next years policy. Cons, need to remember to make these payments and put them in your monthly bills."
    },
    {
        "id": 5,
        "name": "Monthly",
        "description": "12 even payments. Pros, smallest payment options to help with cash flow. Cons, premium payments are a part of monthly expenses now. One more thing to keep track of."
    },
    {
        "id": 6,
        "name": "Pay-as-You-Go",
        "description": "Pay as often as you pay your payroll and is paid through automatic ACH payments linked to your checking account. Pros, small payments, and accurate. This can be really beneficial if you have seasonal peaks and valleys in your payroll and will help protect against a large audit at the end of the year. Cons, requires some set up and you have to track payroll at the employee level. You’ll have to send reports every pay period to ensure accuracy."
    }
];

function getList() {
    return paymentPlans;
}

function getById(id) {
    if (!id || typeof id !== "number") {
        const error = `paymentplansvc: Error: Invalid id supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const paymentPlan = paymentPlans.find(pp => pp.id === id);

    if (!paymentPlan) {
        const error = `paymentplansvc: Error: Could not find payment plan with matching id. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return paymentPlan;
    }
}


module.exports = {
    getList: getList,
    getById: getById
}