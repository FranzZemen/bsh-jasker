/**
 * Created by Franz on 1/21/2015.
 */
(function () {
    'use strict';
    var log = require('bunyan').createLogger({name: 'renameMe', level: 'debug'});
    var _ = require('lodash');
    var JaskerEntryTask = require('../core/index').JaskerEntryTask;

    function JaskerEntryTaskSample2 () {
        JaskerEntryTask.call(this);
    }
    JaskerEntryTaskSample2.prototype = Object.create(JaskerEntryTask.prototype);
    JaskerEntryTaskSample2.prototype.constructor = JaskerEntryTaskSample2;

    JaskerEntryTaskSample2.prototype.perform = function (promise,document,state,stateData) {
        log.info('JaskerEntryTaskSample2 perform called @@@@@@@@@@@@@@@@@@');
        promise.resolve();
    };
    module.exports = JaskerEntryTaskSample2;
})();
