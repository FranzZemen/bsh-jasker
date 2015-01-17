/**
 * Created by Franz on 1/17/2015.
 */
(function () {
    'use strict';

    module.exports = {
        inline: {
            name: 'test',
            states: {
                stateTest1: {
                    next: 'stateTest2'
                },
                stateTest2: {
                    next: 'stateTest3'
                },
                stateTest3: {
                    next: 'stateTest1',
                    nextDecision: './JaskerNextDecision'
                }
            }
        }
    }
})();