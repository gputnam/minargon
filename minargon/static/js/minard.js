// from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
var url_params;
(window.onpopstate = function () {
    var match,
        pl = /\+/g, // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function(s) { return decodeURIComponent(s.replace(pl, " ")); },
        query = window.location.search.substring(1);

        url_params = {};
        while (match = search.exec(query))
            url_params[decode(match[1])] = decode(match[2]);
})();
