/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';
    var Task = require('./JaskerTask');

    function JaskerEntryTask () {
        JaskerTask.call(this);
    }
    JaskerEntryTask.prototype = Object.create(JaskerTask.prototype);
    JaskerEntryTask.prototype.constructor = JaskerEntryTask;

    module.exports = JaskerEntryTask;
})();
