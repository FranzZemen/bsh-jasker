/**
 * Created by Franz on 1/20/2015.
 */

(function () {
    'use strict';
    var log = require('bunyan').createLogger({name: 'renameMe', level: 'debug'});
    var _ = require('lodash');

    var JaskerNextDecision = require('../core/JaskerNextDecision');

    function JaskerNextDecisionTest() {
        JaskerNextDecision.call(this);
    }
    JaskerNextDecisionTest.prototype = Object.create(JaskerNextDecision.prototype);
    JaskerNextDecisionTest.prototype.constructor = JaskerNextDecisionTest;

    JaskerNextDecisionTest.prototype.next = function (document, state, stateData, promise) {
        setTimeout(function () {
            promise.resolve(['stateTest5']);
        },500);

    };

    module.exports = JaskerNextDecisionTest;
})(); 
