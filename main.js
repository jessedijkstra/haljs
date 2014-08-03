(function() {
	'use strict';


	var HalJS = require('./hal.js');

	// Custom implementation of reqwest that doesn't include X-Requested-With header
	var reqwest = require('./reqwest.js');

	// When
	var when = require('./node_modules/when/when');

	// Immutable
	var Immutable = require('./node_modules/immutable/dist/Immutable');


	// Include keys
	when.keys = require('./node_modules/when/keys');

	// Setup ajax
	HalJS.ajax = reqwest;

	HalJS.ajaxOptions = {
		type: 'json',
		crossDomain: true,
		contentType: 'application/json; charset=utf-8',
		accept: 'application/hal+json'
	};

	//
	// Immutable
	//

	// Fetch api
	var immutableApi = HalJS.fetch('https://static.blendle.nl/api.json', true);

	immutableApi
		.then(function(api) {

			console.log('%c Fetch API', 'background-color: #0f0; padding: 5px; display: block;');

			console.log(api.toJSON());

			console.log('');
		}).done();


	// Fetch user with id 'jesse'
	immutableApi
		.fold(HalJS.get, {name: 'user', values: {user_id: 'jesse'}})
		.then(function(user) {

			console.log('%c Fetch users with id "jesse"', 'background-color: #0f0; padding: 5px; display: block;');

			console.log(user.toJSON());

			console.log('');

		})
		.done();

	// Fetch users with id 'jesse' and 'pepijn'
	immutableApi
		.fold(HalJS.get, [
			{name: 'user', values: [{user_id: 'jesse'}, {user_id: 'pepijn'}]},
		])
		.then(function(user) {

			console.log('%c Fetch users with id "jesse" and "pepijn"', 'background-color: #0f0; padding: 5px; display: block;');

			console.log(user.toJSON());

			console.log('');

		})
		.done();


	// Fetch both provider_categories and provider_configurations
	immutableApi
		.fold(HalJS.get, ['provider_categories', 'provider_configurations'])
		.then(function(resources) {

			console.log('%c Fetch Providers Categories and Configurations and display categories with provider names', 'background-color: #0f0; padding: 5px; display: block;');

			HalJS.get('configurations', resources.get('provider_configurations')).then(function(configurations) {

				resources.get('provider_categories').get('categories').forEach(function(category) {

					console.log('%c' + category.get('name'), 'color: #00f');

					console.log(category.get('providers').map(function(provider) {
						return configurations
							.filter(function(configuration) {
								return configuration.get('id') === provider;
							})
							.first()
							.get('name')
					}).toArray());

				});

				console.log('');

			});

		})
		.done();



	// Fetch Publications, then Categories, then Issues, and display covers of the issues
	immutableApi
		.fold(HalJS.get, 'publications')
		.fold(HalJS.get, 'categories')
		.fold(HalJS.get, 'issues')
		.then(function(issues) {

			console.log('%c Fetch Publications, then Categories, then Issues, and display covers of the issues', 'background-color: #0f0; padding: 5px; display: block;');

			issues.forEach(function(issue) {
				console.log(issue.get('_links').get('page_preview').get('href'));
			});

			console.log('');

		})
		.done();

	// Fetch the amount of times a provider is currently published in the kiosk
	immutableApi
		.then(function(api) {
			return when.keys.all({
				providers: HalJS.get('provider_configurations', api).fold(HalJS.get, 'configurations'),
				issues: HalJS.get('publications', api)
					.fold(HalJS.get, 'categories')
					.fold(HalJS.get, 'issues')
			}).then(HalJS.toImmutable);
		}).then(function(values) {
			console.log('%c Fetch the amount of times a provider is current published in the kiosk among different categories', 'background-color: #0f0; padding: 5px; display: block;');

			values.get('providers').forEach(function(provider) {

				var issues = values.get('issues').filter(function(issue) {
					return issue.get('provider').get('id') === provider.get('id');
				});

				console.log(provider.get('name') + ': ' + issues.toJSON().length);
			});

			console.log('');
		}).done();

	immutableApi
		.fold(HalJS.invalidate, 'provider_configurations')
		.fold(HalJS.get, 'provider_configurations')
		.then(function(data) {

			console.log('%c Invalidate provider_configurations and refetch it', 'background-color: #0f0; padding: 5px; display: block;');

			console.log(data.toJSON());

			console.log('');
		});

	immutableApi
		.fold(HalJS.invalidate, ['provider_categories', 'provider_configurations'])
		.fold(HalJS.get, ['provider_categories', 'provider_configurations'])
		.then(function(data) {
			console.log('%c Invalidate provider_configurations and providers_categories and refetch it', 'background-color: #0f0; padding: 5px; display: block;');

			console.log(data.toJSON());

			console.log('');
		});
})();