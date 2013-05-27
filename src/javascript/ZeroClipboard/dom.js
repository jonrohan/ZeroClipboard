/*
 * Find or create an htmlBridge and flashBridge for the client.
 *
 * returns nothing
 */
var _bridge = function () {
  var client = ZeroClipboard.prototype._singleton;
  // try and find the current global bridge
  var container = document.getElementById("global-zeroclipboard-html-bridge");

  if (!container) {
    var html = "\
      <object id=\"global-zeroclipboard-flash-bridge\" type=\"application/x-shockwave-flash\" data=\"" + client.options.moviePath + _noCache(client.options.moviePath) + "\" style=\"width:100%;height:100%\"> \
        <param name=\"allowScriptAccess\" value=\"" + client.options.allowScriptAccess +  "\"/> \
        <param name=\"movie\" value=\"" + client.options.moviePath + _noCache(client.options.moviePath) + "\"/> \
        <param name=\"scale\" value=\"noscale\"/> \
        <param name=\"loop\" value=\"false\"/> \
        <param name=\"menu\" value=\"false\"/> \
        <param name=\"quality\" value=\"best\"/> \
        <param name=\"wmode\" value=\"transparent\"/> \
        <param name=\"FlashVars\" value=\"" + _vars(client.options) + "\"/> \
      </object>";

    container = document.createElement("div");
    container.id = "global-zeroclipboard-html-bridge";
    container.setAttribute("class", "global-zeroclipboard-container");
    container.setAttribute("data-clipboard-ready", false);
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "15px";
    container.style.height = "15px";
    container.style.zIndex = "9999";
    container.innerHTML = html;
    document.body.appendChild(container);
  }

  client.htmlBridge = container;
  client.flashBridge = document["global-zeroclipboard-flash-bridge"] || container.children[0].lastElementChild;
};

/*
 * Reset the html bridge to be hidden off screen and not have title or text.
 *
 * returns nothing
 */
ZeroClipboard.prototype.resetBridge = function () {
  this.htmlBridge.style.left = "-9999px";
  this.htmlBridge.style.top = "-9999px";
  this.htmlBridge.removeAttribute("title");
  this.htmlBridge.removeAttribute("data-clipboard-text");
  _removeClass(currentElement, this.options.activeClass);
  currentElement = null;
  this.options.text = null;
};

/*
 * Helper function to determine if the flash bridge is ready. Gets this info from
 * a data-clipboard-ready attribute on the global html element.
 *
 * returns true if the flash bridge is ready
 */
ZeroClipboard.prototype.ready = function () {
  // I don't want to eval() here
  var ready = this.htmlBridge.getAttribute("data-clipboard-ready");
  return ready === "true" || ready === true;
};

/*
 * Reposition the flash object, if the page size changes.
 *
 * returns nothing
 */
ZeroClipboard.prototype.reposition = function () {

  // If there is no currentElement return
  if (!currentElement) return false;

  var pos = _getDOMObjectPosition(currentElement);

  // new css
  this.htmlBridge.style.top    = pos.top + "px";
  this.htmlBridge.style.left   = pos.left + "px";
  this.htmlBridge.style.width  = pos.width + "px";
  this.htmlBridge.style.height = pos.height + "px";
  this.htmlBridge.style.zIndex = pos.zIndex + 1;

  this.setSize(pos.width, pos.height);
};
