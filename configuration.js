var EventEmitter = require('eventemitter2').EventEmitter2,
    util = require('util'),
    path = require('path');

function Configuration(location, policy) {
    this.VERSION = this.version = '0.9.1';

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
        var filtered = String(tag).replace(/[^a-zA-Z0-9 -\._]/g, '');
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

    function reqConfigFile(file) {
        if(typeof file === 'object')
            return {
                file: 'run-in',
                data: file
            };

        file = path.resolve(__dirname, '../../', String(file || ""));
        if(policy.debug) console.log('ReqFile:', file);

        if(!fs.existsSync(file) && !/\.json$/.test(file))
            file += ".json";

        if(policy.debug) console.log('File exists:', file, fs.existsSync(file));
        if(fs.existsSync(file)) {
            var fileData = fs.readFileSync(file);
            try {
                return {
                    file: file,
                    data: JSON.parse(fileData)
                };
            } catch(e) {
                throw new Error(e);
            }
        } else {
            file = fs.readFileSync(defaultLocation);
            try {
                return {
                    file: defaultLocation,
                    data: JSON.parse(file)
                };
            } catch(e) {
                throw new Error(e);
            }
        }
    }

    /** Initial Config **/
    fInfo = reqConfigFile(location);
    var config = fInfo.data;
    location = fInfo.file;

    if(policy.debug) console.log(fInfo);
    if(fInfo.file === 'run-in') changed = true;

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
        if(fs.existsSync(location)) {
            fs.writeFileSync(location, JSON.stringify(config, null, '\t'), {encoding: policy.encoding});
            changed = false;
            if(policy.emitEvents) this.emit('persist', config);
        } else if(location !== 'run-in') {
            throw new Error('Location file not exists');
        }
    }

    this.isPersisted = function() {
        return !changed;
    }

    this.reload = function() {
        if(fs.existsSync(location)) {
            config = JSON.parse(fs.readFileSync(location, {encoding: policy.encoding}));
            if(policy.emitEvents) this.emit('reload', config);
        } else if(location !== 'run-in') {
            throw new Error('Location file not exists');
        }
    }

    this.getLocation = function() {
        return location;
    }

    this.setLocation = function(locationPath) {
        locationPath = String(locationPath);

        var fInfo = reqConfigFile(locationPath);
        if(policy.debug) console.log(fInfo);

        location = fInfo.file;
        config = fInfo.data;
    }
}

util.inherits(Configuration, EventEmitter);

module.exports = Configuration;
