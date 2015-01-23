/**
 * Created by Franz on 1/17/2015.
 */

(function () {
    'use strict';

    var should = require('should');
    var log = require('bunyan').createLogger({name: 'JaskerMap.spec', level: 'debug'});

    var JaskerMapConfiguration,
        JaskerMap,
        JaskerNextDecision,
        initMap,
        jaskerMap,
        nextDecisionImpl,
        inlineDefinition = require('./jaskerTestMap');


    describe('JaskMap Initialization Tests', function () {
        it('should load the modules', function () {
            JaskerMapConfiguration = require('../core/index').JaskerMapConfiguration;
            JaskerMap = require('../core/index').JaskerMap;
            JaskerNextDecision = require('../core/index').JaskerNextDecision;

            JaskerMapConfiguration.should.be.ok;
            JaskerMap.should.be.ok;
            JaskerNextDecision.should.be.ok;

            function NextDecisionImpl() {
                JaskerNextDecision.call(this);
            }
        });
        it('should create a JaskerMap instance', function () {
            initMap = new JaskerMap();
            (initMap).should.be.ok;
        });
        it('should fail to initialize the empty configuration', function (done) {
            initMap.initialize({}).then(function success(val) {
                (val).should.not.be.ok;
                done();
            }, function fail(err) {
                (err !== undefined).should.be.ok;
                err.message.should.equal('Bad configuration - neither inline, mongo, or json');
                done();
            });
        });
        it('should succeed to initialize the inline configuration (vary inline configuration to do failure tests)', function (done) {
            initMap.initialize(inlineDefinition)
                .then(function success(val) {
                    done();
                }, function fail(err) {
                    log.debug({validationErrors: err.validationErrors}, 'Validation Errors');
                    (err.validationErrors !== undefined).should.not.be.ok;
                    done();
                });
        });
    });

    describe('JaskMap Post Intiialization Tests', function () {
        beforeEach(function (done) {
            jaskerMap = new JaskerMap();
            jaskerMap.initialize(inlineDefinition).then(function () {
                done();
            }, function (err) {
                log.error(err);
                done(err)
            });
        });
        it('should return the name=test', function () {
            jaskerMap.name().should.equal('test');
        });
        it('should return the first state=stateTest1', function () {
            jaskerMap._firstState().should.equal('stateTest1');
        });
        it('should say state=hello is not a valid state', function () {
            jaskerMap._validState('hello').should.not.be.ok;
        });
        it('should say state=stateTest2 is a valid state', function () {
            jaskerMap._validState('stateTest2').should.be.ok;
        });
    });
})();
