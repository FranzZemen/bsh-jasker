/**
 * Created by Franz on 1/17/2015.
 */

(function () {
    'use strict';

    var should = require('should');

    var JaskerMapConfiguration,
        JaskerMap,
        jaskerMap;



    describe('JaskMap Tests', function () {
        it('should load the modules', function () {
            JaskerMapConfiguration = require('../core/JaskerMap').JaskerMapConfiguration;
            JaskerMap = require('../core/JaskerMap').JaskerMap;
        });
        it('should create a JaskerMap instance', function () {
            jaskerMap = new JaskerMap();
            (jaskerMap).should.be.ok;
        });
        it('should fail to initialize the empty configuration', function(done) {
            jaskerMap.initialize({}).then(function success(val){
                (val).should.not.be.ok;
                done();
            }, function fail(err) {
                (err !== undefined).should.be.ok;
                done();
            });
        });
    })
})();
