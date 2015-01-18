/**
 * Created by Franz on 1/17/2015.
 */

(function () {
    'use strict';
    var log = require('bunyan').createLogger({name: 'JaskerInstance.spec', level: 'info'}),
        when = require('node-promise').when,
        then = require('node-promise').then,
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
            jaskerInstance = new JaskerInstance(jaskerMap, 'stateTest1', document);
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
        it('next should transition to stateTest2', function (done) {
            jaskerInstance.next().then(function (val) {
                (val instanceof JaskerInstance).should.be.ok;
                val.current().should.be.equal('stateTest2');
                done();
            }, function (err) {
                log.error(err);
                done(err);
            });
        });

        it('next() should split and transition to stateTest3 and stateTest 4', function (done) {
            jaskerInstance.next().then(function (val) {
                jaskerInstance.next().then(function(val) {
                    (val instanceof Array).should.be.ok;
                    val.length.should.equal(2);
                    val.forEach(function (instance) {
                        (instance instanceof JaskerInstance).should.be.ok;
                        debug.info('ref: ' + instance.ref())
                    });
                    val[0].current().should.equal('stateTest3');
                    val[1].current().should.equal('stateTest4');
                    done();
                }, function(err) {
                    done(err);
                });
            }, function (err) {
                log.error(err);
                done(err);
            });
        });
    });
})();