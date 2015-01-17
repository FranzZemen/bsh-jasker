/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';

    function JaskerNextDecision () {
    }
    JaskerNextDecision.prototype.next = function (jaskerInstance, state) {
        throw new Error('Subclass should implement this method');
    };
    module.exports = JaskerNextDecision;
})();
