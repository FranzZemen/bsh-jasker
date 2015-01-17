/**
 * Created by Franz on 1/17/2015.
 */

(function () {
    'use strict';
    var log = require('bunyan').createLogger({name: 'JaskerInstance.spec', level: 'debug'}),
        JaskerMap = require('../core/JaskerMap').JaskerMap,
        JaskerInstance = require('../core/JaskerInstance'),
        jaskerMap,
        jaskerInstance,
        document = {name : 'Document'};

    describe ('JaskerInstance Tests', function () {
        beforeEach(function(done) {
            jaskerMap = new JaskerMap();
            jaskerMap.initialize(require('./jaskerTestMap'))
                .then(function(){
                    done();
                }, function (err) {
                    log.error(err);
                    done(err);
                });
        });
        it ('should create the instance synchronously', function () {
            jaskerInstance = new JaskerInstance(jaskerMap, 'stateTest1', document);
        });
        it ('should have current state as stateTest1', function () {
            jaskerInstance.current().should.equal('stateTest1');
        });
        it ('should have id that ends with Document', function () {
            log.debug('Id: ' + jaskerInstance.id());
            jaskerInstance.id().indexOf('Document').should.be.greaterThan(0);
        });
    });
})();