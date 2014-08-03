(function() {
	'use strict';

	var Immutable = require('./node_modules/immutable/dist/Immutable');

	var when = require('./node_modules/when/when');

	when.keys = require('./node_modules/when/keys');

	var HalJS = {

		ajax: function() {
			throw new Error('An ajax object must be set for HalJS to fetch data from server');
		},

		ajaxOptions: {},

		/**
		 * Applies a function against an accumulator and each value of the array
		 * (from left-to-right) has to reduce it to a single value.
		 *
		 * @param  {Array|Object} collection
		 * @param  {Function} cb
		 * @param  {*} initialValue
		 * @return {*}
		 */
		reduce: function(collection, cb, initialValue) {
			return Array.prototype.reduce.call(collection, cb, initialValue);
		},

		/**
		 * Flattens (shallow) an nested array to an array
		 *
		 * @param  {Array} array
		 * @return {Array}
		 */
		flatten: function(array) {
			return HalJS.reduce(array, function(a, b) {
				return a.concat(b);
			}, []);
		},

		/**
		 * Check if value is an array
		 *
		 * @param {*}
		 * @return {Boolean}
		 */
		isArray: function(value) {
			return value instanceof Array;
		},

		/**
		 * Check if a value is an object
		 *
		 * @param  {*}  value
		 * @return {Boolean}
		 */
		isObject: function(value) {
			return value !== null && typeof value === 'object';
		},

		isVector: function(value) {
			return value instanceof Immutable.Vector;
		},

		isMap: function(value) {
			return value instanceof Immutable.Map;
		},

		isImmutable: function(value) {
			return HalJS.isVector(value) || HalJS.isMap(value);
		},

		toMutable: function(value) {

			if (HalJS.isImmutable(value)) {
				return value.toJSON();
			}

			return value;
		},

		toImmutable: function(value) {
			return new Immutable.fromJS(value);
		},

		_parse: function(resource, data) {
			if (HalJS.isImmutable(resource)) {
				return HalJS.toImmutable(data);
			} else {
				return data;
			}
		},

		/**
		 * Returns a new object containing the objects values
		 * default from the defaults object
		 *
		 * @param  {Object} object
		 * @param  {Object} defaults
		 * @return {Object}
		 */
		defaults: function(object, defaults) {
			return HalJS.reduce(defaults, function(object, value, key) {

				if (!object[key]) {
					object[key] = value;
				}

				return object;

			}, object);
		},

		/**
		 * Fetch an URL and return a 'when' compatible promise containing data
		 *
		 * @param  {String} url
		 * @return {Promise}
		 */
		fetch: function(url, immutable) {
			return when(HalJS.ajax(HalJS.defaults({url: url}, HalJS.ajaxOptions))).then(function(data) {
				if (immutable) {
					return HalJS.toImmutable(data);
				} else {
					return data;
				}
			});
		},

		/**
		 * Get an resource residing on key from a certain resource.
		 *
		 * Automatically detects whether to fetch multiple resources.
		 * Fetches from server is no embed is present
		 *
		 * @param  {Array|String} keys
		 * @param  {JSON} resource
		 * @return {Promise}
		 */
		get: function(keys, resource) {

			var mutableResource = HalJS.toMutable(resource);

			if (HalJS.isArray(keys)) {

				return when.keys.all(HalJS.reduce(keys, function(object, key, index) {
					object[key] = HalJS._getKey(key, mutableResource);

					return object;
				}, {})).fold(HalJS._parse, resource);

			} else {

				return HalJS._getKey(keys, mutableResource).fold(HalJS._parse, resource);

			}
		},

		/**
		 * Get a single key from a resource.
		 * Automatically detects if the resource is an array
		 *
		 * @param  {String} key
		 * @param  {JSON} resource
		 * @return {Promise}
		 */
		_getKey: function(key, resource) {
			if (HalJS.isArray(resource)) {
				return when(HalJS._getFromArrayOfResources(key, resource));
			} else {
				return when(HalJS._getFromResource(key, resource));
			}
		},

		/**
		 * Get values from multiple resources and flatten them into 1 array
		 *
		 * @param  {String} key
		 * @param  {JSON} resources
		 * @return {Promise}
		 */
		_getFromArrayOfResources: function(key, resources) {
			return when.map(resources, function(resource) {
				return HalJS._getFromResource(key, resource);
			}).then(HalJS.flatten);
		},

		/**
		 * Get a resource from key and automatically detect whether to
		 * fetch from server or use embedded.
		 *
		 * @param  {String} key
		 * @param  {JSON} resource
		 * @return {*}
		 */
		_getFromResource: function(key, resource) {

			if (HalJS.isObject(key)) {
				return HalJS._getTemplatedLink(key.name, resource, key.values);
			}

			if (resource._embedded && resource._embedded[key]) {
				return HalJS._getEmbed(key, resource);
			}

			if (resource._links && resource._links[key]) {
				return HalJS._getLink(key, resource);
			}
		},

		/**
		 * Get an embedded resource
		 *
		 * @param  {String} key
		 * @param  {JSON} resource
		 * @return {JSON}
		 */
		_getEmbed: function(key, resource) {
			return resource._embedded[key];
		},

		/**
		 * Get a link from a resource
		 * If the response is an array, return array of resources
		 *
		 * @param  {String} key
		 * @param  {JSON} resource
		 * @return {Promise}
		 */
		_getLink: function(key, resource, values) {

			if (HalJS.isArray(resource._links[key])) {
				return when.map(resource._links[key], function(link) {
					return HalJS.fetch(link.href);
				});
			}

			return HalJS.fetch(resource._links[key].href);
		},

		/**
		 * Get a templated link from a resource
		 * @param  {String} key
		 * @param  {JSON} resource
		 * @param  {Object} values
		 * @return {Promise}
		 */
		_getTemplatedLink: function(key, resource, values) {
			if (HalJS.isArray(resource._links[key])) {

				return when.map(resource._links[key], function(link) {
					return HalJS.fetch(HalJS._parseTemplatedLink(link, values));
				});

			}

			return HalJS.fetch(HalJS._parseTemplatedLink(resource._links[key], values));
		},

		/**
		 * Parse a templated link with corresponding values
		 * Returns a string containing the parsed URL
		 * @param  {Object} link
		 * @param  {Object} values
		 * @return {String}
		 */
		_parseTemplatedLink: function(link, values) {

			var fragments = link.href.match(/{([^}]+)}/g);

			return HalJS.reduce(fragments, function(link, fragment) {
				fragment = fragment.replace('{', '').replace('}', '');

				if(values[fragment]) {
					link = link.href.replace('{' + fragment + '}', values[fragment]);
				}

				return link;
			}, link);
		}
	};

	module.exports = HalJS;
})();