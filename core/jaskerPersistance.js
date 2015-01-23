/**
 * Created by Franz on 1/22/2015.
 */

(function () {
    'use strict';
    var bunyan = require('bunyan');//.createLogger({name: 'renameMe', level: 'debug'});
    var _ = require('lodash');

    var mongoURI = require('../../config/environment').mongo.uri;
    var db = require('mongoskin').db(mongoURI);
    var ObjectID = require('mongodb').ObjectID;

    var dbPool = [];

    function JaskerPersistence (bunyanStreams, mongoUri) {
        var log,
            jaskerMapCollection = 'jaskerMap',
            jaskerInstanceCollection = 'jaskerInstance';

        if (bunyanStreams) {
            log = bunyan.createLogger({name: 'JaskerPersistence', streams: bunyanStreams});
        } else {
            log = bunyan.createLogger({name: 'JaskerPersistence', level: 'info'});
        }
        // Initialixe the default database (if it was provided)
        _db(mongoUri);
        // Make the pool accessible to the rest of Jasker
        this._db = _db;

        function _db(mongoUri) {
            var db;
            if (mongoUri) {
                var poolInstance = _.find(dbPool, {'uri': mongoUri});
                if (poolInstance) {
                    db = poolInstance.db;
                } else {
                    try {
                        db = require('mongoskin').db(mongoUri);
                        dbPool.push({uri: mongoUri, db: db});
                    }
                    catch (err) {
                        log.error(err, 'Obtaining mongoskin for uri: ' + mongoUri);
                    }
                }
            } else if (dbPool.length > 0) {
                db = dbPool[0].db;
            }
            return db;
        }
    }

    JaskerPersistence.prototype.setDefaultMongo = function(mongoUri) {

    };

    JaskerPersistence.prototype.loadMap = function (name, collection, mongoUri) {
        var self = this;
    };

    JaskerPersistence.prototype.saveMap = function (map, collection, mongoUri) {

    };

    JaskerPersistence.prototype.loadInstance = function (jaskerInstanceId, collection, mongoUri) {

    };

    JaskerPersistence.prototype.saveInstance = function (jaskerInstance, collection, mongoUri) {

    };

})(); 
