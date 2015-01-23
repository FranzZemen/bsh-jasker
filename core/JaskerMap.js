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
    var when = require('node-promise').when;
    var bunyan = require('bunyan');
    var _ = require('lodash');
    var unique = require('array-unique');
    var JaskerNextDecision = require('./JaskerNextDecision');
    var JaskerEntryTask = require('./JaskerEntryTask');
    var JaskerExitTask = require('./JaskerExitTask');
    var validate = require('./validateJaskerConfig');

    /**
     * JaskerMap
     * The Jasker controller for a given state engine configuration
     * @param bunyanStreams Optional configuration for Jasker's bunyan logging system.  Otherwise goes to con
     * @constructor
     */
    function JaskerMap(bunyanStreams) {
        var log,
            defaultPromisesTimeout = 60000;
        if (bunyanStreams) {
            log = bunyan.createLogger({name: 'JaskerMap', streams: bunyanStreams});
        } else {
            log = bunyan.createLogger({name: 'JaskerMap', level: 'info'});
        }
        var map;
        var stateNames = [];
        var self = this;

        /**
         * priviledged function bunyanStreams (intended for core)
         * Accessor returning the bunyanStreams configuration that was passed into the constructor
         * @returns bunyanStreams (Object)
         */
        this.bunyanStreams = function () {
            return bunyanStreams;
        };
        /**
         * priviledged function name (Intended for core & public)
         * Accessor returning the name of the underlying state engine configuration.
         * @returns name (String)
         */
        this.name = function () {
            return map.name;
        };

        this._docKeyField = function () {
            return map.docKeyField;
        };
        this._firstState = function () {
            return stateNames.length ? stateNames[0] : undefined;
        };

        this._validState = function (state) {
            return stateNames.indexOf(state) >= 0;
        };

        this.initialize = function (config) {
            var deferred = defer();
            when(validate(config, bunyanStreams),
                function (validationResult) {
                    map = validationResult.map;
                    stateNames = validationResult.stateNames;
                    deferred.resolve();
                }, function (err) {
                    deferred.reject(err);
                });
            return deferred.promise;
        };

        this.next = function (jaskerInstance) {
            var deferred = defer(),
                err;
            _debugJaskerInstance(jaskerInstance, '\'next\' called');
            if (!jaskerInstance.current()) {
                err = new Error('No current state defined on jaskerInstance ' + jaskerInstance.jaskerMapName() + ' for JaskerMap ' + self.name());
                log.error(err);
                deferred.reject(err);
            } else if (stateNames.indexOf(jaskerInstance.current()) < 0) {
                err = new Error('No state in JaskerMap ' + self.name() + ' named ' + jaskerInstance.current());
                log.error(err);
                deferred.reject(err);
            } else {
                var fromState = _stateForName(jaskerInstance.current());
                fromState.name = jaskerInstance.current();
                return when(_nextStates(fromState, jaskerInstance), function (nextStates) {
                    if (nextStates.length > 1) {
                        // Split the jaskerInstance
                        var jaskerInstances = jaskerInstance.split(nextStates.length, fromState.splitMode);
                        jaskerInstances.forEach(function (instance, ndx) {
                            instance.newState(nextStates[ndx]);
                        });
                        return jaskerInstances;
                        //deferred.resolve(jaskerInstances);
                    } else if (nextStates.length === 1) {
                        _debugJaskerInstance(jaskerInstance, 'Resolving. Setting next state', nextStates);
                        var toState = _stateForName(nextStates[0]);
                        toState.name = nextStates[0];
                        return when(_entryTasks(fromState, toState, jaskerInstance), function () {
                            jaskerInstance.newState(nextStates[0]);
                            return jaskerInstance;
                        }, function (err) {
                            return err;
                        });
                    } else {
                        _debugJaskerInstance(jaskerInstance, 'Resolving. No next state, terminal', nextStates);
                        //deferred.resolve(jaskerInstance);
                        return jaskerInstance;
                    }
                    // Potentially return when(....
                }, function (err) {
                    // All called methods wrapping external implementations already log.
                    //deferred.reject(err);
                    return err;
                });

                // TODO: Execute exitTasks from current state
                // TODO: Determine splits (doc splits up)
                // TODO: Execute transition logic (including state entry tasks)
                // TODO: Execute linkage logic
                // TODO: Execute state entry tasks
            }
            //return deferred.promise;
        };

        function _debugJaskerInstance(instance, message, object) {
            if (log.debug()) {
                if (object) {
                    log.debug({jaskerMap: self.name(), jaskerInstance: instance.ref(), ref: object}, message);
                } else {
                    log.debug({jaskerMap: self.name(), jaskerInstance: instance.ref()}, message);
                }
            }
        }


        function _stateForName(name) {
            return map.states[name];
        }

        function _nextStates (currentState, jaskerInstance) {
            var deferred = defer();
            var nextStates = [];
            if (currentState.next && typeof currentState.next === 'string') {
                nextStates.push(currentState.next);
            } else if (currentState.next instanceof Array) {
                nextStates = currentState.next;
            }
            if (currentState.nextDecision) {
                var nextDecisionImpl;
                if (typeof currentState.nextDecision === 'function') {
                    nextDecisionImpl = new currentState.nextDecision();
                } else {
                    var NextDecisionImpl = require(currentState.nextDecision);
                    nextDecisionImpl = new NextDecisionImpl();
                }
                _debugJaskerInstance(jaskerInstance, 'Calling JaskerNextDecision' + currentState.nextDecision);


                var timedOutDeferred = defer(canceller);
                var timeoutObject = setTimeout(function () {
                    timedOutDeferred.cancel();
                }, map.promisesTimeout ? map.promisesTimeout : defaultPromisesTimeout);

                // Note - we are NOT using the returned promise.  The contract SPECIFIES that the implementation
                // use the passed in promise.  This is to protect the overall state engine and force a timeout in the
                // case where the implementation goes on forever (relatively, at least), and moreover, fails to use
                // this promise.
                nextDecisionImpl.next(timedOutDeferred, jaskerInstance.document(), jaskerInstance.current(), currentState.data);

                timedOutDeferred.promise.then(
                    function (nextStatesFromDecision) {
                        if (timeoutObject) {
                            clearTimeout(timeoutObject);
                        }
                        if (nextStatesFromDecision instanceof Array) {
                            nextStates = unique(nextStates.concat(nextStatesFromDecision));
                            deferred.resolve(nextStates);
                        } else {
                            var err = new Error('Success value from JaskerNextDecision sub-class is not resolving to an Array for method next');
                            _logError(err);
                            deferred.reject(err);
                        }
                    },
                    function (err) {
                        if (timeoutObject) {
                            clearTimeout(timeoutObject);
                        }
                        _logError(err);
                        deferred.reject(err);
                    }
                );
            } else {
                // Since there is no nextDecision, we can immediately rsolve.
                nextStates = unique(nextStates);
                deferred.resolve(nextStates);
            }
            return deferred.promise;
        }

        function _entryTasks (fromState, toState, jaskerInstance) {
            var configuredTasks = toState.entryTasks;
            var namedTasks = [];
            _.forOwn(configuredTasks, function (task, key) {
                task.name = key;
                namedTasks.push(task);
            });
            return _task(namedTasks, 0, fromState, toState, jaskerInstance);
        }

        function _task (tasks, ndx, fromState, toState, jaskerInstance) {
            if (ndx >= tasks.length) {
                return 'Done';
            } else {
                var taskName = tasks[ndx].name;
                var taskDef = tasks[ndx].task;
                var optional = tasks[ndx].optiona;
                var taskImpl;
                if (typeof taskDef === 'function') {
                    taskImpl = new taskDef();
                } else {
                    var TaskImpl = require(taskDef);
                    taskImpl = new TaskImpl();
                }
                _debugJaskerInstance(jaskerInstance, 'Invoking task ' + taskName + ' in going from state ' + fromState.name + ' to state ' + toState.name);

                var timedOutDeferred = defer(canceller);
                var timeoutObject = setTimeout(function () {
                    timedOutDeferred.cancel();
                }, map.promisesTimeout ? map.promisesTimeout : defaultPromisesTimeout);

                // Note - we are NOT using the returned promise.  The contract SPECIFIES that the implementation
                // use the passed in promise.  This is to protect the overall state engine and force a timeout in the
                // case where the implementation goes on forever (relatively, at least), and moreover, fails to use
                // this promise.
                taskImpl.perform(timedOutDeferred, jaskerInstance.document(), toState.name, toState.data);

                return when(timedOutDeferred.promise, function () {
                        if (timeoutObject) {
                            clearTimeout(timeoutObject);
                        }
                        return _task(tasks, ndx + 1, fromState, toState, jaskerInstance);
                    },
                    function (err) {
                        if (timeoutObject) {
                            clearTimeout(timeoutObject);
                        }
                        _logError(err);
                        return err;
                        //deferred.reject(err);
                    }
                );
            }
        }


        function _logError(err) {
            if (err instanceof Error) {
                log.error(err);
            } else if (typeof err === 'string') {
                log.error(new Error(err));
            } else {
                log.error({error: err}, "Error");
            }
        }

        function canceller() {
            return new Error('Implementaton timed out.');
        }
    }

    var stateMapSpecification = {
        name: 'String, required: a required unique string representing the name of this JaskerMap',
        docKeyField: 'String, optional: if a document is provided, a field that represents its key.  Even if a' +
        'document is provided, this is optiona.  The JaskerInstance will append the document key value to its' +
        'internal instance referece.  It greatly assists troubleshooting, maintenance, data mining etc.',
        promiseTimeout: 'Number in milliseconds: The timeout for the promise passed to all Jasker implementations whose' +
        'methods take a promise.  For example a JaskerNextDecision next method requires as a parameter  a promise' +
        'that it must then return.  That promise, provided by Jasker, has a timeout which will reject the promise if' +
        'the promise is not otherwise resolved or rejected prior.  The value of this timeout is this setting.  If none' +
        'is provided the default value is 60000.  node-promise is used to implement Jasker promises.',
        states: {
            stateExample1: {
                code: 'Alphanumeric, optional: an optional arbitrary alpha-numeric value',

                data: 'Object, optional: arbitrary static JSON contents that is provided to custome BSHLogic ' +
                'implementations when operating on this state',

                cron: 'Scheduled task ',

                done: {
                    donePeriod: 'number, optiona: milliseconds between which to check the doneDecision',
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
