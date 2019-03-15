const FileManager = require('file-manager');

/**
 * Config constructor
 * @param {Object} options
 * @param {String} options.dataDirectory The directory to save the config in
 * @param {String} [options.filename] Name of the config - `config.json` by default
 * @param {Number} [options.timeout] Amount of milliseconds to wait until saving the config - `0` by default
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
    this.storage = new FileManager(options.dataDirectory);
    this.filename = options.filename || 'options.json';
    this.timeout = options.timeout || 0;

    this._data = {};
    this._timeout = null;
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
 * Gracefully stop
 * @param {Function} callback
 */
Config.prototype.exit = function (callback) {
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
 * Save the config to disk
 * @param {Function} callback
 */
Config.prototype._persistToDisk = function (callback) {
    // Remove timeout
    this._timeout = null;

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

module.exports = Config;
