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
    var bunyan = require('bunyan');
    var _ = require('lodash');
    var JaskerNextDecision = require('./JaskerNextDecision');
    var EntryTask = require('./JaskerEntryTask');
    var ExitTask = require('./JaskerExitTask');

    var log;

    /**
     * JaskerMap
     * The Jasker controller for a given state engine configuration
     * @param bunyanStreams Optional configuration for Jasker's bunyan logging system.  Otherwise goes to con
     * @constructor
     */
    function JaskerMap(bunyanStreams) {
        if (bunyanStreams) {
            log = bunyan.createLogger({name: 'JaskerMap', streams : bunyanStreams});
        } else {
            log = bunyan.createLogger({name: 'JaskerMap', level: 'info'});
        }
        var jaskerMapConfig = {};
        var states = [];
        var instanceNonPersisted = true;

        /**
         * priviledged function bunyanStreams (intended for core)
         * Accessor returning the bunyanStreams configuration that was passed into the constructor
         * @returns bunyanStreams (Object)
         */
        this.bunyanStreams = function() {
            return bunyanStreams;
        };
        /**
         * priviledged function name (Intended for core & public)
         * Accessor returning the name of the underlying state engine configuration.
         * @returns name (String)
         */
        this.name = function () {
            return jaskerMapConfig.name;
        };
        this.docKeyField = function () {
            return jaskerMapConfig.docKeyField;
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
            debugJaskerInstance(self,jaskerInstance, '\'next\' called');
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
                var nextStates = [];
                if (state.next && typeof state.next === 'string') {
                    nextStates.push(state.next);
                } else if (state.next instanceof Array) {
                    nextStates = state.next;
                }
                if (state.nextDecision) {
                    var nextDecisionImpl;
                    if (typeof state.nextDecision === 'function') {
                        nextDecisionImpl = new state.nextDecision();
                    } else {
                        var NextDecisionImpl = require (state.nextDecision);
                        nextDecisionImpl = new NextDecisionImpl();
                    }
                    debugJaskerInstance(self,jaskerInstance,'Calling JaskerNextDecision' + state.nextDecision);
                    nextStates = nextStates.concat(nextDecisionImpl.next(jaskerInstance.document(), jaskerInstance.current(),state.data));
                }
                if (nextStates.length > 1) {
                    debugJaskerInstance(self, jaskerInstance, 'More than one next state found, splits will be performed', nextStates);
                    // Split the jaskerInstance
                    var jaskerInstances = jaskerInstance.split(nextStates.length, state.splitMode);
                    jaskerInstances.forEach(function (instance, ndx) {
                        instance.newState(nextStates[ndx]);
                    });
                    deferred.resolve(jaskerInstances);
                } else if (nextStates.length === 1) {
                    debugJaskerInstance(self, jaskerInstance, 'Setting next state', nextStates);
                    jaskerInstance.newState(nextStates[0]);
                    deferred.resolve(jaskerInstance);
                } else  {
                    debugJaskerInstance(self, jaskerInstance, 'No next state, terminal', nextStates);
                    deferred.resolve(jaskerInstance);
                }
                // TODO: Execute exitTasks from current state
                // TODO: Determine splits (doc splits up)
                // TODO: Execute transition logic (including state entry tasks)
                // TODO: Execute linkage logic
                // TODO: Execute state entry tasks
            }
            return deferred.promise;
        };

        function debugJaskerInstance(self,instance, message, object) {
            if (log.debug()) {
                if (object) {
                    log.debug({jaskerMap: self.name(), jaskerInstance: instance.ref(), ref: object}, message);
                } else {
                    log.debug({jaskerMap: self.name(), jaskerInstance: instance.ref()}, message);
                }
            }
        }

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
            if (map.name) {
                if (typeof map.name !== 'string') {
                    err.validationErrors.push('name is not a string');
                }
            } else {
                err.validationErrors.push('no name provided');
            }
            if (map.docKeyField && typeof map.docKeyField !== 'string') {
                err.validationErrors('docKeyField is not a string');
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
                if (state.splitMode && state.splitMode !== 'clone' && state.splitMode !== 'reference') {
                    err.validationErrors.push('' + key + '.splitMode is provided but value not \'clone\' or \'reference\'');
                }
                if (state.next) {
                    if (typeof state.next == 'string') {
                        if (map.states[state.next] === undefined) {
                            err.validationErrors.push('' + key + '.next is not defined: ' + state.next);
                        }
                    } else if (state.next instanceof Array) {
                        state.next.forEach(function(thisState,ndx) {
                            if (map.states[thisState] === undefined) {
                                err.validationErrors.push('' + key + '.next is not defined: ' + thisState);
                            }
                        });
                    }
                }
                validateClassDef(state.nextDecision, key + '.nextDecision', 'JaskerNextDecision', JaskerNextDecision, err);
                validateTasks(state.entryTasks, state + '.entryTasks', 'EntryTask', JaskerEntryTask, err);
                validateTasks(state.exitTasks, state + '.exitTasks', 'ExitTask', JaskerExitTask, err);
                // Add this state to the states array
                states.push(key);
            });
            if (noStatesVisited) {
                err.validationErrors.push('No states defined under states');
            }
            if (err.validationErrors.length > 0) {
                log.error(err);
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
                    log.debug('classDef: ' + classDef)
                    if (typeof classDef === 'string') {
                        var classDefClass;
                        try {
                            classDefClass = require(classDef);
                        } catch (reqErr) {
                            log.error(reqErr,'reqErr: ');
                            err.validationErrors.push(logMsg + ' require cannot load module for ' + logClassMsg + ': ' + classDef);
                        }
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
        docKeyField : 'String, optional: if a document is provided, a field that represents its key.  Even if a' +
        'document is provided, this is optiona.  The JaskerInstance will append the document key value to its' +
        'internal instance referece.  It greatly assists troubleshooting, maintenance, data mining etc.',
        promiseTimeout : 'Number in milliseconds: The timeout for the promise passed to all Jasker implementations whose' +
        'methods take a promise.  For example a JaskerNextDecision next method requires as a parameter  a promise' +
        'that it must then return.  That promise, provided by Jasker, has a timeout which will reject the promise if' +
        'the promise is not otherwise resolved or rejected prior.  The value of this timeout is this setting.',
        states: {
            stateExample1: {
                code: 'Alphanumeric, optional: an optional arbitrary alpha-numeric value',

                data: 'Object, optional: arbitrary static JSON contents that is provided to custome BSHLogic ' +
                'implementations when operating on this state',

                cron : 'Scheduled task ',

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
                next: 'String or array of String, optional: statically provided next state name (for instance, ‘state2’).  ' +
                'If neither next nor nextDecision are provided, the state is considered to be a terminal state.\\r\\n' +
                'If an array is provide, a split occurs, where a JaskerInstance is split into two instances',

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

                splitMode: 'Split mode (if and) when flow splits.  If set to \'clone\' then the underlying domain document ' +
                'within the JaskerInstnace, if provided is copied.  If missing or set to \'reference\' then the underlying ' +
                'domain document is shared.  Since this can be set at each state, different splitModes can be used ' +
                'depending on the type of flows.  \\r\\n' +
                'For example, if the split is permanent (never re-merged, it may ' +
                'represent a flow that goes to different business units or systems.  In that case a splitMode of ' +
                '\'clone\' is appropriate.  On the other hand, if changes are being made in parallel, but the changes' +
                'should be made to the latest version, then a splitMode of \'reference\' is appropriate\\r\\n' +
                'lodash.cloneDeep is used for the cloning process - the document must be compatible with that method.',

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
