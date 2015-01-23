/**
 * Created by Franz on 1/22/2015.
 */

(function () {
    'use strict';
    var bunyan = require('bunyan');
    var _ = require('lodash');
    var defer = require('node-promise').defer;
    var when = require('node-promise').when;
    var JaskerNextDecision = require('./JaskerNextDecision');
    var JaskerEntryTask = require('./JaskerEntryTask');
    var JaskerExitTask = require('./JaskerExitTask');

    function validate (config, bunyanStreams) {
        // Need to require here, or else we get a circular reference as JaskerMap requires this module.
        var JaskerMapConfiguration = require('./JaskerMap').JaskerMapConfiguration;

        var log;
        if (bunyanStreams) {
            log = bunyan.createLogger({name : 'validateJaskerConfig', streams: bunyanStreams});
        } else {
            log = bunyan.createLogger({name: 'validateJaskerCOnfig', level: 'info'});
        }
        var validationResult = {
            stateNames : [],
            validationFailures: []
        };
        if (config.inline) {
            validationResult.type = JaskerMapConfiguration.inline;
            return _validateInline(config.inline, validationResult);
        } else if (config.mongo) {
            validationResult.type = JaskerMapConfiguration.mongo;
            return _validateMongo(config.mongo);
        } else if (config.json) {
            validationResult.type = JaskerMapConfiguration.json;
            return _validateJson(config.json);
        } else {
            if (!defer) {
                _logValidationFailure(validationResult, 'Bad configuration - neither inline, mongo, or json');
            }
            var deferred = defer();
            deferred.reject(new Error('Bad configuration - neither inline, mongo, or json'));
            return deferred.promise;
        }

        // ==========
        // Function definitions within this function scope (use log and validationResult as closures)
        // ==========

        function _validateInline(map, validationResult) {
            // Strictly speaking this is all synchronous, but we're keeping with style for json or mongo
            var deferred = defer();
            if(_validateMap(map, validationResult)) {
                validationResult.map = map;
                validationResult.outcome = true;
                deferred.resolve(validationResult);
            } else {
                validationResult.outcome = false;
                var err = new Error('Failed Validation');
                deferred.reject(err);
            }
            return deferred.promise;
        }

        function _validateMongo(mongoConfig, validationResult) {


            var mongoURI = require('../../config/environment').mongo.uri;
            var db = require('mongoskin').db(mongoURI);
            var ObjectID = require('mongodb').ObjectID;
        }

        function _validateMap(map, validationResult) {
            var baseMessage = 'Validating mapping';
            log.debug(baseMessage);
            var outcome = true;
            if (map.name) {
                if (typeof map.name !== 'string') {
                    _logValidationFailure(validationResult, baseMessage + ': Failed name is a string check: ' + map.name);
                    outcome = false;
                }
            } else {
                _logValidationFailure(validationResult, baseMessage + ': Failed name must be provided check');
                outcome = false;
            }
            if (map.docKeyField && typeof map.docKeyField !== 'string') {
                _logValidationFailure(validationResult, baseMessage + ': Failed docKeyField msut be string check: ' + map.docKeyField);
                outcome = false;
            }
            if (map.promisesTimeout && typeof map.promisesTimeout !== 'number') {
                _logValidationFailure(validationResult, baseMessage + ': Failed optional promise must be a number check: ' + map.promisesTimeout);
                outcome = false;
            }
            if (map.states === undefined) {
                _logValidationFailure(validationResult, baseMessage + ': Failes states must be provided check');
                outcome = false;
            }
            if (!_validateStates(map.states,validationResult)) {
                outcome = false;
            }
            if (!outcome) {
                log.error({validationFailures:validationResult}, "Validation Failure Summary");
            }
            return outcome;
        }

        function _validateStates(states, validationResult) {
            var baseMessage = 'Validating states';
            log.debug(baseMessage);
            var outcome = true;
            var noStateVisited = true;
            _.forOwn(states, function (state, stateName) {
                if (!_validateState(state,stateName,states,validationResult)) {
                    outcome = false;
                }
                validationResult.stateNames.push(stateName);
                noStateVisited = false;
            });
            if (noStateVisited) {
                _logValidationFailure(validationResult, baseMessage + ': Failed at least one state must be defined check');
                outcome = false;
            }
            return outcome;
        }

        function _validateState(state, stateName, states, validationResult) {
            var baseMessage = 'Validating state [' + stateName + ']';
            log.debug(baseMessage);

            var outcome = true;
            if (state.code && !(typeof state.code === 'number' || typeof state.code === 'string')) {
                _logValidationFailure(validationResult, baseMessage + ': Failed optionally provided code [' + state.code + '] is a number or string check');
                outcome = false;
            }
            if (state.splitMode && state.splitMode !== 'clone' && state.splitMode !== 'reference') {
                _logValidationFailure(validationResult, baseMessage + ': Failed optionall provided splitMode [' + state.splitMode + '] is "clone" or "reference" check');
                outcome = false;
            }
            if (state.next) {
                if (typeof state.next == 'string') {
                    if (states[state.next] === undefined) {
                        _logValidationFailure(validationResult, baseMessage + ': Failed .next [' + state.next + '] is as state defined elsewhere in the map check');
                        outcome = false;
                    }
                } else if (state.next instanceof Array) {
                    state.next.forEach(function (thisState, ndx) {
                        if (states[thisState] === undefined) {
                            _logValidationFailure(validationResult, baseMessage + ': Failed .next[' + ndx + '] is as state defined elsewhere in the map check');
                            outcome = false;
                        }
                    });
                } else {
                    log.error(baseMessage + ': Failed .next [' + state.next + '] is an array or string check');
                    outcome = false;
                }
            }
            if (state.nextDecision) {
                if (!_validateDerivedClass(state.nextDecision, stateName + '.nextDecision', JaskerNextDecision, 'JaskerNextDecision', validationResult)) {
                    outcome = false;
                }
            }
            if (!_validateTasks(state.entryTasks, stateName + '.entryTasks', JaskerEntryTask, 'JaskerEntryTask',validationResult)) {
                outcome = false;
            }
            if (!_validateTasks(state.exitTasks, stateName + '.exitTasks', JaskerExitTask, 'JaskerExitTask', validationResult)) {
                outcome = false;
            }
            return outcome;
        }


        function _validateTasks(tasks, configurationName, baseClass, baseClassName, validationResult) {
            var baseMessage = 'Validating task array for configuration [' + configurationName + ']';
            log.debug(baseMessage);
            var outcome = true;
            if (tasks) {
                _.forOwn(tasks, function (task, key) {
                    if (!_validateTask(task, configurationName + '.' + key, baseClass,baseClassName, validationResult)) {
                        outcome = false;
                    }
                });
            }
            return outcome;
        }

        function _validateTask(taskEntry, configurationName, baseClass, baseClassName, validationResult) {
            var baseMessage = 'Validating task [' + configurationName + ']';
            log.debug(baseMessage);

            var result = _validateDerivedClass(taskEntry.task, configurationName + '.task', baseClass, baseClassName, validationResult);
            if (taskEntry.optional !== undefined && (typeof taskEntry.optional !== 'boolean')) {
                _logValidationFailure(validationResult, baseMessage + ': Failed optional is a boolean check');
                result = false;
            }
            return result;
        }

        function _validateDerivedClass(classOrModule, configurationName, baseClass, baseClassName, validationResult) {
            var baseMessage = 'Validating that configuration ' + configurationName + ' is either an inline constructor or a node module resulting in an inline constructor for  [' + baseClassName + ']';
            log.debug(baseMessage);
            if (classOrModule) {
                if (typeof classOrModule === 'string') {
                    // Assuming its a require's clause
                    var classConstructor;
                    try {
                        classConstructor = require(classOrModule);
                    } catch (err) {
                        _logValidationFailure(validationResult, baseMessage + ': Failed require check (verify relative path or NODE_PATH)', err);
                        return false;
                    }
                    if (classConstructor) {
                        return _validateInstanceOf(classConstructor,configurationName,baseClass,baseClassName, validationResult);
                    } else {
                        return false; // This cold will never execute, but fail safe.
                    }
                } else {
                    return _validateInstanceOf(classOrModule, configurationName,baseClass,baseClassName,validationResult);
                }
            }
            else {
                _logValidationFailure(validationResult, baseMessage + ': No acceptable data provided for the entry', {classOrModule: classOrModule});
                return false;
            }
        }

        function _validateInstanceOf(classConstructor, configurationName, baseClass, baseClassName, validationResult) {
            var baseMessage = 'Validating that configuration ' + configurationName + ' is a proper subclass constructor of [' + baseClassName + ']';
            log.debug(baseMessage);

            if (typeof classConstructor !== 'function') {
                _logValidationFailure(validationResult, baseMessage + ': Failed typeof function check (verify the type of object returned from require or passed inline)');
                return false;
            } else {
                var instance;
                try {
                    instance = new classConstructor();
                } catch (err) {
                    _logValidationFailure(validationResult, baseMessage + ': Failed instance creation check (verify that this is a constructor)', err);
                    return false;
                }
                if (instance instanceof baseClass) {
                    return true;
                } else {
                    _logValidationFailure(validationResult, baseMessage + ': Failed instanceof check (verify that this is proper subclass of the base class)');
                    return false;
                }
            }
        }

        function _logValidationFailure(validationResult, msg, err) {
            validationResult.validationFailures.push(msg);
            if (err) {
                log.error(err, msg);
            } else {
                log.error(msg);
            }
        }
    }

    module.exports = validate;
})();
