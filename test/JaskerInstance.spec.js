/**
 * Created by Franz on 1/17/2015.
 */

(function () {
    'use strict';
    var log = require('bunyan').createLogger({name: 'JaskerInstance.spec', level: 'info'}),
        when = require('node-promise').when,
        JaskerMap = require('../core/JaskerMap').JaskerMap,
        JaskerInstance = require('../core/JaskerInstance'),
        jaskerMap,
        jaskerInstance,
        document = {name: 'Document'};

    describe('JaskerInstance Tests', function () {
        beforeEach(function (done) {
            jaskerMap = new JaskerMap();
            jaskerMap.initialize(require('./jaskerTestMap'))
                .then(function () {
                    done();
                }, function (err) {
                    log.error(err);
                    done(err);
                });
        });
        it('should create the instance synchronously', function () {
            jaskerInstance = new JaskerInstance(jaskerMap, 'stateTest1', document);
        });
        it('should have current state as stateTest1', function () {
            jaskerInstance.current().should.equal('stateTest1');
        });
        it('should have id that ends with Document', function () {
            log.debug('Id: ' + jaskerInstance.id());
            jaskerInstance.id().indexOf('Document').should.be.greaterThan(0);
        });
        it('next should transition to stateTest3', function (done) {

            function nextState(jInstance) {
                return when(jInstance.next(), function (jinstanceAgain) {
                    return jinstanceAgain;
                }, function (err) {
                    log.err(err);
                    done(err);
                    return (jInstance);
                });
            }
            when(jaskerInstance.next(), function () {
                return when(jaskerInstance.next(), function() {
                    return jaskerInstance;
                })
            }).then(function (jInstance) {
                jInstance.current().should.equal('stateTest3');
                done();
            });
        });
    });
})();