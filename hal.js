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
		 * Flattens (shallow) an nested array or vectory to corresponding type
		 *
		 * @param  {Vector} array
		 * @return {Vector}
		 */
		flatten: function(vector) {
			return vector.reduce(function(a, b) {
				return a.concat(b);
			}, new Immutable.Vector());
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
		 * Check if value is an object
		 *
		 * @param  {*}  value
		 * @return {Boolean}
		 */
		isObject: function(value) {
			return value !== null && typeof value === 'object';
		},

		/**
		 * Check if value is a string
		 * @param  {[type]}  value [description]
		 * @return {Boolean}       [description]
		 */
		isString: function(value) {
			return typeof value === 'string';
		},

		/**
		 * Check if value is a vector
		 *
		 * @param {*}  value
		 * @return {Boolean}
		 */
		isVector: function(value) {
			return value instanceof Immutable.Vector;
		},

		/**
		 * Check if value is a map
		 *
		 * @param {*}  value
		 * @return {Boolean}
		 */
		isMap: function(value) {
			return value instanceof Immutable.Map;
		},

		/**
		 * Check if value is immutable
		 *
		 * @param {*}  value
		 * @return {Boolean}
		 */
		isImmutable: function(value) {
			return HalJS.isVector(value) || HalJS.isMap(value);
		},


		/**
		 * Convert immutable value to mutable value
		 *
		 * @param {*}  value
		 * @return {*}
		 */
		toMutable: function(value) {

			if (HalJS.isImmutable(value)) {
				return value.toJSON();
			}

			return value;
		},

		/**
		 * Convert mutable value to immutable value
		 *
		 * @param {*}  value
		 * @return {*}
		 */
		toImmutable: function(value) {
			return new Immutable.fromJS(value);
		},

		/**
		 * Check if key is embedded in resource
		 * @param  {String}  key
		 * @param  {Map}  resource
		 * @return {Boolean}
		 */
		isEmbedded: function(key, resource) {
			return resource.get('_embedded') && resource.get('_embedded').get(key);
		},

		/**
		 * Check key is linked in resource
		 * @param  {String}  key
		 * @param  {Map}  resource
		 * @return {Boolean}
		 */
		isLinked: function(key, resource) {
			return resource.get('_links') && resource.get('_links').get(key);
		},

		/**
		 * Fetch an URL and return a 'when' compatible promise containing data
		 *
		 * @param  {String} url
		 * @return {Promise}
		 */
		fetch: function(url) {
			return when(HalJS.ajax(HalJS._defaults({url: url}, HalJS.ajaxOptions))).then(HalJS.toImmutable);
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

				return HalJS._getKeys(keys, resource);

			} else {

				return HalJS._getKey(keys, resource);

			}
		},

		invalidate: function(keys, resource) {
			if (HalJS.isArray(keys)) {

				return HalJS._reduceObject(keys, function(resource, key) {
					return HalJS._invalidateEmbed(key, resource);
				}, resource);

			} else {

				return HalJS._invalidateEmbed(keys, resource);

			}
		},

		_invalidateEmbed: function(key, resource) {

			if (!HalJS.isLinked(key, resource)) {

				resource = resource.set('_links', resource.get('_links').set('provider_configurations',
					new Immutable.Map({
						href: resource.get('_embedded').get('provider_configurations').get('_links').get('self').get('href')
					})
				));

			}

			return resource.set('_embedded', resource.get('_embedded').delete(key));
		},

		/**
		 * Applies a function against an accumulator and each value of the array
		 * (from left-to-right) has to reduce it to a single value.
		 *
		 * @param  {Array|Object} collection
		 * @param  {Function} cb
		 * @param  {*} initialValue
		 * @return {*}
		 */
		_reduceObject: function(collection, cb, initialValue) {
			return Array.prototype.reduce.call(collection, cb, initialValue);
		},

		/**
		 * Returns a new object containing the objects values
		 * default from the defaults object
		 *
		 * @param  {Object} object
		 * @param  {Object} defaults
		 * @return {Object}
		 */
		_defaults: function(object, defaults) {
			return HalJS._reduceObject(defaults, function(object, value, key) {

				if (!object[key]) {
					object[key] = value;
				}

				return object;

			}, object);
		},

		_getKeys: function(keys, resource) {
			return when.keys.all(HalJS._reduceObject(keys, function(object, key, index) {

				if (HalJS.isObject(key)) {
					object[key.name] = HalJS._getKey(key, resource);
				}

				if (HalJS.isString(key)) {
					object[key] = HalJS._getKey(key, resource);
				}

				return object;

			}, [])).then(HalJS.toImmutable);
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
			if (HalJS.isVector(resource)) {
				return when(HalJS._getFromVectorOfResources(key, resource));
			} else {
				return when(HalJS._getFromResource(key, resource));
			}
		},

		/**
		 * Get values from multiple resources and flatten them into 1 array
		 *
		 * @param  {String} key
		 * @param  {Vector} resources
		 * @return {Promise}
		 */
		_getFromVectorOfResources: function(key, resources) {
			return when
				.all(resources.toArray().map(HalJS._getFromResource.bind(null, key)))
				.then(HalJS.toImmutable).then(HalJS.flatten);
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

			if (HalJS.isObject(key) || (!HalJS.isEmbedded(key, resource) && HalJS.isLinked(key, resource))) {

				return HalJS._getLink(key, resource);
			}

			if (HalJS.isEmbedded(key, resource)) {
				return HalJS._getEmbed(key, resource);
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
			return resource.get('_embedded').get(key);
		},

		/**
		 * Get a link from a resource
		 * If the response is an array, return array of resources
		 *
		 * @param  {String|Object|Array} key
		 * @param  {JSON} resource
		 * @return {Promise}
		 */
		_getLink: function(key, resource, values) {

			if (HalJS.isObject(key)) {
				return HalJS._getTemplatedLink(key.name, resource, key.values);
			}

			if (HalJS.isVector(resource.get('_links').get(key))) {
				return HalJS._getVectorOfLinks(key, resource, values);
			}

			return HalJS.fetch(resource.get('_links').get(key).get('href'));
		},

		_getVectorOfLinks: function(key, resource, values) {
			return when
				.all(resource.get('_links').get(key).toArray().map(function(link) {
					return HalJS.fetch(link.get('href'));
				}))
				.then(HalJS.toImmutable);
		},

		/**
		 * Get a templated link from a resource
		 *
		 * @param  {Object|Array} key
		 * @param  {JSON} resource
		 * @param  {Object} values
		 * @return {Promise}
		 */
		_getTemplatedLink: function(key, resource, values) {

			if ( HalJS.isArray(values) ) {
				return HalJS._getVectorOfMultipleTemplatedLinks(key, resource, values);
			}

			if (HalJS.isVector(resource.get('_links').get(key))) {
				return HalJS._getVectorOfTemplatedLinks(key, resource, values);
			}

			return HalJS.fetch(HalJS._parseTemplatedLink(resource.get('_links').get(key), values));
		},

		/**
		 * Get a vector with templated links from a resource
		 *
		 * @param  {String} key
		 * @param  {JSON} resource
		 * @param  {Object} values
		 * @return {Promise}
		 */
		_getVectorOfTemplatedLinks: function(key, resource, values) {

			return when
				.all(resource.get('_links').get(key).toArray().map(function(link) {
					return HalJS.fetch(HalJS._parseTemplatedLink(link, values));
				}))
				.then(HalJS.toImmutable);
		},


		/**
		 * Get multiple templated links from a resource
		 *
		 * @param  {Array} key
		 * @param  {JSON} resource
		 * @param  {Object} values
		 * @return {Promise}
		 */
		_getVectorOfMultipleTemplatedLinks: function(key, resource, values) {
			return when.all(values.map(function(values) {

				return HalJS.fetch(HalJS._parseTemplatedLink(resource.get('_links').get(key), values));

			})).then(HalJS.toImmutable);
		},

		/**
		 * Parse a templated link with corresponding values
		 * Returns a string containing the parsed URL
		 *
		 * @param  {Object} link
		 * @param  {Object} values
		 * @return {String}
		 */
		_parseTemplatedLink: function(link, values) {

			var fragments = link.get('href').match(/{([^}]+)}/g);

			return HalJS._reduceObject(fragments, function(link, fragment) {
				fragment = fragment.replace('{', '').replace('}', '');

				if(values[fragment]) {
					link = link.get('href').replace('{' + fragment + '}', values[fragment]);
				}

				return link;
			}, link);
		}
	};

	module.exports = HalJS;
})();