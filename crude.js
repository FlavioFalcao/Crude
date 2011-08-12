/**
 * @preserve Copyright (c) 2011, Vladimir Agafonkin, CloudMade
 * Crude is a clever JavaScript library for working with RESTful services.
 * See https://github.com/CloudMade/Crude for more information.
 */

(function (global, undefined) {
	"use strict";

	var Crude = {},
	    oldCrude = global.Crude;

	if (typeof module != 'undefined' && module.exports) {
		module.exports = Crude;
	} else {
		global.Crude = Crude;
	}

	// restores the original global Crude property
	Crude.noConflict = function () {
		global.Crude = oldCrude;
		return this;
	};


	// classical inheritance for internal use
	Crude.inherit = function (Child, Parent) {
		function F() {}
		F.prototype = Parent.prototype;

		var proto = new F();
		proto.constructor = Child;
		Child.prototype = proto;
	};


	Crude.api = function (baseUrl, format, requestFn) {
		return new Crude.Api(baseUrl, format, requestFn);
	};


	// the root class of the API (handles basic configuration)

	Crude.Api = function (baseUrl, format, requestFn) {
		this._baseUrl = baseUrl;
		this._format = format;
		this._requestFn = requestFn;
	};

	Crude.Api.prototype = {
		request: function (path, method, data) {
			if (!data && typeof method != 'string') {
				data = method;
				method = 'get';
			}
			data = data || {};

			var url = this._baseUrl + '/' + path + '.' + this._format;

			url = Crude.template(url, data);

			return this._requestFn(url, method, data);
		},

		resources: function (name, pluralName) {
			pluralName = pluralName || Crude.pluralize(name);
			var resources = this[pluralName] = new Crude.Resources(this, name, pluralName);
			return resources;
		}
	};


	// the class where most of the magic happens (all the REST stuff)

	Crude.Resources = function (api, name, pluralName, prefix) {
		this._api = api;
		this._name = name;
		this._pluralName = pluralName;
		this._prefix = prefix;
	};

	Crude.Resources.prototype = {
		request: function (path, method, data) {
			var prefix = (this._prefix ? this._prefix + '/' : ''),
			    postfix = (path ? '/' + path : '');

			return this._api.request(prefix + this._pluralName + postfix, method, data);
		},

		get: function (id, data) {
			if (!data && typeof id == 'object') {
				data = id;
				id = null;
			}
			return this.request(id || '', 'get', data);
		},

		create: function (props, data) {
			props = Crude.wrapKeys(props, this._name);
			data = Crude.extend({}, data, props);

			return this.request('', 'post', data);
		},

		update: function (id, props, data) {
			props = Crude.wrapKeys(props, this._name);
			data = Crude.extend({}, data, props);

			return this.request(id, 'put', data);
		},

		del: function (id, data) {
			return this.request(id, 'delete', data);
		},

		belongTo: function (parent) {
			var methodName = 'in' + Crude.capitalize(parent._name);
			this[methodName] = function (id) {
				function NestedResources() {
					Crude.NestedResources.apply(this, arguments);
				}
				Crude.inherit(NestedResources, Crude.NestedResources);

				var protoAccessorName = parent._name + Crude.capitalize(this._pluralName);
				this._api[protoAccessorName] = NestedResources.prototype;

				var prefix = parent._pluralName + '/' + id;
				return new NestedResources(this._api, this._name, this._pluralName, prefix);
			};
			return this;
		},

		memberAction: function (name, options) {
			// options: path, method, argsToDataFn
			// TODO member action
			return this;
		},

		collectionAction: function (name, options) {
			// TODO collection action
			return this;
		}
	};


	// create a Resources-inherited class to allow extending nested resources globally
	Crude.NestedResources = function () {
		Crude.Resources.apply(this, arguments);
	};
	Crude.inherit(Crude.NestedResources, Crude.Resources);


	// various utility functions

	// feel free to add more rules from outside
	Crude.pluralRules = [[/$/, 's'],
	                     [/s$/i, 's'],
	                     [/(?:([^f])fe|([lr])f)$/i, '$1$2ves'],
	                     [/([^aeiouy]|qu)y$/i, '$1ies'],
	                     [/(x|ch|s|sh)$/i, '$1es'],
	                     ['child', 'children']];

	Crude.pluralize = function (name) {
		var rules = Crude.pluralRules,
		    i = rules.length,
		    rule;

		while (i--) {
			rule = rules[i];
			if (typeof rule[0] == 'string') {
				if (name == rule[0]) {
					return rule[1];
				}
			} else {
				if (rule[0].test(name)) {
					return name.replace(rule[0], rule[1]);
				}
			}
		}
		return name;
	};

	Crude.capitalize = function (str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	};

	Crude.extend = function (dest) {
		var sources = Array.prototype.slice.call(arguments, 1),
		    len = sources.length,
		    src, i, j;

		for (j = 0; j < len; j++) {
			src = sources[j] || {};
			for (i in src) {
				if (src.hasOwnProperty(i)) {
					dest[i] = src[i];
				}
			}
		}
		return dest;
	};

	// turns {foo: 'bar'} into {'property[foo]': 'bar'}
	Crude.wrapKeys = function (props, name) {
		var obj = {}, i;
		for (i in props) {
			if (props.hasOwnProperty(i)) {
				obj[name + '[' + i + ']'] = props[i];
			}
		}
		return obj;
	};

	// Crude.template("Hello {foo}", {foo: "World"}) -> "Hello world"
	Crude.template = function(str, data) {
		return str.replace(/\{ *([^} ]+) *\}/g, function (a, key) {
			if (!(key in data)) {
				throw new Error('No value provided for variable: ' + key);
			}
			var value = data[key];
			delete data[key];
			return value;
		});
	};

}(this));