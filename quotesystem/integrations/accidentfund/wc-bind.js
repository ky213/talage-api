const Bind = require('../bind');


class AFBind extends Bind {
    async bind() {
        const CompwestWCBind = require('../compwest/wc-bind.js');
        const BindClass = new CompwestWCBind(this.quote, this.insurer, this.agencyLocation);
        return BindClass.bind();
    }
}

module.exports = AFBind;