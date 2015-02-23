wax = wax || {};

wax.interaction = function() {
    var gm = wax.gm(),
        interaction = {},
        _downLock = false,
        _clickTimeout = null,
        // Active feature
        // Down event
        _d,
        // Touch tolerance
        tol = 4,
        grid,
        attach,
        detach,
        parent,
        map,
        tileGrid,
        // google maps sends touchmove and click at the same time 
        // most of the time when an user taps the screen, see onUp 
        // for more information
        _discardTouchMove = false;

    var defaultEvents = {
        mousemove: onMove,
        touchstart: onDown,
        mousedown: onDown
    };

    var touchEnds = {
        touchend: onUp,
        touchmove: onUp,
        touchcancel: touchCancel
    };

    var mspointerEnds = {
        MSPointerUp: onUp,
        MSPointerMove: onUp,
        MSPointerCancel: touchCancel
    };

    var pointerEnds = {
        pointerup: onUp,
        pointermove: onUp,
        pointercancel: touchCancel
    };

    // Abstract getTile method. Depends on a tilegrid with
    // grid[ [x, y, tile] ] structure.
    function getTile(e) {
        var g = grid();
        var regExp = new RegExp(gm.tileRegexp());
        for (var i = 0; i < g.length; i++) {
            if (e) {
                var isInside = ((g[i][0] <= e.y) &&
                     ((g[i][0] + 256) > e.y) &&
                      (g[i][1] <= e.x) &&
                     ((g[i][1] + 256) > e.x));
                if(isInside && regExp.exec(g[i][2].src)) {
                    return g[i][2];
                }
            }
        }
        return false;
    }

    // Clear the double-click timeout to prevent double-clicks from
    // triggering popups.
    function killTimeout() {
        if (_clickTimeout) {
            window.clearTimeout(_clickTimeout);
            _clickTimeout = null;
            return true;
        } else {
            return false;
        }
    }

    function onMove(e) {
        // If the user is actually dragging the map, exit early
        // to avoid performance hits.
        if (_downLock) return;

        var _e = (e.type !== "MSPointerMove" && e.type !== "pointermove" ? e : e.originalEvent);
        var pos = wax.u.eventoffset(_e);

        interaction.screen_feature(pos, function(feature) {
            if (feature) {
                bean.fire(interaction, 'on', {
                    parent: parent(),
                    data: feature,
                    formatter: gm.formatter().format,
                    e: e
                });
            } else {
                bean.fire(interaction, 'off');
            }
        });
    }

    // A handler for 'down' events - which means `mousedown` and `touchstart`
    function onDown(e) {

        // Prevent interaction offset calculations happening while
        // the user is dragging the map.
        //
        // Store this event so that we can compare it to the
        // up event
        _downLock = true;
        var _e = (e.type !== "MSPointerDown" && e.type !== "pointerdown" ? e : e.originalEvent); 
        _d = wax.u.eventoffset(_e);
        if (e.type === 'mousedown') {
            bean.add(document.body, 'click', onUp);
            // track mouse up to remove lockDown when the drags end
            bean.add(document.body, 'mouseup', dragEnd);

        // Only track single-touches. Double-touches will not affect this
        // control
        } else if (e.type === 'touchstart' && e.touches.length === 1) {
            //GMaps fix: Because it's triggering always mousedown and click, we've to remove it
            bean.remove(document.body, 'click', onUp); //GMaps fix

            //When we finish dragging, then the click will be 
            bean.add(document.body, 'click', onUp);
            bean.add(document.body, 'touchEnd', dragEnd);
        } else if (e.originalEvent.type === "MSPointerDown" && e.originalEvent.touches && e.originalEvent.touches.length === 1) {
          // Don't make the user click close if they hit another tooltip
            bean.fire(interaction, 'off');
            // Touch moves invalidate touches
            bean.add(parent(), mspointerEnds);
        } else if (e.type === "pointerdown" && e.originalEvent.touches && e.originalEvent.touches.length === 1) {
            // Don't make the user click close if they hit another tooltip
            bean.fire(interaction, 'off');
            // Touch moves invalidate touches
            bean.add(parent(), pointerEnds);
        } else {
            // Fix layer interaction in IE10/11 (CDBjs #139)
            // Reason: Internet Explorer is triggering pointerdown when you click on the marker, and other browsers don't.
            // Because of that, _downLock was active and it believed that you're dragging the map, instead of dragging the marker
            _downLock = false;
        }

    }

    function dragEnd() {
        _downLock = false;
    }

    function touchCancel() {
        bean.remove(parent(), touchEnds);
        bean.remove(parent(), mspointerEnds);
        bean.remove(parent(), pointerEnds);
        _downLock = false;
    }

    function onUp(e) {
        var evt = {};
        var _e = (e.type !== "MSPointerMove" && e.type !== "MSPointerUp" && e.type !== "pointerup" && e.type !== "pointermove" ? e : e.originalEvent);
        var pos = wax.u.eventoffset(_e);
        _downLock = false;

        for (var key in _e) {
          evt[key] = _e[key];
        }

        // for (var key in e) {
        //   evt[key] = e[key];
        // }

        bean.remove(document.body, 'mouseup', onUp);
        bean.remove(parent(), touchEnds);
        bean.remove(parent(), mspointerEnds);
        bean.remove(parent(), pointerEnds);

        if (e.type === 'touchend') {
            // If this was a touch and it survived, there's no need to avoid a double-tap
            // but also wax.u.eventoffset will have failed, since this touch
            // event doesn't have coordinates
            interaction.click(e, _d);
        } else if (pos && _d) {
          // If pos is not defined means wax can't calculate event position,
          // So next cases aren't possible.

          if (evt.type === "MSPointerMove" || evt.type === "MSPointerUp") {
            evt.changedTouches = [];
            interaction.click(evt, pos);
          } else if (evt.type === "pointermove" || evt.type === "pointerup") {
            interaction.click(evt, pos);
          } else if (Math.round(pos.y / tol) === Math.round(_d.y / tol) &&
            Math.round(pos.x / tol) === Math.round(_d.x / tol)) {
            // if mousemove and click are sent at the same time this code
            // will not trigger click event because less than 150ms pass between
            // those events.
            // Because of that this flag discards touchMove
            if (_discardTouchMove && evt.type === 'touchmove') return onUp;
            // Contain the event data in a closure.
            // Ignore double-clicks by ignoring clicks within 300ms of
            // each other.
            if(!_clickTimeout) {
              _clickTimeout = window.setTimeout(function() {
                  _clickTimeout = null;
                  interaction.click(evt, pos);
              }, 150);
            } else {
              killTimeout();
            }
          }

        }

        return onUp;
    }

    interaction.discardTouchMove = function(_) {
      if (!arguments.length) return _discardTouchMove;
      _discardTouchMove = _;
      return interaction;
    }

    // Handle a click event. Takes a second
    interaction.click = function(e, pos) {
        interaction.screen_feature(pos, function(feature) {
            if (feature) bean.fire(interaction, 'on', {
                parent: parent(),
                data: feature,
                formatter: gm.formatter().format,
                e: e
            });
        });
    };

    interaction.screen_feature = function(pos, callback) {
        var tile = getTile(pos);
        if (!tile) callback(null);
        gm.getGrid(tile.src, function(err, g) {
            if (err || !g) return callback(null);
            var feature = g.tileFeature(pos.x, pos.y, tile);
            callback(feature);
        });
    };

    // set an attach function that should be
    // called when maps are set
    interaction.attach = function(x) {
        if (!arguments.length) return attach;
        attach = x;
        return interaction;
    };

    interaction.detach = function(x) {
        if (!arguments.length) return detach;
        detach = x;
        return interaction;
    };

    // Attach listeners to the map
    interaction.map = function(x) {
        if (!arguments.length) return map;
        map = x;
        if (attach) attach(map);
        bean.add(parent(), defaultEvents);
        bean.add(parent(), 'touchstart', onDown);
        bean.add(parent(), 'MSPointerDown', onDown);
        bean.add(parent(), 'pointerdown', onDown);
        return interaction;
    };

    // set a grid getter for this control
    interaction.grid = function(x) {
        if (!arguments.length) return grid;
        grid = x;
        return interaction;
    };

    // detach this and its events from the map cleanly
    interaction.remove = function(x) {
        if (detach) detach(map);
        bean.remove(parent(), defaultEvents);
        bean.fire(interaction, 'remove');
        return interaction;
    };

    // get or set a tilejson chunk of json
    interaction.tilejson = function(x) {
        if (!arguments.length) return gm.tilejson();
        gm.tilejson(x);
        return interaction;
    };

    // return the formatter, which has an exposed .format
    // function
    interaction.formatter = function() {
        return gm.formatter();
    };

    // ev can be 'on', 'off', fn is the handler
    interaction.on = function(ev, fn) {
        bean.add(interaction, ev, fn);
        return interaction;
    };

    // ev can be 'on', 'off', fn is the handler
    interaction.off = function(ev, fn) {
        bean.remove(interaction, ev, fn);
        return interaction;
    };

    // Return or set the gridmanager implementation
    interaction.gridmanager = function(x) {
        if (!arguments.length) return gm;
        gm = x;
        return interaction;
    };

    // parent should be a function that returns
    // the parent element of the map
    interaction.parent  = function(x) {
        parent = x;
        return interaction;
    };

    return interaction;
};
