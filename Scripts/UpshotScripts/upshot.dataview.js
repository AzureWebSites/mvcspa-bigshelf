﻿// Copyright (c) Microsoft.  All rights reserved.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
// files (the "Software"), to deal  in the Software without restriction, including without limitation the rights  to use, copy,
// modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR  IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY,  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

///
/// upshot.dataview.js
///

(function (global, $, upshot, undefined)
{
    var dataSourceEvents = ["refreshStart", "refreshSuccess", "refreshError", "commitStart", "commitSuccess", "commitError", "entityStateChanged", "refreshNeeded"];

    function normalizeSort(sort) {
        if (!sort || $.isFunction(sort)) {
            return sort;
        }

        if (upshot.isArray(sort)) {
            return $.map(sort, function (item) {
                var descending = item.charAt(0) === "-";
                var property = descending ? item.substr(1) : item;
                return { property: property, descending: descending };
            });
        }

        var descending = sort.charAt(0) === "-";
        var property = descending ? sort.substr(1) : sort;
        return { property: property, descending: descending };
    }

    function normalizeFilter(filter) {
        if (!filter) {
            return filter;
        }

        filter = upshot.isArray(filter) ? filter : [filter];
        var filters = [];
        for (var i = 0; i < filter.length; i++) {
            var filterPart = filter[i];
            if (!$.isFunction(filterPart)) {
                for (var filterProperty in filterPart) {
                    if (filterPart.hasOwnProperty(filterProperty)) {
                        var filterValue = filterPart[filterProperty];
                        if (filterValue && filterValue.hasOwnProperty("value")) {
                            filters.push({ property: filterProperty, operator: filterValue.operator, value: filterValue.value });
                        } else {
                            filters.push({ property: filterProperty, value: filterValue });
                        }
                    }
                }
            } else {
                filters.push(filterPart);
            }
        }
        return filters;
    }

    function normalizePaging(paging) {
        return paging && { skip: paging.offset, take: paging.limit, includeTotalCount: !!paging.includeTotalCount };
    }

    var queryOptions = {
        paging: { setter: "setPaging", normalize: normalizePaging },
        filter: { setter: "setFilter", normalize: normalizeFilter },
        sort: { setter: "setSort", normalize: normalizeSort }
    };

    $.widget("upshot.dataview", $.ui.dataview, {

        _create: function () {
            var that = this;
            this.widgetEventPrefix = "dataview";
            this.options.source = function (request, success, error) {
                that.dataSource.refresh(request.refreshOptions, success, error);
            };
        },

        _init: function () {
            this._super("_init");
            this.dataSource = this._createDataSource();
            this.result = this.dataSource.getEntities();

            var that = this;
            var observer = {};
            $.each(dataSourceEvents, function (unused, name) {
                observer[name] = function () {
                    $(that).trigger(name, arguments);
                };
            });
            this._observer = observer;
            this.dataSource.bind(observer);

            var slice = Array.prototype.slice;
            $.each(["commitChanges", "revertUpdates", "revertChanges"], function (unused, key) {
                if (that.dataSource[key]) {
                    that[key] = function () {
                        return that.dataSource[key].apply(that.dataSource, $.map(slice.call(arguments), function (arg) {
                            return $.proxy(arg, that) || arg;
                        }));
                    }
                }
            });
        },

        _destroy: function () {
            if (this._observer) {
                this.dataSource.unbind(this._observer);
                this._observer = null;
            }
            this._super("_destroy");
        },

        _setOption: function (key, value) {
            var query = queryOptions[key];
            if (query) {
                this.dataSource[query.setter](query.normalize(value));
            } else {
                this.dataSource.option(key, value && $.inArray(key, dataSourceEvents) >= 0 ? $.proxy(value, this) : value);
            }
            this._super("_setOption", key, value);
        }

    });

    $.widget("upshot.remoteDataview", $.upshot.dataview, {

        _createDataSource: function () {
            var options = {};
            for (var key in this.options) {
                var query = queryOptions[key];
                if (query) {
                    options[key] = query.normalize(this.options[key]);
                } else if (key !== "source") {
                    options[key] = $.inArray(key, dataSourceEvents) >= 0 ? $.proxy(this.options[key], this) : this.options[key];
                }
            }
            options.result = options.result || this.result;
            return new upshot.RemoteDataSource(options);
        }

    });

    $.widget("upshot.localDataview", $.upshot.dataview, {

        _createDataSource: function () {
            var options = {};
            for (var key in this.options) {
                var query = queryOptions[key];
                if (query) {
                    options[key] = query.normalize(this.options[key]);
                } else if (key === "input") {
                    if ($.isArray(this.options.input)) {
                        options.source = this.options.input;
                    } else {
                        options.source = this.options.input.dataSource;
                    }
                } else if (key !== "source") {
                    options[key] = $.inArray(key, dataSourceEvents) >= 0 ? $.proxy(this.options[key], this) : this.options[key];
                }
            }
            options.result = options.result || this.result;
            return new upshot.LocalDataSource(options);
        }

    });

}
)(this, jQuery, upshot);

