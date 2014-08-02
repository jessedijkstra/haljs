(function() {
	'use strict';


	/**
	 * TODO:
	 * - Add zoom levels to key var
	 * - Add templating for multiple resources
	 */

	var HalJS = {

		ajax: null,

		promise: when,

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

		/**
		 * INTERFACE: must be implemented before use of HalJS
		 *
		 * Fetch an URL and return a 'when' compatible promise containing data
		 *
		 * @param  {String} url
		 * @return {Promise} Must be a when compatible promise
		 */
		fetch: function(url) {
			throw new Error('Fetch function not implemented');
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

			if (HalJS.isArray(keys)) {

				return when.keys.all(HalJS.reduce(keys, function(object, key, index) {
					object[key] = HalJS._getKey(key, resource);

					return object;
				}, {}));

			} else {

				return HalJS._getKey(keys, resource);

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

	window.HalJS = HalJS;

})();