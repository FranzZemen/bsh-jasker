/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';
    var Task = require('./Task');

    function ExitTask () {
        Task.call(this);
    }
    ExitTask.prototype = Object.create(Task.prototype);
    ExitTask.prototype.constructor = ExitTask;

    module.exports = ExitTask;
})();
