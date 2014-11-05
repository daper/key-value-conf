key-value-conf
=========

key-value-conf is a simple, lightweight and persistent node.js module. Some of its features are:

  - One multi-leveled selector.
  - Evented control of changes.
  - Persistent config file.
  - Restriction policies for changes.

Version
----

0.9.1

Usage
-----
```javascript
var Config = require('key-value-conf');

conf = new Config('default');

conf.get();
// { foo: 'bar' }

conf.set('myConfig', {
    key1: 'value1',
    key2: 'value2',
    key3: 'value3'
});
```

Multi-leveled selector
----------------------
```javascript
conf.set('myOtherConfig', {
    key1: 'value1',
    key2: [1,2,3],
    key3: {
        key4: true,
        key5: new Date()
    }
});

conf.get('myOtherConfig.key1');
// 'value1'

conf.get('myOtherConfig.key3.key4')
// true

conf.get('myOtherConfig.key2');
// [ 1, 2, 3 ]
```
Evented control of changes
--------------------------
```javascript
conf.on('myConfig.key1', function(selector, value) {
    console.log('[changes] Key ', selector, 'now is:', value);
});

conf.on('myOtherConfig.*', function(selector, value) {
    console.log('Something has changed in myOtherConfig!');
});

conf.on(['persist', 'reload'  'location'], function(config) {
    console.log('Check out current config:', config);
});
```
Persistent config file
----------------------
```javascript
conf.isPersisted();
// false

conf.getLocation();
// '~/dev/node_modules/key-value-conf/default.conf.json'

conf.setLocation('/tmp/test.conf.json');

conf.persist();
```
Policies
--------
##### allowCreation
  * default `true`
  * Description

##### allowDelete
  * default `true`
  * Description

##### allowOverwrite
  * default `false`
  * Description

##### delimiter
  * default `'.'`
  * Description

##### encoding
  * default `'utf-8'`
  * Description

##### maxDeep
  * default `33`
  * Description

##### emitEvents
  * default `true`
  * Description


# Public methods

### constructor(location, policies)

Description

### get(selector)

Description

### set(selector, value)

Description

### unset(selector)

Description

### persist()

Description

### isPersisted()

Description

### reload()

Description

### getLocation()

Description

### setLocation(locationPath)

Description

### EventEmitter

[EventEmitter2](https://github.com/asyncly/EventEmitter2)
