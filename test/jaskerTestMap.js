/**
 * Created by Franz on 1/17/2015.
 */
(function () {
    'use strict';
    var JaskerEntrySample2 = require('./JaskerEntryTaskSample2');

    module.exports = {
        inline: {
            name: 'test',
            docKeyField : 'name',
            promisesTimeout : 1000,
            states: {
                stateTest1: {
                    next: 'stateTest2',
                },
                stateTest2: {
                    next: ['stateTest3','stateTest4'],
                    splitMode: 'clone',
                    entryTasks: {
                        jaskerEntryTaskSample1 : {
                            task: '../test/JaskerEntryTaskSample1'
                        },
                        jaskerEntryTaskSample2 : {
                            task: JaskerEntrySample2
                        }
                    }
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