var EventEmitter = require('eventemitter2').EventEmitter2,
    util = require('util');

function Configuration(location) {

    function filterTag(tag) {
        return String(tag).replace(/[^a-zA-Z0-9 -\.]/g, '');
    }

    function haveNodes(el) {
        return ['object', 'array'].indexOf(typeof el) !== -1;
    }

    function exists(file) {
        return require('fs').existsSync(file);
    }

    var defaultLocation = __dirname + '/default.conf.json',
        location = exists(location)?location:defaultLocation,
        config = require(location),

        changed         = false,

        createSubNodes  = true,
        delimiter       = '.',
        debug           = false;

    EventEmitter.prototype.constructor.call(this, {
        wildcard: true,
        delimiter: delimiter, 
        newListener: false, 
        maxListeners: 20
    });

    this.get = function(selector, createNodes) {
        var indexes = String(selector || "").split(delimiter)
            .map(function(el) {
                return filterTag(el);
            }),
            createNodes = createNodes || false,
            requiredConf = config;
         
        var used = [],
            key = false,
            deep = 0;
        while(key = indexes.shift()) {
            if(debug) console.log('Binding key:', key);
            used.push(key);
            if(debug) console.log('Used keys:', used);
            if(haveNodes(requiredConf)
            && Object.keys(requiredConf).indexOf(key) !== -1) {
                requiredConf = requiredConf[key];
                if(!haveNodes(requiredConf))
                    return requiredConf;
                deep++;
            } else if(createNodes) {
                var expr = 'config["' + used.join('"]["') + '"]={}';
                if(debug) console.log('Create node:', expr);
                eval(expr);
                requiredConf = requiredConf[key];
                if(!indexes.length) return requiredConf;
            } else {
                return undefined;
            }
        }
     
        return requiredConf;
    }

    this.set = function(selector, value) {
        var selectorObject = this.get(selector, createSubNodes);
        if(typeof selectorObject !== 'undefined') {
            var createStmt = 'config["' + selector.split(delimiter).map(filterTag).join('"]["') + '"]=' + JSON.stringify(value);
            if(debug) console.log('Setting key:', createStmt);
            eval(createStmt);
        }

        changed = true;
        if(debug) console.log('Emit event:', selector);
        this.emit(selector, value, selector);
    }

    this.unset = function(selector) {
        var selectorObject = this.get(selector);
        if(typeof selectorObject !== 'undefined') {
            var createStmt = 'config["' + selector.split(delimiter).map(filterTag).join('"]["') + '"]=null;';
            createStmt += 'delete config["' + selector.split(delimiter).map(filterTag).join('"]["') + '"];'
            if(debug) console.log('Deleting key:', createStmt);
            eval(createStmt);
        }

        changed = true;
    }

    this.persist = function() {
        require('fs').writeFileSync(location, JSON.stringify(config, null, '\t'));
        changed = false;
        this.emit('persist', config);
    }

    this.isPersisted = function() {
        return !changed;
    }

    this.reload = function() {
        config = JSON.parse(require('fs').readFileSync(location, {encoding: 'utf-8'}));
        this.emit('reload', config);
    }

    this.getLocation = function() {
        return location;
    }

    this.setLocation = function(locationPath) {
        if(exists(locationPath))
            location = locationPath;
    }
}

util.inherits(Configuration, EventEmitter);

module.exports = new Configuration();