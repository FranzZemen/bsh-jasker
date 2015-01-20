/**
 * Created by Franz on 1/17/2015.
 */
(function () {
    'use strict';

    module.exports = {
        inline: {
            name: 'test',
            docKeyField : 'name',
            states: {
                stateTest1: {
                    next: 'stateTest2'
                },
                stateTest2: {
                    next: ['stateTest3','stateTest4'],
                    splitMode: 'clone'
                },
                stateTest3: {
                    nextDecision: '../test/JaskerNextDecisionTest'
                },
                stateTest4: {
                    next: 'stateTest1'
                },
                stateTest5: {
                }
            }
        }
    }
})();