/**
 * Created by Franz on 1/21/2015.
 */

(function () {
    'use strict';
    var log = require('bunyan').createLogger({name: 'renameMe', level: 'debug'});
    var _ = require('lodash');
    var JaskerEntryTask = require('../core/index').JaskerEntryTask;

    function JaskerEntryTaskSample1 () {
        JaskerEntryTask.call(this);
    }
    JaskerEntryTaskSample1.prototype = Object.create(JaskerEntryTask.prototype);
    JaskerEntryTaskSample1.prototype.constructor = JaskerEntryTaskSample1;

    JaskerEntryTaskSample1.prototype.perform = function (promise,document,state,stateData) {
        log.info('JaskerEntryTaskSample1 perform called !!!!!!!!!!!!!!!!!!!!!!!!!!!');
        promise.resolve();
    };
    module.exports = JaskerEntryTaskSample1;
})();
