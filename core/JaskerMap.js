/**
 * Created by Franz on 1/11/2015.
 *
 * JaskerMap Class Definition
 *
 * @param config configuration for the object
 * @constructor
 */
(function () {
    'use strict';

    var defer = require('node-promise').defer;
    var log = require('bunyan').createLogger({name: 'JaskerMap', level: 'info'});
    var _ = require('lodash');
    //var NextDecision = require('./NextDecision');
    //var EntryTask = require('./EntryTask');
    //var ExitTask = require('./ExitTask');

    module.exports.JaskerMapConfiguration = {
        inline: 'inline',
        mongo: 'mongo',
        json: 'json'
    };

    module.exports.JaskerMap = JaskerMap;

    function JaskerMap() {
        var map = {};
        var states;
        var instanceNonPersisted = true;

        this.initialize = function (config) {
            if (config.inline) {
                return loadInline(config.inline);
            } else if (config.mongo) {
                return loadFromMongo(config.mongo);
            } else if (config.json) {
                return loadFromJSON(config.json);
            } else {
                if (!defer) {log.error(new Error('No defer'));}
                var deferred = defer();
                deferred.reject(new Error('Bad configuration - neither inline, mongo, or json'));
                return deferred.promise;
            }
        };

        function loadInline(inlineConfig) {
            var deferred = defer();
            map = inlineConfig;
            map.type = module.exports.JaskerMapConfiguration.inline;
            var err = validate(map);
            if (err) {
                defer.reject(err);
            } else {
                defer.resolve('Success');
            }
            return deferred.promise;
        }

        function loadFromMongo(mongoConfig) {
            throw new Error('Not yet implemented');
        }

        function loadFromJSON(jsonConfig) {
            throw new Error('Not yet implemented');
        }
    }

    // Validation

    function validate(map) {
        var err = new Error('JaskerMap validation, errors in validationErrors field');
        err.validationErrors = [];
        if (map.length == 0) {
            err.validationErrors.push('no states re defined');
        }
        _.forOwn(map, function (stateDef, state) {
            if (state !== stateDef.name) {
                err.validationErrors.push('state name is wrong.  Expected: ' + state + ' Found: ' + stateDef.name);
            }
            if (stateDef.code && typeof stateDef.code !== 'number') {
                err.validationErrors.push('' + state + '.code is not a number: ' + stateDef.code);
            }
            if (stateDef.prev && (typeof stateDef.prev !== 'string')) {
                err.validationErrors.push('' + state + '.prev is not a string: ' + stateDef.prev);
            }
            if (stateDef.next && (typeof stateDef.next !== 'string')) {
                err.validationErrors.push('' + state + '.next is not a string: ' + stateDef.next);
            }
            validateClassDef(stateDef.nextDecision, state + '.nextDecision', 'JaskerNextDecision', NextDecision, err);
            validateTasks(stateDef.entryTasks, state + '.entryTasks', 'EntryTask', EntryTask, err);
            validateTasks(stateDef.exitTasks, state + '.exitTasks', 'ExitTask', ExitTask, err);
        });
        function validateTasks(tasks, logArrayMsg, logTaskMsg, baseClass, err) {
            if (tasks) {
                if (tasks.constructor !== Array) {
                    err.validationErrors.puh(logArrayMsg + ' is not an array');
                } else {
                    tasks.forEach(function (val, ndx) {
                        validateClassDef(val, logArrayMsg + '[' + ndx + ']', logTaskMsg, baseClass, err);
                    });
                }
            }
        }

        function validateClassDef(classDef, logMsg, logClassMsg, baseClass, err) {
            var instance;
            if (classDef) {
                if (typeof classDef === 'string') {
                    instance = new (require(classDef))();
                    if (!(instance instanceof baseClass)) {
                        err.validationErrors.push(logMsg + ' is not a constructor for ' + logClassMsg + ': ' + classDef);
                    }
                } else if (typeof classDef === 'function') {
                    instance = new classDef();
                    if (!(instance instanceof baseClass)) {
                        err.validationErrors.push(logMsg + ' is not a constructor for ' + logClassMsg + ': ' + classDef);
                    }
                } else {
                    err.validationErrors.push(logMsg + ' is neither a string or a function');
                }
            }
        }
    }

    var stateMapSpecification = {
        name: 'String, required: a required unique string representing the name of this JaskerMap',
        states: {
            stateExample1: {
                code: 'Alphanumeric, optional: an optional arbitrary alpha-numeric value',

                data: 'Object, optional: arbitrary static JSON contents that is provided to custome BSHLogic ' +
                'implementations when operating on this state',

                next: 'String, optional: statically provided next state name (for instance, ‘state2’).  If next is specified ' +
                'any entry in nextDecision will be ignored.  If neither next nor nextDecision are provided, the ' +
                'state is considered to be a terminal state.',

                nextDecision: 'JaskerNextDecision subclass, optional: dynamically determine next state.  If neither ' +
                'nextDecisoin nor next is provided, the state is considered to be a terminal state. \\r\\n' +
                'nextDecision is either a constructor (inline) or a string from which a module can be loaded.\\r\\n' +
                'Note that the module needs to either be npm published and installed, available through NODE_PATH ' +
                '(most common) or relative to the location of bsh-jasker’s JaskerMap.js (least common and not ' +
                'recommended).  The module’s require result should be a constructor (no fields on exports).\\r\\n' +
                'The nextDecision constructor must be a sub-class of JaskerNextDecision.\\r\\n' +
                'There can be only zero or one nextDecision per state.\\r\\n' +
                'Note that nextDecision supports splits, which means that the workflow can split to more than one state.' +
                'In that case, each split is unique from a perspective of error and rollback',

                entryTasks: {
                    entryTaskExample1: {
                        task: 'JaskerEntryTask subclass, optional: constructor (inline) or modules (external).  See the ' +
                        'module related comments in nextDecision.\\r\\n' +
                        'The constructor must be a sub-class of JaskerEntryTask.\\r\\n' +
                        'JaskerEntryTask(s) are performed when a state is attempted to be entered.  If optional is ' +
                        'set, below, then failure of the task will not result in a rollback to the previous state.',

                        optional: 'boolean, optional: an indicator to bsh-jasker that this task can succeed or ' +
                        'fail without regards to success in entering the state.  If not set, or if set to false, ' +
                        'then failure of the task will invoke a rollback on all entry tasks for this state, all ' +
                        'transition tasks for the transition to this state and all exit tasks for the previous state.'
                    },
                    entryTaskExample2: {}
                },
                exitTasks: {
                    exitTaskExample1: {
                        task: 'JaskerExitTask subclass, optional: optional constructor (inline) or modules (external).' +
                        'See the module related comments in nextDecision.\\r\\n' +
                        'The constructor must be a sub-class of JaskerExitTask\\r\\n' +
                        'JaskerExitTask(s) are performed when a state is attempted to be exited.  If optional is ' +
                        'set, below, then failure of the task will not result in a rollback that remains in the ' +
                        'current state.',

                        optional: 'boolean, optional: an indicator to bsh-jasker that this task can succeed or ' +
                        'fail without regards to success in exiting the state.  If not set, or if set to false, ' +
                        'then failure of the task will invoke a rollback on all exit tasks for this state, and ' +
                        'the current state will be maintained.'
                    }
                }
            },
            stateExample2: {}
        },
        transitions: {
            comment: 'Sometimes actions between states cannot be expressed in terms of exit and entry tasks - at ' +
            'such times transitions become useful.',
            dynamic: {
                comment: 'Logic that determines whether or not to be implemented based on contextual data.  This is ' +
                'useful when transition actions could be performed under many situations for many different state to ' +
                'state transitions.',

                dynamicTransitionExample1: {
                    dynamicCondition: 'JaskerTransitionDynamicCondition subclass, optional: constructor (inline) or ' +
                    'modules (external).  See the module related comments in nextDecision.\\r\\n' +
                    'The constructor must be a sub-class of JaskerDynamicTransitionCondition.\\r\\n' +
                    'JaskerDynamicTransitionCondition determines whether the current transition requires the associated ' +
                    'transitionTasks to be performed, and what the next state will be.',

                    transitionTasks: {
                        transitionTaskExample1: {
                            task: 'JaskerTransitionTask subclass, optional: constructor (inline) or modules (external).  ' +
                            'See the module related comments in nextDecision.\\r\\n' +
                            'The constructor must be a sub-class of JaskerTransitionTask.\\r\\n' +
                            'JaskerTransitionTask(s) are performed when when a transition has been identified as ' +
                            'having transitionTasks that should fire.  If optional is set, below, then failure of the ' +
                            'task will not result in a rollback of the transition.  A rollback implies that all ' +
                            'associated transition tasks as well as ExitTasks are rolled back',

                            optional: 'boolean, optional: an indicator to bsh-jasker that this task can succeed or ' +
                            'fail without regards to success in exiting the state.  If not set, or if set to false, ' +
                            'then failure of the task will invoke a rollback on all exit tasks and all transition ' +
                            'tasks and the current state will be maintained.'
                        },
                        transitionTaskExample2: {}
                    }
                }
            },
            static: {
                staticTransitionExample1: {
                    from: 'String, required: The starting state',
                    to: 'String, required: The destination state',
                    transitionTasks : {}
                }
            }
        },
        linkages: {
            comment: 'This allows one domain state process to affect another.  For example, orders affecting inventory',
            dynamic: {
                dynamicLinkageExample1: {
                    /*
                     jaskerMap: 'string, required: The unique name of the JaskerMap to which we’re linking.',

                     state: 'String, required: The state in the linked-to jaskerMap that we are entering.\\r\\n' +
                     'Note that all entryTask states will be not invoked, unless disableEntryTasks is ' +
                     'set to true.',

                     invokeEntryTasks: 'boolean, optional: If missing or set to false will bypass state entry ' +
                     'tasks in the target state.',
                     */
                    dynamicCondition: 'JaskerLinkageDynamicCondition subclass, optional: constructor (inline) or ' +
                    'modules (external).  See the module related comments in nextDecision.\\r\\n' +
                    'The constructor must be a sub-class of JaskerDynamicLinkageCondition.\\r\\n' +
                    'JaskerDynamicLinkageCondition determines whether the current linkage requires the associated ' +
                    'linkageTasks to be performed and what the linked state and jaskerMap will be and whether or not ' +
                    'to invoke entryTasks in the other map\'s state',

                    linkageTasks: {
                        linkageTaskExample1: {
                            task: 'JaskerLinkageTask subclass, optional: constructor (inline) or modules ' +
                            '(external).  See the module related comments in nextDecision.\\r\\n' +
                            'The constructor must be a sub-class of JaskerLinkageTask.\\r\\n' +
                            'JaskerLinkageTask(s) are performed when when a linkage has been identified ' +
                            'as having linkageTasks that should fire.  If optional is set, below, then ' +
                            'failure of the task will not result in a rollback of the linkdage.  A rollback ' +
                            'implies that all associated linkages tasks as well as JaskerExitTasks are rolled ' +
                            'back',

                            optional: 'boolean, optional: an indicator to bsh-jasker that this task can succeed or ' +
                            'fail without regards to success in exiting the state.  If not set, or if set to false, ' +
                            'then failure of the task will invoke a rollback on all exit tasks and all linkage' +
                            'tasks and the current state will be maintained.'
                        }
                    }
                },
                dynamicLinkageExample2: {}
            },
            static : {
                comment : 'Static linkages will always be executed',
                staticLinkageExample1 : {
                    jaskerMap : 'already documented',
                    state: 'already documented',
                    invokeEntryTasks: 'boolean, optional: If missing or set to false will bypass state entry ' +
                    'tasks in the target state.',
                    linkageTasks : {}
                }
            }
        }
    };

})();
