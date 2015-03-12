// Templating
// ---------
wax.template = function(x) {
    var template = {};

    // Clone the data object such that the '__[format]__' key is only
    // set for this instance of templating.
    template.format = function(options, data) {

        // mustache.js has been removed as a dependency
        throw new Error('mustache.js templates are no longer supported');

        // var clone = {};
        // for (var key in data) {
        //     clone[key] = data[key];
        // }
        // if (options.format) {
        //     clone['__' + options.format + '__'] = true;
        // }
        // return wax.u.sanitize(Mustache.to_html(x, clone));
    };

    return template;
};
