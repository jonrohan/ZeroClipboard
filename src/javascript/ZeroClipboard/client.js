/*
 * Creates a new ZeroClipboard client; optionally, from an element or array of elements.
 *
 * returns the client instance if it's already created
 */
var ZeroClipboard = function (elements, /** @deprecated */ options) {

  // If the elements exist glue
  if (elements) (ZeroClipboard.prototype._singleton || this).glue(elements);

  // If there's a client already, return the singleton
  if (ZeroClipboard.prototype._singleton) return ZeroClipboard.prototype._singleton;

  ZeroClipboard.prototype._singleton = this;

  // Warn about use of deprecated constructor signature
  if (options) {
    _deprecationWarning("new ZeroClipboard(elements, options)", this.options.debug);
  }

  // Set and override the defaults
  this.options = _extend({}, _defaults, options);

  // event handlers
  this.handlers = {};

  // Flash status
  if (typeof flashState.global.noflash !== "boolean") {
    flashState.global.noflash = !_detectFlashSupport();
  }
  if (!flashState.clients.hasOwnProperty(this.options.moviePath)) {
    flashState.clients[this.options.moviePath] = {
      ready: false
    };
  }

  // Setup the Flash <-> JavaScript bridge
  if (flashState.global.noflash === false) {
    _bridge();
  }

};


/*
 * Sets the current html object that the flash object should overlay.
 * This will put the global flash object on top of the current object and set
 * the text and title from the html object.
 *
 * returns object instance
 */
ZeroClipboard.prototype.setCurrent = function (element) {

  // What element is current
  currentElement = element;

  _reposition.call(this);

  // If the dom element has a title
  var titleAttr = element.getAttribute("title");
  if (titleAttr) {
    this.setTitle(titleAttr);
  }

  // If the element has a pointer style, set to hand cursor
  var useHandCursor = this.options.forceHandCursor === true || _getStyle(element, "cursor") === "pointer";
  // Update the hand cursor state without updating the `forceHandCursor` option
  _setHandCursor.call(this, useHandCursor);

  return this;
};

/*
 * Sends a signal to the flash object to set the clipboard text.
 *
 * returns object instance
 */
ZeroClipboard.prototype.setText = function (newText) {
  if (newText && newText !== "") {
    this.options.text = newText;
    if (this.ready()) this.flashBridge.setText(newText);
  }

  return this;
};

/*
 * Adds a title="" attribute to the htmlBridge to give it tooltip capabiities
 *
 * returns object instance
 */
ZeroClipboard.prototype.setTitle = function (newTitle) {
  if (newTitle && newTitle !== "") this.htmlBridge.setAttribute("title", newTitle);

  return this;
};

/*
 * Sends a signal to the flash object to change the stage size.
 *
 * returns object instance
 */
ZeroClipboard.prototype.setSize = function (width, height) {
  if (this.ready()) this.flashBridge.setSize(width, height);

  return this;
};

/*
 * Sends an emulated click event provided with a token to emulate a click securely
 *
 * returns object instanace
 */
ZeroClipboard.prototype.emulateClick = function (token) {
  if (!token) {
    console.error('A Token must be provided to emulate a click');
  }
  else {
    if (this.ready()) this.flashBridge.emulateClick(token);
  }
  return this;
};

/*
 * @private
 *
 * Sends a signal to the flash object to display the hand cursor if true.
 * Does NOT update the value of the `forceHandCursor` option.
 *
 * returns nothing
 */
var _setHandCursor = function (enabled) {
  if (this.ready()) this.flashBridge.setHandCursor(enabled);
};
