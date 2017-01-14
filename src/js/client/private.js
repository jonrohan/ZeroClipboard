/**
 * The real constructor for `ZeroClipboard` client instances.
 * @private
 */
var _clientConstructor = function(elements) {
  // Save a closure reference for the following event handlers
  var meta,
      client = this;

  // Assign an ID to the client instance
  client.id = "" + (_clientIdCounter++);

  // Create the meta information store for this client
  meta = {
    instance: client,
    elements: [],
    handlers: {},
    coreWildcardHandler: function(event) {
      return client.emit(event);
    }
  };
  _clientMeta[client.id] = meta;

  // If the elements argument exists, clip it
  if (elements) {
    client.clip(elements);
  }

  // ECHO! Our client's sounding board.
  ZeroClipboard.on("*", meta.coreWildcardHandler);

  // Await imminent destruction...
  ZeroClipboard.on("destroy", function() {
    client.destroy();
  });

  // Move on: embed the SWF
  ZeroClipboard.create();
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.on`.
 * @private
 */
var _clientOn = function(eventType, listener) {
  var i, len, events,
      added = {},
      client = this,
      meta = _clientMeta[client.id],
      handlers = meta && meta.handlers;

  if (!meta) {
    throw new Error("Attempted to add new listener(s) to a destroyed ZeroClipboard client instance");
  }

  if (typeof eventType === "string" && eventType) {
    events = eventType.toLowerCase().split(/\s+/);
  }
  else if (typeof eventType === "object" && eventType && !("length" in eventType) && typeof listener === "undefined") {
    _keys(eventType).forEach(function(key) {
      var listener = eventType[key];
      if (typeof listener === "function") {
        client.on(key, listener);
      }
    });
  }

  if (events && events.length && listener) {
    for (i = 0, len = events.length; i < len; i++) {
      eventType = events[i].replace(/^on/, "");
      added[eventType] = true;
      if (!handlers[eventType]) {
        handlers[eventType] = [];
      }
      handlers[eventType].push(listener);
    }

    // The following events must be memorized and fired immediately if relevant as they only occur
    // once per Flash object load.

    // If the SWF was already loaded, we're à gogo!
    if (added.ready && _flashState.ready) {
      this.emit({
        type: "ready",
        client: this
      });
    }
    if (added.error) {
      for (i = 0, len = _flashStateErrorNames.length; i < len; i++) {
        if (_flashState[_flashStateErrorNames[i].replace(/^flash-/, "")]) {
          this.emit({
            type: "error",
            name: _flashStateErrorNames[i],
            client: this
          });
          break;
        }
      }
      if (_zcSwfVersion !== undefined && ZeroClipboard.version !== _zcSwfVersion) {
        this.emit({
          type: "error",
          name: "version-mismatch",
          jsVersion: ZeroClipboard.version,
          swfVersion: _zcSwfVersion
        });
      }
    }
  }

  return client;
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.off`.
 * @private
 */
var _clientOff = function(eventType, listener) {
  var i, len, foundIndex, events, perEventHandlers,
      client = this,
      meta = _clientMeta[client.id],
      handlers = meta && meta.handlers;

  if (!handlers) {
    return client;
  }

  if (arguments.length === 0) {
    // Remove ALL of the handlers for ALL event types

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
    //   if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
    //     throw new TypeError('Object.keys called on non-object');
    //   }
    events = _keys(handlers || {});
  }
  else if (typeof eventType === "string" && eventType) {
    events = eventType.split(/\s+/);
  }
  else if (typeof eventType === "object" && eventType && !("length" in eventType) && typeof listener === "undefined") {
    _keys(eventType).forEach(function(key) {
      var listener = eventType[key];
      if (typeof listener === "function") {
        client.off(key, listener);
      }
    });
  }

  if (events && events.length) {
    for (i = 0, len = events.length; i < len; i++) {
      eventType = events[i].toLowerCase().replace(/^on/, "");
      perEventHandlers = handlers[eventType];
      if (perEventHandlers && perEventHandlers.length) {
        if (listener) {
          foundIndex = perEventHandlers.indexOf(listener);
          while (foundIndex !== -1) {
            perEventHandlers.splice(foundIndex, 1);
            foundIndex = perEventHandlers.indexOf(listener, foundIndex);
          }
        }
        else {
          // If no `listener` was provided, remove ALL of the handlers for this event type
          perEventHandlers.length = 0;
        }
      }
    }
  }
  return client;
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.handlers`.
 * @private
 */
var _clientListeners = function(eventType) {
  var copy = null,
      handlers = _clientMeta[this.id] && _clientMeta[this.id].handlers;

  if (handlers) {
    if (typeof eventType === "string" && eventType) {
      copy = handlers[eventType] ? handlers[eventType].slice(0) : [];
    }
    else {
      // Make a deep copy of the handlers object
      copy = _deepCopy(handlers);
    }
  }
  return copy;
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.emit`.
 * @private
 */
var _clientEmit = function(event) {
  var eventCopy,
      client = this;
  if (_clientShouldEmit.call(client, event)) {
    // Don't modify the original Event, if it is an object (as expected)
    if (typeof event === "object" && event && typeof event.type === "string" && event.type) {
      event = _extend({}, event);
    }
    eventCopy = _extend({}, _createEvent(event), { client: client });
    _clientDispatchCallbacks.call(client, eventCopy);
  }
  return client;
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.clip`.
 * @private
 */
var _clientClip = function(elements) {
  if (!_clientMeta[this.id]) {
    throw new Error("Attempted to clip element(s) to a destroyed ZeroClipboard client instance");
  }

  elements = _prepClip(elements);

  for (var i = 0; i < elements.length ; i++) {
    if (_hasOwn.call(elements, i) && elements[i] && elements[i].nodeType === 1) {
      // If the element hasn't been clipped to ANY client yet, add a metadata ID and event handler
      if (!elements[i].zcClippingId) {
        elements[i].zcClippingId = "zcClippingId_" + (_elementIdCounter++);
        _elementMeta[elements[i].zcClippingId] = [this.id];
        if (_globalConfig.autoActivate === true) {
          _addMouseHandlers(elements[i]);
        }
      }
      else if (_elementMeta[elements[i].zcClippingId].indexOf(this.id) === -1) {
        _elementMeta[elements[i].zcClippingId].push(this.id);
      }

      // If the element hasn't been clipped to THIS client yet, add it
      var clippedElements = _clientMeta[this.id] && _clientMeta[this.id].elements;
      if (clippedElements.indexOf(elements[i]) === -1) {
        clippedElements.push(elements[i]);
      }
    }
  }
  return this;
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.unclip`.
 * @private
 */
var _clientUnclip = function(elements) {
  var meta = _clientMeta[this.id];

  if (!meta) {
    return this;
  }

  var clippedElements = meta.elements;
  var arrayIndex;

  // If no elements were provided, unclip ALL of this client's clipped elements
  if (typeof elements === "undefined") {
    elements = clippedElements.slice(0);
  }
  else {
    elements = _prepClip(elements);
  }

  for (var i = elements.length; i--; ) {
    if (_hasOwn.call(elements, i) && elements[i] && elements[i].nodeType === 1) {
      // If the element was clipped to THIS client yet, remove it
      arrayIndex = 0;
      while ((arrayIndex = clippedElements.indexOf(elements[i], arrayIndex)) !== -1) {
        clippedElements.splice(arrayIndex, 1);
      }

      // If the element isn't clipped to ANY other client, remove its metadata ID and event handler
      var clientIds = _elementMeta[elements[i].zcClippingId];
      if (clientIds) {
        arrayIndex = 0;
        while ((arrayIndex = clientIds.indexOf(this.id, arrayIndex)) !== -1) {
          clientIds.splice(arrayIndex, 1);
        }
        if (clientIds.length === 0) {
          if (_globalConfig.autoActivate === true) {
            _removeMouseHandlers(elements[i]);
          }
          delete elements[i].zcClippingId;
        }
      }
    }
  }
  return this;
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.elements`.
 * @private
 */
var _clientElements = function() {
  var meta = _clientMeta[this.id];
  return (meta && meta.elements) ? meta.elements.slice(0) : [];
};


/**
 * The underlying implementation of `ZeroClipboard.Client.prototype.destroy`.
 * @private
 */
var _clientDestroy = function() {
  var meta = _clientMeta[this.id];

  if (!meta) {
    return;
  }

  // Unclip all the elements
  this.unclip();

  // Remove all event handlers
  this.off();

  // Remove the integrated sounding board
  ZeroClipboard.off("*", meta.coreWildcardHandler);

  // Delete the client's metadata store
  delete _clientMeta[this.id];
};




//
// Helper functions
//

/**
 * Inspect an Event to see if the Client (`this`) should honor it for emission.
 * @private
 */
var _clientShouldEmit = function(event) {
  // If no event is received
  if (!(event && event.type)) {
    return false;
  }

  // If this event's `client` was specifically set to a client other than this client, bail out
  if (event.client && event.client !== this) {
    return false;
  }

  // If this event's targeted element(s) is/are not clipped by this client, bail out
  // unless the event's `client` was specifically set to this client.
  var meta = _clientMeta[this.id];
  var clippedEls = meta && meta.elements;
  var hasClippedEls = !!clippedEls && clippedEls.length > 0;
  var goodTarget = !event.target || (hasClippedEls && clippedEls.indexOf(event.target) !== -1);
  var goodRelTarget = event.relatedTarget && hasClippedEls && clippedEls.indexOf(event.relatedTarget) !== -1;
  var goodClient = event.client && event.client === this;

  // At least one of these must be true....
  if (!meta || !(goodTarget || goodRelTarget || goodClient)) {
    return false;
  }

  // Otherwise... go for it!
  return true;
};


/**
 * Handle the actual dispatching of events to a client instance.
 *
 * @returns `undefined`
 * @private
 */
var _clientDispatchCallbacks = function(event) {
  var meta = _clientMeta[this.id];

  if (!(typeof event === "object" && event && event.type && meta)) {
    return;
  }

  var async = _shouldPerformAsync(event);

  // User defined handlers for events
  var wildcardTypeHandlers = (meta && meta.handlers["*"]) || [];
  var specificTypeHandlers = (meta && meta.handlers[event.type]) || [];
  // Execute wildcard handlers before type-specific handlers
  var handlers = wildcardTypeHandlers.concat(specificTypeHandlers);

  if (handlers && handlers.length) {
    var i, len, func, context, eventCopy,
        originalContext = this;
    for (i = 0, len = handlers.length; i < len; i++) {
      func = handlers[i];
      context = originalContext;

      // If the user provided a string for their callback, grab that function
      if (typeof func === "string" && typeof _window[func] === "function") {
        func = _window[func];
      }
      if (typeof func === "object" && func && typeof func.handleEvent === "function") {
        context = func;
        func = func.handleEvent;
      }

      if (typeof func === "function") {
        eventCopy = _extend({}, event);
        _dispatchCallback(func, context, [eventCopy], async);
      }
    }
  }
};


/**
 * Prepares the elements for clipping/unclipping.
 *
 * @returns An Array of elements.
 * @private
 */
var _prepClip = function(elements) {
  // if elements is a string, ignore it
  if (typeof elements === "string") {
    elements = [];
  }
  // if the elements isn't an array, wrap it with one
  return typeof elements.length !== "number" ? [elements] : elements;
};


/**
 * Add a `mouseover` handler function for a clipped element.
 *
 * @returns `undefined`
 * @private
 */
var _addMouseHandlers = function(element) {
  if (!(element && element.nodeType === 1)) {
    return;
  }

  // Create a `mouseout` handler function
  var _suppressMouseEvents = function(event) {
    if (!(event || (event = _window.event))) {
      return;
    }

    // Don't allow this event to be handled by consumers unless it originated from ZeroClipboard
    if (event._source !== "js") {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
    delete event._source;
  };

  // Create a `mouseover` handler function
  var _elementMouseOver = function(event) {
    if (!(event || (event = _window.event))) {
      return;
    }

    // Don't allow this event to be handled by consumers unless it originated from ZeroClipboard
    _suppressMouseEvents(event);

    // Set this as the new currently active element
    ZeroClipboard.focus(element);
  };

  // Add the `mouseover` handler function
  element.addEventListener("mouseover", _elementMouseOver, false);

  // Add other mouse event handler functions
  element.addEventListener("mouseout", _suppressMouseEvents, false);
  element.addEventListener("mouseenter", _suppressMouseEvents, false);
  element.addEventListener("mouseleave", _suppressMouseEvents, false);
  element.addEventListener("mousemove", _suppressMouseEvents, false);

  // Save these function references to a global variable
  _mouseHandlers[element.zcClippingId] = {
    mouseover: _elementMouseOver,
    mouseout: _suppressMouseEvents,
    mouseenter: _suppressMouseEvents,
    mouseleave: _suppressMouseEvents,
    mousemove: _suppressMouseEvents
  };
};


/**
 * Remove a `mouseover` handler function for a clipped element.
 *
 * @returns `undefined`
 * @private
 */
var _removeMouseHandlers = function(element) {
  if (!(element && element.nodeType === 1)) {
    return;
  }

  // Retrieve these function references from a global variable
  var mouseHandlers = _mouseHandlers[element.zcClippingId];
  if (!(typeof mouseHandlers === "object" && mouseHandlers)) {
    return;
  }

  // Remove the mouse event handlers
  var key, val,
      mouseEvents = ["move", "leave", "enter", "out", "over"];
  for (var i = 0, len = mouseEvents.length; i < len; i++) {
    key = "mouse" + mouseEvents[i];
    val = mouseHandlers[key];
    if (typeof val === "function") {
      element.removeEventListener(key, val, false);
    }
  }

  // Delete these function references from a global variable
  delete _mouseHandlers[element.zcClippingId];
};
