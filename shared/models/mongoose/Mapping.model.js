// Invoke 'strict' JavaScript mode
/* jshint -W097 */ // don't warn about "use strict"
/*jshint esversion: 6 */
'use strict';

var mongoose = require('mongoose'), Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var moment = require('moment');
var uuid = require('uuid');
var mongooseHistory = require('mongoose-history');
const { stringify } = require('csv');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

let MappingSchema = new Schema({
    mappingId: { type: String, required: [true, 'mappingId required'], unique: true },
    name: { type: String, required: [true, 'name required'], unique: true },
    mapping: { type: Schema.Types.Mixed },
    active: { type: Boolean, default: true }
})

MappingSchema.plugin(timestamps);
MappingSchema.plugin(mongooseHistory);


MappingSchema.pre('validate', function (next) {
    if (this.isNew) {
         if (!this.mappingId) {
              this.mappingId = uuid.v4();
         }
    }
    next();
});

MappingSchema.pre('save', function (next) {
    next();
});



// Configure the 'MappingSchema' to use getters and virtuals when transforming to JSON
MappingSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

mongoose.set('useCreateIndex', true);
mongoose.model('Mapping', MappingSchema);