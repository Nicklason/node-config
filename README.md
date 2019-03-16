# node-config

Get and set config values

## Examples

```js
const Config = require('@nicklason/config');

const config = new Config({
    directory: './', // Use current working directory
    filename: 'config.json', // The config will be named config.json
    timeout: 0 // The config will be saved right as it changes in memory
});

config.init(function (err) {
    if (err) {
        throw err;
    }

    // Adds foo to the config with the value bar, returns previous value
    console.log(config.set('foo', 'bar'));
    // -> undefined

    console.log(config.get('foo'));
    // -> bar

    // Removes the key from the config, returns the value of it
    console.log(config.del('foo'));
    // -> bar


    // bar is undefined, foo is the default value
    console.log(config.get('bar', 'foo'));
    // -> foo

    // Clears the config
    config.data = {};
});

// Wait some time before exiting
setTimeout(function () {
    // Gracefully close the config
    config.exit(function (err) {
        // Config is now saved, you can safely close the script (if no error)
    });
}, 1000);
```

Watch for changes by other processes.

```js
const Config = require('../');

const config = new Config({
    directory: './',
    filename: 'config.json',
    watch: true // Watch the data directory for changes to the config by other processes
});

config.on('change', function (oldData, newData) {
    console.log('Config was modified by a different process');
});
```
