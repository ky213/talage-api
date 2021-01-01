/* eslint-disable strict */
/* eslint-disable no-invalid-this */
/* eslint-disable no-mixed-requires */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable one-var */

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const opts = {toJSON: {virtuals: true}};



// const contactSchema = new Schema({
//     email: {type: String, required: true},
//     name: {type: String, required: false},
//     phone: {type: String, required: false},
//     title: {type: String, required: false},
//     type: {type: String, required: false}
// });



const InsurerSchema = new Schema({
    insurerUuidId: {type: String, required: [true, 'insurerUuidId required'], unique: true},
    insurerId: {type: Number, unique: true},
    systemId: {type: Number, unique: true},
    name: {type: String, required: true},
    slug: {type: String, required: true, unique: true},
    logo: {type: String, required: false},
    featured: {type: Boolean, default: false},
    ordering: {type: Number, required: true, default: 0},
    commission: {type: String, required: false},
    website: {type: String, required: false},
    agency_id_label: {type: String, required: false, default: "Agency ID"},
    agent_id_label: {type: String, required: false, default: "Agent ID"},
    agent_login: {type: String, required: false},
    claim_email: {type: String, required: false},
    claim_phone: {type: String, required: false},
    claim_website: {type: String, required: false},
    enable_agent_id: {type: Boolean, required: false},
    payment_link: {type: String, required: false},
    payment_mailing_address: {type: String, required: false},
    payment_phone: {type: String, required: false},
    producer_code: {type: String, required: false},
    stock: {type: String, required: false},
    social_fb: {type: String, required: false},
    social_linkedin: {type: String, required: false},
    social_twitter: {type: String, required: false},
    rating: {type: String, required: false},
    description: {type: String, required: false},
    application_emails: {type: String, required: false},
    username: {type: String, required: false},
    password: {type: String, required: false},
    test_username: {type: String, required: false},
    test_password: {type: String, required: false},
    credentialInfo: {type: Schema.Types.Mixed},
    active: {type: Boolean, default: true}
},opts)


// //***** Virtuals old field names ****************** */

InsurerSchema.virtual('id').
    get(function() {
        if(this.systemId){
            return this.systemId;
        }
        else {
            return 0;
        }
    });

InsurerSchema.plugin(timestamps);
InsurerSchema.plugin(mongooseHistory);


InsurerSchema.pre('validate', function(next) {
    if (this.isNew) {
        if (!this.insurerUuidId) {
            this.insurerUuidId = uuid.v4();
        }
    }
    next();
});

InsurerSchema.pre('save', function(next) {
    next();
});


// // Configure the 'InsurerSchema' to use getters and virtuals when transforming to JSON
// InsurerSchema.set('toJSON', {
//     getters: true,
//     virtuals: true
// });

mongoose.set('useCreateIndex', true);
mongoose.model('Insurer', InsurerSchema);