window.ZeroClipboard = ZeroClipboard; // Needed to communicate with swf
if (typeof module !== "undefined") {
  module.exports = ZeroClipboard;
} else if (typeof define === "function" && define.amd) {
  define(function() {
    return ZeroClipboard;
  });
}

})();
