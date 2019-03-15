const FileManager = require('file-manager');
const fs = require('fs');
const md5 = require('md5');

require('util').inherits(Config, require('events').EventEmitter);
module.exports = Config;

/**
 * Config constructor
 * @param {Object} options
 * @param {String} options.dataDirectory The directory to save the config in
 * @param {String} [options.filename] Name of the config - `config.json` by default (may not contain slashes or similar)
 * @param {Number} [options.timeout] Amount of milliseconds to wait until saving the config - `0` by default
 * @param {Boolean} [options.watch] Watches the config file for changes made by other processes - `true` by default
 */
function Config (options) {
    if (!options.dataDirectory) {
        throw new Error('Missing dataDirectory option');
    }

    Object.defineProperty(this, 'data', {
        get: function () {
            return this._data;
        },
        set: function (newData) {
            this.replace(newData);
        }
    });

    this.ready = false;
    this.changed = false;
    this.filename = options.filename || 'options.json';
    this.timeout = options.timeout || 0;
    this.watch = options.hasOwnProperty('watch') ? options.watch : true;

    this.storage = new FileManager(options.dataDirectory);

    this._data = {};
    this._timeout = null;
    this._md5 = null;

    if (this.watch) {
        this._watchDirectory();
    }
}

/**
 * Initializes the module
 * @param {Function} [callback] Contains an error if failed
 */
Config.prototype.init = function (callback) {
    if (callback === undefined) {
        callback = noop;
    }

    this._getFromDisk((err, result) => {
        if (err) {
            return callback(err);
        }

        if (result !== undefined) {
            this._data = result;
        }

        this.ready = true;

        callback(null);
    });
};

/**
 * Event for when files in the directory are modified
 * @param {String} event
 * @param {String} filename
 */
Config.prototype._directoryChanged = function (event, filename) {
    if (filename === this.filename && event === 'change') {
        // Hacky way of blocking multiple events
        this._watch.close();

        this._getFromDisk((err, result) => {
            this._watchDirectory();
        });
    }
};

/**
 * Gracefully stop
 * @param {Function} callback
 */
Config.prototype.exit = function (callback) {
    this._watch.close();
    // Remove any timeout that was made
    clearTimeout(this._timeout);
    // Save to disk
    this._persistToDisk(callback);
};

/**
 * Gets the value of a key in the config
 * @param {String} key
 * @param {*} defaultValue
 * @return {*}
 */
Config.prototype.get = function (key, defaultValue) {
    if (!this._data.hasOwnProperty(key)) {
        return defaultValue;
    }
    return this._data[key];
};

/**
 * Sets the key in the config and saves to disk
 * @param {String} key
 * @param {*} value
 */
Config.prototype.set = function (key, value) {
    if (key === undefined) {
        return;
    }

    this._data[key] = value;
    this.changed = true;

    if (this.timeout !== undefined) {
        this._waitPersist();
    }
};

/**
 * Replaces the config with a new object
 * @param {Object} data
 */
Config.prototype.replace = function (data) {
    if (data === undefined) {
        return;
    }

    this._data = data;
    this.changed = true;

    if (this.timeout !== undefined) {
        this._waitPersist();
    }
};

/**
 * Save the config after some time
 * @param {Number} [timeout] Amount of milliseconds to wait
 */
Config.prototype._waitPersist = function (timeout) {
    if (!timeout) {
        timeout = this.timeout;
    }

    clearTimeout(this._timeout);
    this._timeout = setTimeout(Config.prototype._persistToDisk.bind(this, noop), this.timeout);
};

/**
 * Starts the watch
 */
Config.prototype._watchDirectory = function () {
    this._watch = fs.watch(this.storage.directory, Config.prototype._directoryChanged.bind(this));
};

/**
 * Save the config to disk
 * @param {Function} callback
 */
Config.prototype._persistToDisk = function (callback) {
    // Remove timeout
    this._timeout = null;
    if (this.watch) {
        this._watch.close();
    }

    // Only save if the data has changed
    if (!this.changed) {
        callback(null);
        return;
    }

    const json = JSON.stringify(this._data);
    this.storage.writeFile(this.filename, json, (err) => {
        if (!err) {
            this.changed = false;
        }

        if (this.watch) {
            this._watchDirectory();
        }

        callback(err);
    });
};

/**
 * Read the config
 * @param {Function} callback
 */
Config.prototype._getFromDisk = function (callback) {
    this.storage.readFile(this.filename, (err, result) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return callback(null, undefined);
            }
            return callback(err);
        }

        const parsed = parseJSON(result);
        if (parsed === null) {
            return callback(new Error('The config is corrupt / using invalid JSON syntax'));
        }

        const hash = md5(result);

        if (this._md5 !== null && this._md5 !== hash) {
            this._data = parsed;
            this.emit('change');
        }

        this._md5 = hash;

        callback(null, parsed);
    });
};

/**
 * Catches JSON parsing errors
 * @param {String} string
 * @return {Object|null}
 */
function parseJSON (string) {
    try {
        return JSON.parse(string);
    } catch (err) {
        return null;
    }
}

function noop () {

}
