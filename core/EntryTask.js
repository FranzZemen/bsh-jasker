/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';
    var Task = require('./Task');

    function EntryTask () {
        Task.call(this);
    }
    EntryTask.prototype = Object.create(Task.prototype);
    EntryTask.prototype.constructor = EntryTask;

    module.exports = EntryTask;
})();
