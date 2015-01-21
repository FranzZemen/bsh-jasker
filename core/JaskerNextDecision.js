/**
 * Created by Franz on 1/11/2015.
 */

(function () {
    'use strict';

    function JaskerNextDecision () {
    }
    JaskerNextDecision.prototype.decide = function (promise, document, state, stateData) {
        return this.next(promise, document, state, stateData);
    };
    /**
     * Given the domain document and the current state, provides the an array of next states.
     * @param document The domain document that was configured on the JaskerInstance
     * @param state The current state
     * @param stateData Optional. The state data, if any that was defined on the state, usually this is static data
     * @param promise The promise that MUST be returned by the implementation.
     */
    JaskerNextDecision.prototype.next = function (promise, document, state, stateData) {
        throw new Error('Subclass should implement this method, returning an array of next states');
    };
    module.exports = JaskerNextDecision;
})();
