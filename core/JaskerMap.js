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
    var JaskerNextDecision = require('./JaskerNextDecision');
    var EntryTask = require('./EntryTask');
    var ExitTask = require('./ExitTask');


    function JaskerMap() {
        var jaskerMapConfig = {};
        var states = [];
        var instanceNonPersisted = true;

        this.name = function () {
            return jaskerMapConfig.name;
        };
        this.firstState = function () {
            return states.length ? states[0] : undefined;
        };

        this.validState = function (state) {
            return states.indexOf(state) >= 0;
        };

        this.initialize = function (config) {
            if (config.inline) {
                return loadInline(config.inline);
            } else if (config.mongo) {
                return loadFromMongo(config.mongo);
            } else if (config.json) {
                return loadFromJSON(config.json);
            } else {
                if (!defer) {
                    log.error(new Error('No defer'));
                }
                var deferred = defer();
                deferred.reject(new Error('Bad configuration - neither inline, mongo, or json'));
                return deferred.promise;
            }
        };

        this.next = function (jaskerInstance) {
            var self = this,
                deferred = defer(),
                err;
            log.debug('Next called for JaskerInstance' + jaskerInstance.id() + ' in JaskerMap: ' + self.name());
            if (!jaskerInstance.current()) {
                err = new Error('No current state defined on jaskerInstance ' + jaskerInstance.jaskerMapName() + ' for JaskerMap ' + self.name());
                log.error(err);
                deferred.reject(err);
            } else if(states.indexOf(jaskerInstance.current()) < 0) {
                err = new Error('No state in JaskerMap ' + self.name() + ' named ' + jaskerInstance.current());
                log.error(err);
                deferred.reject(err);
            } else {
                var state = stateForName(jaskerInstance.current());
                // Determine the next state trivial decision (no splits)
                var nextState = state.next;
                if (!nextState) {
                    // TODO:
                    if (state.nextDecision) {
                        nextState = undefined;
                    }
                }
                if (nextState) {
                    log.debug('Setting next state ' + nextState + ' on JaskerInstance ' + jaskerInstance.id());
                    jaskerInstance.newState(nextState);
                }

                deferred.resolve(jaskerInstance);

                // TODO: Execute exitTasks from current state
                // TODO: Determine splits (doc splits up)
                // TODO: Execute transition logic (including state entry tasks)
                // TODO: Execute linkage logic
                // TODO: Execute state entry tasks
            }
            return deferred.promise;
        };

        function loadInline(inlineConfig) {
            var deferred = defer();
            jaskerMapConfig = inlineConfig;
            jaskerMapConfig.type = module.exports.JaskerMapConfiguration.inline;
            var err = validate(jaskerMapConfig);
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve('Success');
            }
            return deferred.promise;
        }

        function loadFromMongo(mongoConfig) {
            throw new Error('Not yet implemented');
        }

        function loadFromJSON(jsonConfig) {
            throw new Error('Not yet implemented');
        }

        // Validation

        function validate(map) {
            var err = new Error('JaskerMap validation, errors in validationErrors field');
            err.validationErrors = [];
            if (!map.name) {
                err.validationErrors.push('no name provided');
            }
            if (map.states === undefined) {
                err.validationErrors.push('no states are defined');
            }
            var noStatesVisited = true;
            _.forOwn(map.states, function (state, key) {
                var nextFound = false;
                noStatesVisited = false;
                //if (state !== stateDef.name) {
                //err.validationErrors.push('state name is wrong.  Expected: ' + state + ' Found: ' + stateDef.name);
                //}
                if (state.code && !(typeof state.code === 'number' || typeof state.code === 'string')) {
                    err.validationErrors.push('' + key + '.code is not a number or a string: ' + state.code);
                }
                if (state.next) {
                    if (typeof state.next !== 'string') {
                        err.validationErrors.push('' + key + '.next is not a string: ' + state.next);
                    }
                    if (map.states[state.next] === undefined) {
                        err.validationErrors.push('' + key + '.next is not defined: ' + state.next);
                    }
                } else {
                    nextFound = true;
                }
                if (state.nextDecision) {
                    if (nextFound) {
                        err.validationErrors.push('Both next and nextDecision defined on: ' + state.next);
                    }
                    validateClassDef(state.nextDecision, key + '.nextDecision', 'JaskerNextDecision', JaskerNextDecision, err);
                }
                validateTasks(state.entryTasks, state + '.entryTasks', 'EntryTask', EntryTask, err);
                validateTasks(state.exitTasks, state + '.exitTasks', 'ExitTask', ExitTask, err);
                // Add this state to the states array
                states.push(key);
            });
            if (noStatesVisited) {
                err.validationErrors.push('No states defined under states');
            }
            if (err.validationErrors.length > 0) {
                return err;
            }

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
                        var classDefClass = require(classDef);
                        if (!classDefClass) {
                            err.validationErrors.push(logMsg + ' constructor for ' + logClassMsg + ' not found by require: ' + classDef);
                        } else {
                            if (typeof classDefClass !== 'function') {
                                err.validationErrors.push(logMsg + ' constructor for ' + logClassMsg + ' is not a constructor (or function): ' + classDef);
                            } else {
                                instance = new classDefClass();
                                if (!(instance instanceof baseClass)) {
                                    err.validationErrors.push(logMsg + ' is not a constructor for ' + logClassMsg + ': ' + classDef);
                                }
                            }
                        }
                    } else if (typeof classDef === 'function') {
                        instance = new classDef();
                        if (!(instance instanceof baseClass)) {
                            err.validationErrors.push(logMsg + ' is not a constructor for ' + logClassMsg + ': ' + classDef.name);
                        }
                    } else {
                        err.validationErrors.push(logMsg + ' is neither a string or a function');
                    }
                }
            }
        }

        function stateForName(name) {
            return jaskerMapConfig.states[name];
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

                done : {
                    donePeriod : 'number, optiona: milliseconds between which to check the doneDecision',
                    doneDecision: 'JaskerDoneDecision subclass, optiona: dynamically determine when the state is done and' +
                    'the next state or nextStateDecision, transitions and linkages should be invoked.  This allows ' +
                    'for an automated way to move the work along; the alternative being to have non state engine related' +
                    'code determine that.\\r\\n' +
                    'doneDecisions are evaluated immediately after a successful state entry and every time the donePeriod' +
                    '(if configured) is evaluated.\\r\\n' +
                    'Evidently, the JaskerDoneDecision subclass would operate on domain data be it from the document or' +
                    'some other source.\\r\\n' +
                    'Jasker will not trip an asynchronous doneDecisions with itself.  The next invocation of the ' +
                    'doneDecision will not fire unless the previous one is complete.'
                },
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
                    transitionTasks: {}
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
            static: {
                comment: 'Static linkages will always be executed',
                staticLinkageExample1: {
                    jaskerMap: 'already documented',
                    state: 'already documented',
                    invokeEntryTasks: 'boolean, optional: If missing or set to false will bypass state entry ' +
                    'tasks in the target state.',
                    linkageTasks: {}
                }
            }
        }
    };

    module.exports.JaskerMapConfiguration = {
        inline: 'inline',
        mongo: 'mongo',
        json: 'json'
    };

    module.exports.JaskerMap = JaskerMap;
})();
