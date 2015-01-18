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
    var log = require('bunyan').createLogger({name: 'JaskerInstance', level: 'info'});
    var JaskerMap = require('./JaskerMap').JaskerMap;

    /**
     * Create an instance of a JaskerMap flow.
     * @param jaskerMap JaskerMap
     * @param start String optional
     * @param document Object optional
     * @param ref String optional (used in splits)
     * @param sequence
     * @constructor
     */
    function JaskerInstance(jaskerMap, start, document, ref, sequence) {
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
        if (ref) {
            // This is the result of a split
            instanceData.ref = ref;
            instanceData.sequence = sequence;
        } else {
            instanceRef.ref = '' + Date.now();
            if (document && jaskerMap.docKeyField()) {
                instance.ref += ':doc.' + jaskerMap.docKeyField() + '(' + document[jaskerMap.docKeyField()] + ')';
            }
            instanceRef += ':' + jaskerMap.name() + ':' + start;
            instanceData.sequence = 'O';
        }
        instanceData.split = [];
        instanceData.start = start;
        instanceData.current = start;


        this.current = function () {
            return instanceData.current;
        };

        this.ref = function () {
            return instanceData.ref;
        };

        this.document = function () {
            return document;
        };

        /**
         * Split this instance into splitCount instances.  The current instance is preserved as the first split
         * @param splitCount
         * @returns {Array}
         */
        this.split = function (splitCount) {
            var self = this;
            var time = Date.now();
            // Note that the original instance, which continues as one of the flows, does not get its ref changed,
            // Whereas the new instances have appended a -sN to the ref.
            // If a document splits at multiple states, it could have any number of -sN-sM-sP....
            instanceData.split.push({state: self.current(), time: time, splitNdx: 0, splitCount: splitCount});
            var instances = new Array(splitCount);
            instances[0] = self;
            for (var i = 1; i < splitCount; i++) {
                instances[i] = new JaskerInstance(jaskerMap, self.current(), document, self);
            }
            return instances;
        };
        /**
         *
         * @returns a promise whose value is either a JaskerIntance (if no linkage or splits have occured) or an array of
         * JaskerInstances (including this one) otherwise.
         */
        this.next = function () {
            var self = this;
            return jaskerMap.next(self);
        };

        this.newState = function (state) {
            var self = this;
            instanceData.current = state;
        };
    }

    module.exports = JaskerInstance;
})();
