/**
 * Created by franzzemen on 1/20/15.
 */
(function () {
    function JaskerDecision() {
    }

    JaskerDecision.prototype.decide = function (promise, document, state, stateData) {
        throw new Error('Subclass should implement this method, returning an array of next states');
    };
    module.exports = JaskerDecision;
})();