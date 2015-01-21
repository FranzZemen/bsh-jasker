/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';
    var Task = require('./JaskerTask');

    function ExitTask () {
        JaskerTask.call(this);
    }
    ExitTask.prototype = Object.create(JaskerTask.prototype);
    ExitTask.prototype.constructor = ExitTask;

    module.exports = ExitTask;
})();
