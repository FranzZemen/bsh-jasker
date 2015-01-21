/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';
    var name;

    function Task (taskName) {
        name = taskName;

        this.name = function () {
            return name;
        };
    }
    Task.prototype.perform = function (document) {
        throw new Error('Subclass ' + this.name() + ' should implement this method');
    };
    Task.prototype.rollback = function () {
        throw new Error('Subclass ' + this.name() + ' should implement this method');
    };

    module.exports = Task;
})();
