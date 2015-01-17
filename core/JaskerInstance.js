/**
 * Created by Franz on 1/17/2015.
 *
 * A JaskerInstance is an instance of a JaskerMap for a given document.  It may be the result of a document
 * starting a JaskerMap flow, the result of a linkage from one JaskerMap to another, or the result of a
 * split (a transition from one state to more than one state) within a JaskerMap, or the result of a merge (more
 * than one document with the same identification merging at a state).
 *
 */

(function () {
    'use strict';
    var defer = require('node-promise').defer;
    var log = require('bunyan').createLogger({name: 'JaskerInstance', level: 'debug'});
    var JaskerMap = require('./JaskerMap').JaskerMap;

    function JaskerInstance(jaskerMap, start, document) {
        var err,
            instanceData = {};

        if (jaskerMap === undefined || !(jaskerMap instanceof JaskerMap)) {
            err = new Error('jaskerMap is either undefined or not a function');
            log.error(err);
            throw err;
        }
        if (start === undefined) {
            log.info('startState not defined, will use the first state in JaskerMap ' + jaskerMap.name() + ' which is: ' + jaskerMap.firstState());
            start = jaskerMap.firstState();
        } else {
            if (!jaskerMap.validState(start)) {
                err = new Error('Invalid start state (' + start + ') provided for JaskerMap ' + jaskerMap.name);
            }
        }
        if (!document) {
            log.warn('No document provided for JaskerInstance.  Context based decisions using document will not be possible');
        }
        instanceData._id = jaskerMap.name() + ':' + start + ':' + Date.now() + ':' +
        ((!document) ? 'undefined' :
                document._id ? document._id :
                    document.name ? document.name :
                        document.key ? document.key : 'UNKNOWN_ID');
        instanceData.start = start;
        instanceData.current = start;
        log.debug({instanceData : instanceData}, 'instanceData');

        this.current = function () {
            return instanceData.current;
        };

        this.id = function () {
            return instanceData._id;
        };
        /**
         *
         * @returns a promise
         */
        this.next = function () {
            return jaskerMap.next(document);
        }
    }

    module.exports = JaskerInstance;
})();
