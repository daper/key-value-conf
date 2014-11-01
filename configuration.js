var EventEmitter = require('eventemitter2').EventEmitter2,
    util = require('util');

function Configuration(location, policy) {
    this.VERSION = this.version = '0.9.0';

    function merge_policy(obj1,obj2){
        var obj3 = {};
        for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
        for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
        return obj3;
    }

    var defaultLocation = __dirname + '/default.conf.json',
        changed         = false;
        
    var policy = policy || {},
        _policy = {
            allowCreation: true,
            allowDelete: true,
            allowOverwrite: false,

            emitEvents: true,
            debug: false,

            delimiter: '.',
            encoding: 'utf-8',
            maxDeep: 33
        }

    policy = merge_policy(_policy, policy);

    var fs = require('fs');

    function filterTag(tag) {
        var filtered = String(tag).replace(/[^a-zA-Z0-9 -\.]/g, '');
        if(policy.debug) console.log('Filtering tag:', tag, filtered);
        return filtered;
    }

    function createNode(tags) {
        var expr = 'config["' + tags.join('"]["') + '"]={}';
        if(policy.debug) console.log('Create node:', expr);
        eval(expr); changed = true;
    }

    function haveNodes(el) {
        return ['object', 'array'].indexOf(typeof el) !== -1;
    }

    function findNode(tags, allowCreation, allowOverwrite) {     
        var requiredConf = config,
            used = [],
            key = false,
            deep = 0;

        if(haveNodes(tags)) {
            while(key = tags.shift()) {
                if(policy.debug) console.log('Deep:', deep);
                if(deep++ > policy.maxDeep)
                    throw new Error('CallStack deep exceeded. ;( Bad news.');

                if(policy.debug) console.log('Binding key:', key);

                used.push(key);
                if(policy.debug) console.log('Used keys:', used);

                if(allowCreation && allowOverwrite) {
                    if(haveNodes(requiredConf)) {
                        if(Object.keys(requiredConf).indexOf(key) !== -1) {
                            if(tags.length)
                                createNode(used);
                         
                            requiredConf = requiredConf[key];
                        } else {
                            createNode(used);
                            requiredConf = requiredConf[key];
                        }
                    } else {
                        createNode(used);
                        requiredConf = requiredConf[key];
                    }
                } else if(allowCreation && !allowOverwrite) {
                    if(haveNodes(requiredConf)) {
                        if(Object.keys(requiredConf).indexOf(key) !== -1) {                        
                            requiredConf = requiredConf[key];
                        } else {
                            createNode(used);
                            requiredConf = requiredConf[key];
                        }
                    } else {
                        throw new Error('Cannot overwrite node');
                    }
                } else if(!allowCreation && !allowOverwrite) {
                    if(haveNodes(requiredConf)) {
                        if(Object.keys(requiredConf).indexOf(key) !== -1) {
                            requiredConf = requiredConf[key];
                        } else {
                            return undefined;
                        }
                    } else {
                        return undefined;
                    }
                }
            }
        } else return tags;
     
        return requiredConf;

    }

    function exists(file) {
        return fs.existsSync(file);
    }

    if(typeof location === 'object') {
        changed = true;
        var config = location;
        location = 'run-in';
    } else if(exists(location)) {
        var config = require(location);
    } else {
        location = defaultLocation;
        var config = require(location);
    }


    EventEmitter.prototype.constructor.call(this, {
        wildcard: true,
        delimiter: policy.delimiter, 
        newListener: false, 
        maxListeners: 20
    });

    this.get = function(selector) {
        var indexes = String(selector || "").split(policy.delimiter).map(filterTag);

        return findNode(indexes);
    }

    this.set = function(selector, value) {
        if(typeof selector === 'undefined')
            throw new Error('Cannot set value of undefined');

        var indexes = String(selector || "").split(policy.delimiter).map(filterTag),
            selectorObject = findNode(indexes, policy.allowCreation , policy.allowOverwrite);

        if(typeof selectorObject !== 'undefined') {
            var createStmt = 'config["' + selector.split(policy.delimiter).join('"]["') + '"]=' + JSON.stringify(value);
            if(policy.debug) console.log('Setting key:', createStmt);
            eval(createStmt); changed = true;
        }

        if(policy.debug) console.log('Emit event:', selector);
        if(policy.emitEvents) this.emit(selector, value, selector);

        return this;
    }

    this.unset = function(selector) {
        if(policy.allowDelete) {
            var selectorObject = findNode(selector);
            if(typeof selectorObject !== 'undefined') {
                var createStmt = 'config["' + selector.split(policy.delimiter).map(filterTag).join('"]["') + '"]=null;';
                createStmt += 'delete config["' + selector.split(policy.delimiter).map(filterTag).join('"]["') + '"];'
                if(policy.debug) console.log('Deleting key:', createStmt);
                eval(createStmt); changed = true;
            }

        } else throw new Error('It is not allowed nodes deleting.');
    }

    this.persist = function() {
        if(exists(location)) {
            fs.writeFileSync(location, JSON.stringify(config, null, '\t'), {encoding: policy.encoding});
            changed = false;
            if(policy.emitEvents) this.emit('persist', config);
        }
    }

    this.isPersisted = function() {
        return !changed;
    }

    this.reload = function() {
        config = JSON.parse(fs.readFileSync(location, {encoding: policy.encoding}));
        if(policy.emitEvents) this.emit('reload', config);
    }

    this.getLocation = function() {
        return location;
    }

    this.setLocation = function(locationPath) {
        locationPath = String(locationPath);

        if(!/\.json$/.test(locationPath))
            locationPath += ".json";
        if(!exists(locationPath))
            fs.writeFileSync(locationPath, '{}', {encoding: policy.encoding})
        location = locationPath;

        if(policy.emitEvents) this.emit('location', location);
    }
}

util.inherits(Configuration, EventEmitter);

module.exports = Configuration;