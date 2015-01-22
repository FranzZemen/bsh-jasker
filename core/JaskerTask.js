/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';
    var name;

    function Task () {

    }
    Task.prototype.perform = function (promise, document, state, stateData) {
        throw new Error('Subclass ' + this.name() + ' should implement this method');
    };
    Task.prototype.rollback = function () {
        throw new Error('Subclass ' + this.name() + ' should implement this method');
    };

    module.exports = Task;
})();
