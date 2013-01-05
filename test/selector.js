"use strict";

require("./env")

var zeroClipboard, clip;
exports.selector = {

  setUp: function (callback) {
    zeroClipboard = require("../ZeroClipboard");
    clip = new zeroClipboard.Client();
    callback();
  },

  tearDown: function (callback) {
    zeroClipboard.destroy();
    callback();
  },

  "$ returns an element": function (test) {

    // grabbed the right id
    test.equal(zeroClipboard.$("#d_clip_button")[0].id, "d_clip_button")

    // grabbed 5 buttons
    test.equal(zeroClipboard.$(".my_clip_button").length, 5)

    // found the body
    test.ok(zeroClipboard.$("body").length)
    
    // grabbed 1 button when context present
    // var context = document.getElementById('d_clip_container2')
    // test.equal(zeroClipboard.$(".my_clip_button", context).length, 1)
    // test.equal(zeroClipboard.$(".my_clip_button", context)[0].id, "d_clip_button2")

    // didn't find anything
    test.ok(!zeroClipboard.$("bodyd").length)

    test.done();
  },

  "$.addClass works as expected": function (test) {

    var elm = zeroClipboard.$("#d_clip_button")[0]

    // element isn't null
    test.ok(elm)

    test.equal(typeof elm.addClass, "function")
    elm.addClass("test-class")
    elm.addClass("test-class")
    test.notEqual(elm.className.indexOf("test-class"), -1)
    test.equal(elm.className.indexOf("test-class test-class"), -1)

    test.done();
  },

  "$.removeClass works as expected": function (test) {

    var elm = zeroClipboard.$("#d_clip_button")[0]

    // element isn't null
    test.ok(elm)

    test.equal(typeof elm.removeClass, "function")

    elm.addClass("test-class")
    test.notEqual(elm.className.indexOf("test-class"), -1)
    elm.removeClass("test-class")
    test.equal(elm.className.indexOf("test-class"), -1)

    test.done();
  }
};