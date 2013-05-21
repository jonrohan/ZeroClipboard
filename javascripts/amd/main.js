(function() {

  requirejs.config({
    // `baseUrl` is the dir containing this file ("main.js"): "javascripts/amd/"

    // paths are relative to the aforementioned `baseUrl`
    paths: {
      "ZeroClipboard": "ZeroClipboard_1.2.0-beta.1",
      "jquery":        "vendor/jquery",
      "domReady":      "vendor/requirejs-plugins/domReady"
    }
  });
  
  // Define the main module
  define(["ZeroClipboard", "jquery", "domReady!"], function(ZeroClipboard, $) {

    // Configure the root ZeroClipboard object for AMD
    ZeroClipboard.setDefaults({

      // The AMD module name or path associated with the ZeroClipboard object.
      // Could also use "../ZeroClipboard" instead (assuming the GLOBAL require's
      // `baseUrl` configuration does not change).
      // This MUST be set to enable support for event dispatching while using AMD!
      //
      // Defaults to: `null`.
      amdModuleId: "ZeroClipboard",

      // The path must be relative to the PAGE, NOT to the current AMD module!
      // Or, it could be an absolute path on the domain, e.g.:
      //  - "/javascripts/ZeroClipboard.swf"
      // Or, it could be an absolute URL to anywhere, e.g.:
      //  - "//" + window.location.host + "/javascripts/ZeroClipboard.swf"
      //  - "//localhost:3000/javascripts/ZeroClipboard.swf"
      //  - "//my.awesomecdn.com/javascripts/ZeroClipboard.swf"
      //  - "http://my.awesomecdn.com/javascripts/ZeroClipboard.swf"
      moviePath: "javascripts/amd/ZeroClipboard_1.2.0-beta.1.swf"

    });


    var clip = new ZeroClipboard($("#d_clip_button"));

    clip.on("load", function (client) {
      debugstr("Flash movie loaded and ready.");
    });

    clip.on("noFlash", function (client) {
      $(".demo-area").hide();
      debugstr("Your browser has no Flash.");
    });

    clip.on("wrongFlash", function (client, args) {
      $(".demo-area").hide();
      debugstr("Flash 10.0.0+ is required but you are running Flash " + args.flashVersion.replace(/,/g, "."));
    });

    clip.on("complete", function (client, args) {
      debugstr("Copied text to clipboard: " + args.text);
    });

    // jquery stuff (optional)
    function debugstr(text) {
      $("#d_debug").append($("<p>").text(text));
    }

    $("#clear-test").on("click", function () {
      $("#fe_text").val("Copy me!");
      $("#testarea").val("");
    });

  });

})();
