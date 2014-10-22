package {

  import flash.external.ExternalInterface;
  import flash.net.navigateToURL;
  import flash.net.URLRequest;


  /**
   * An abstraction for communicating with JavaScript from Flash.
   */
  internal class JsProxy {
    private static const PROXIED_CALLBACK_PREFIX:String = "__proxied__";
    private var hosted:Boolean = false;
    private var bidirectional:Boolean = false;
    private var disabled:Boolean = false;
    private var fidelityEnsured:Boolean = false;

    public var fidelityUtils:Object =  // NOPMD
      {
        testCounter: 0,
        patches: {
          call: {
            parameters: null,
            returnValue: null
          },
          addCallback: {
            parameters: null,
            returnValue: null
          }
        },
        jsEscapingFn:
          function(jsFuncName:String): String {
            return [
              '  function ' + jsFuncName + '(data) {',
              '    if (typeof data === "string" && data.length > 0) {',
              '      data = data.replace(/\\\\/g, "\\\\\\\\");',
              '    }',
              '    else if (typeof data === "object" && data.length > 0) {',
              '      for (var i = 0; i < data.length; i++) {',
              '        data[i] = ' + jsFuncName + '(data[i]);',
              '      }',
              '    }',
              '    else if (typeof data === "object" && data != null) {',
              '      for (var prop in data) {',
              '        if (data.hasOwnProperty(prop)) {',
              '          data[prop] = ' + jsFuncName + '(data[prop]);',
              '        }',
              '      }',
              '    }',
              '    return data;',
              '  }'
            ].join('\n');
          }
        };


    /**
     * @constructor
     */
    public function JsProxy(expectedObjectId:String = null) {
      // The JIT Compiler does not compile constructors, so any
      // cyclomatic complexity higher than 1 is discouraged.
      this.ctor(expectedObjectId);
    }


    /**
     * The real constructor.
     *
     * @return `undefined`
     */
    private function ctor(expectedObjectId:String = null): void {
      // We do NOT want to marshall JS exceptions into Flash (other than during detection)
      var preferredMarshalling:Boolean = false;
      ExternalInterface.marshallExceptions = preferredMarshalling;

      // Do we authoritatively know that this Flash object is hosted in a browser?
      this.hosted = ExternalInterface.available === true &&
        ExternalInterface.objectID &&
        (expectedObjectId ? (expectedObjectId === ExternalInterface.objectID) : true);

      // Temporarily start marshalling JS exceptions into Flash
      ExternalInterface.marshallExceptions = true;

      // Try this regardless of the value of `this.hosted`.
      try {
        // Can we retrieve values from JavaScript?
        this.bidirectional = ExternalInterface.call("(function() { return true; })") === true;
      }
      catch (err:Error) {
        // We do NOT authoritatively know if this Flash object is hosted in a browser,
        // nor if JavaScript is disabled.
        this.bidirectional = false;
      }

      // Revert the behavior for marshalling JS exceptions into Flash
      ExternalInterface.marshallExceptions = preferredMarshalling;

      // If hosted but cannot bidirectionally communicate with JavaScript,
      // then JavaScript is disabled on the page!
      this.disabled = this.hosted && !this.bidirectional;

      // Do some feature testing and patching to ensure string fidelity
      // during cross-boundary communications between Flash and JavaScript.
      this.fidelityEnsured = this.ensureStringFidelity();
    }


    /**
     * Detect for deficiencies in string handling (e.g. unescaped backslashes)
     * during cross-boundary communication (JS -> Flash, Flash -> JS).
     *
     * @return Object, or `null`
     */
    private function testStringFidelity(
      data:String
    ): Object {  // NOPMD
      var result:Object = null;  // NOPMD

      // Only test if the input is a string
      if (typeof data === "string" && data != null) {
        // This is only detectable if bidirectional communication can be established
        if (this.isComplete()) {
          var callbackName:String = "_addCallbackStringFidelityTest_" + (this.fidelityUtils.testCounter++),
              originalMarshalling:Boolean = ExternalInterface.marshallExceptions === true,
              expectedLength:int = data.length,
              dataJson:String = JSON.stringify(data),
              jsResult:Object = null,  // NOPMD
              strEscape:Function = XssUtils.sanitizeString;

          // Temporarily start marshalling JS exceptions into Flash
          ExternalInterface.marshallExceptions = true;

          try {
            // Temporarily add a Flash callback to JS
            this.addCallback(callbackName, function(
              jsData:String
            ): Object { // NOPMD
              return {
                addCallback: {
                  parameters: {
                    actual: jsData.length,
                    matched: jsData === data,
                    matchAfterEscaping: jsData === data ? undefined : strEscape(jsData) === data
                  },
                  returnValue: {
                    actualData: data
                  }
                }
              };
            });

            jsResult = this.call([
              '(function(flashData) {',
              '  var jsData = ' + dataJson + ',',
              '      addCallbackResult = null,',
              '      addCallbackResultParamActual = 0,',
              '      addCallbackResultParamMatched = false,',
              '      addCallbackResultParamMatchedAfterEscaping = undefined,',
              '      addCallbackResultReturnValueActualData = "",',
              '      objectId = "' + ExternalInterface.objectID + '",',
              '      swf = document[objectId] || document.getElementById(objectId),',
              '      swfCallbackName = "' + callbackName + '",',
              '      strEscape = function(str) { return !str ? "" : str.replace(/\\\\/g, "\\\\\\\\"); };',
              '',
              '  if (swf && typeof swf[swfCallbackName] === "function") {',
              '    addCallbackResult = swf[swfCallbackName](jsData);',
              '    if (addCallbackResult != null) {',
              '      addCallbackResultParamActual = addCallbackResult.addCallback.parameters.actual;',
              '      addCallbackResultParamMatched = addCallbackResult.addCallback.parameters.matched;',
              '      addCallbackResultParamMatchedAfterEscaping = addCallbackResult.addCallback.parameters.matchedAfterEscaping;',
              '      addCallbackResultReturnValueActualData = addCallbackResult.addCallback.returnValue.actualData;',
              '    }',
              '  }',
              '  // Drop the reference',
              '  swf = null;',
              '',
              '  return {',
              '    addCallback: {',
              '      parameters: {',
              '        actual: addCallbackResultParamActual,',
              '        matched: addCallbackResultParamMatched,',
              '        matchedAfterEscaping: addCallbackResultParamMatchedAfterEscaping',
              '      },',
              '      returnValue: {',
              '        actual: addCallbackResultReturnValueActualData.length,',
              '        matched: addCallbackResultReturnValueActualData === jsData,',
              '        matchedAfterEscaping: addCallbackResultReturnValueActualData === jsData ? undefined : strEscape(addCallbackResultReturnValueActualData) === jsData',
              '      }',
              '    },',
              '    call: {',
              '      parameters: {',
              '        actual: flashData.length,',
              '        matched: flashData === jsData,',
              '        matchedAfterEscaping: flashData === jsData ? undefined : strEscape(flashData) === jsData',
              '      },',
              '      returnValue: {',
              '        actualData: jsData',
              '      }',
              '    }',
              '  };',
              '})'].join('\n'),
              [data]
            );

            result = {
              addCallback: {
                parameters: {
                  expected: expectedLength,
                  actual: jsResult.addCallback.parameters.actual,
                  matched: jsResult.addCallback.parameters.matched,
                  matchedAfterEscaping: jsResult.addCallback.parameters.matchedAfterEscaping
                },
                returnValue: {
                  expected: expectedLength,
                  actual: jsResult.addCallback.returnValue.actual,
                  matched: jsResult.addCallback.returnValue.matched,
                  matchedAfterEscaping: jsResult.addCallback.returnValue.matchedAfterEscaping
                }
              },
              call: {
                parameters: {
                  expected: expectedLength,
                  actual: jsResult.call.parameters.actual,
                  matched: jsResult.call.parameters.matched,
                  matchedAfterEscaping: jsResult.call.parameters.matchedAfterEscaping
                },
                returnValue: {
                  expected: expectedLength,
                  actual: jsResult.call.returnValue.actualData.length,
                  matched: jsResult.call.returnValue.actualData === data,
                  matchedAfterEscaping: jsResult.call.returnValue.actualData === data ? undefined : strEscape(jsResult.call.returnValue.actualData) === data
                }
              }
            };
          }
          catch (err:Error) {
            // If any error occurs, bail out
            result = null;
          }

          // Remove the temporary Flash callback from JS
          this.removeCallback(callbackName);

          // Revert the behavior for marshalling JS exceptions into Flash
          ExternalInterface.marshallExceptions = originalMarshalling;
        }
      }

      return result;
    }


    /**
     * Test the Flash -> JS communication channel for data fidelity.
     * If any data experiences loss of fidelity, try to patch it.
     * If the data still loses fidelity on a subsequent test, it cannot
     * be patched simply.
     *
     * @return Boolean: `true` if high fidelity, `false` if not
     */
    private function ensureStringFidelity(): Boolean {  // NOPMD
      const BACKSLASHES:String = "\\\\";
      var provenFidelity:Boolean = false;
      var canPatchAny:Boolean = false;
      var fidelity:Object;  // NOPMD

      fidelity = this.testStringFidelity(BACKSLASHES);

      provenFidelity = (
        fidelity != null &&
        fidelity.call.parameters.matched &&
        fidelity.call.returnValue.matched &&
        fidelity.addCallback.parameters.matched &&
        fidelity.addCallback.returnValue.matched
      );

      canPatchAny = fidelity != null && !provenFidelity && (
        fidelity.call.parameters.matchedAfterEscaping ||
        fidelity.call.returnValue.matchedAfterEscaping ||
        fidelity.addCallback.parameters.matchedAfterEscaping ||
        fidelity.addCallback.returnValue.matchedAfterEscaping
      );


      if (fidelity != null && !provenFidelity && canPatchAny) {
        if (
          !fidelity.call.parameters.matched &&
          fidelity.call.parameters.matchedAfterEscaping
        ) {
          this.fidelityUtils.patches.call.parameters = XssUtils.sanitize;
        }
        if (
          !fidelity.call.returnValue.matched &&
          fidelity.call.returnValue.matchedAfterEscaping
        ) {
          this.fidelityUtils.patches.call.returnValue = this.fidelityUtils.jsEscapingFn;
        }
        if (
          !fidelity.addCallback.parameters.matched &&
          fidelity.addCallback.parameters.matchedAfterEscaping
        ) {
          this.fidelityUtils.patches.addCallback.parameters = this.fidelityUtils.jsEscapingFn;
        }
        if (
          !fidelity.addCallback.returnValue.matched &&
          fidelity.addCallback.returnValue.matchedAfterEscaping
        ) {
          this.fidelityUtils.patches.addCallback.returnValue = XssUtils.sanitize;
        }

        // Rerun the test with these patches in place... hopefully they all match now!
        fidelity = this.testStringFidelity(BACKSLASHES);

        provenFidelity = (
          fidelity != null &&
          fidelity.call.parameters.matched &&
          fidelity.call.returnValue.matched &&
          fidelity.addCallback.parameters.matched &&
          fidelity.addCallback.returnValue.matched
        );
      }

      return provenFidelity;
    }


    /**
     * Are we authoritatively certain that we can execute JavaScript bidirectionally?
     *
     * @return Boolean
     */
    public function isComplete(): Boolean {
      return this.hosted && this.bidirectional;
    }


    /**
     * Can we authoritatively communicate with JavaScript without any loss of data fidelity?
     *
     * @return Boolean
     */
    public function isHighFidelity(): Boolean {
      return this.isComplete() && this.fidelityEnsured;
    }


    /**
     * Register an ActionScript closure as callable from the container's JavaScript.
     * To unregister, pass `null` as the closure to remove an existing callback.
     *
     * This will execute the JavaScript ONLY if ExternalInterface is completely
     * available (hosted in the browser AND supporting bidirectional communication).
     *
     * @return anything
     */
    public function addCallback(functionName:String, closure:Function): void {
      var wrapperFn:Function = closure;
      var parametersPatch:Function = this.fidelityUtils.patches.addCallback.parameters;
      var returnValuePatch:Function = this.fidelityUtils.patches.addCallback.returnValue;

      if (this.isComplete()) {
        if (returnValuePatch != null) {
          // Patch on Flash side
          wrapperFn = function(): * {  // NOPMD
            var result:* = //NOPMD
                  closure.apply(this, arguments);
            return returnValuePatch(result);
          };
        }

        if (parametersPatch == null) {
          ExternalInterface.addCallback(functionName, wrapperFn);
        }
        else {
          // IMPORTANT:
          // This patch changes the name of the registered callback as some browser/Flash
          // implementations will not allow us to directly override the exposed callback
          // on the SWF object, despite the fact that the JS object property descriptors
          // indicate it should be allowed!

          var proxiedFunctionName:String = PROXIED_CALLBACK_PREFIX + functionName;
          ExternalInterface.addCallback(proxiedFunctionName, wrapperFn);

          // Patch on JS side
          this.call(
            [
              '(function() {',
              parametersPatch('jsEscapingFn'),
              '',
              '  var objectId = "' + ExternalInterface.objectID + '",',
              '      swf = document[objectId] || document.getElementById(objectId),',
              '      desiredSwfCallbackName = "' + functionName + '",',
              '      actualSwfCallbackName = "' + proxiedFunctionName + '",',
              '      swfCallback;',
              '',
              '  if (swf && typeof swf[actualSwfCallbackName] === "function") {',
              '    swfCallback = swf && swf[actualSwfCallbackName];',
              '    swf[desiredSwfCallbackName] = function() {',
              '      var args = [].slice.call(arguments);',
              '      args = jsEscapingFn(args);',
              '      return swfCallback.apply(this, args);',
              '    };',
              '  }',
              '  // Drop the reference',
              '  swf = null;',
              '})'
            ].join('\n')
          );
        }
      }
    }


    /**
     * Unegister an ActionScript closure as callable from the container's JavaScript.
     *
     * This will execute the JavaScript ONLY if ExternalInterface is completely
     * available (hosted in the browser AND supporting bidirectional communication).
     *
     * @return `undefined`
     */
    public function removeCallback(functionName:String): void {
      if (this.isComplete()) {
        var parametersPatch:Function = this.fidelityUtils.patches.addCallback.parameters;

        if (parametersPatch == null) {
          ExternalInterface.addCallback(functionName, null);
        }
        else {
          // IMPORTANT:
          // If addCallback parameters had to be patched, then we need to do special cleanup.
          // See comments in the `JsProxy#addCallback` method body for more information.

          var proxiedFunctionName:String = PROXIED_CALLBACK_PREFIX + functionName;
          ExternalInterface.addCallback(proxiedFunctionName, null);

          this.call(
            [
              '(function() {',
              '  var objectId = "' + ExternalInterface.objectID + '",',
              '      swf = document[objectId] || document.getElementById(objectId),',
              '      desiredSwfCallbackName = "' + functionName + '";',
              '',
              '  if (swf && typeof swf[desiredSwfCallbackName] === "function") {',
              '    swf[desiredSwfCallbackName] = null;',
              '    delete swf[desiredSwfCallbackName];',
              '  }',
              '  // Drop the reference',
              '  swf = null;',
              '})'
            ].join('\n')
          );
        }
      }
    }


    /**
     * Execute a function expression or named function, with optional arguments,
     * and receive its return value.
     *
     * This will execute the JavaScript ONLY if ExternalInterface is completely
     * available (hosted in the browser AND supporting bidirectional communication).
     *
     * @example
     * var jsProxy:JsProxy = new JsProxy("global-zeroclipboard-flash-bridge");
     * var result:Object = jsProxy.call("ZeroClipboard.emit", [{ type: "copy" }]);
     * jsProxy.call("(function(eventObj) { return ZeroClipboard.emit(eventObj); })", [{ type: "ready"}]);
     *
     * @return `undefined`, or anything
     */
    public function call(
      jsFuncExpr:String,
      args:Array = null
    ): * {  // NOPMD
      var parametersPatch:Function = this.fidelityUtils.patches.call.parameters;
      var returnValuePatch:Function = this.fidelityUtils.patches.call.returnValue;

      var result:* = undefined;  // NOPMD
      if (jsFuncExpr && this.isComplete()) {
        if (args == null) {
          args = [];
        }
        if (parametersPatch != null) {
          args = parametersPatch(args);
        }
        if (returnValuePatch != null) {
          jsFuncExpr = [
            '(function() {',
            returnValuePatch('jsEscapingFn'),
            '',
            '  var result = (' + jsFuncExpr + ').apply(this, arguments);',
            '  return jsEscapingFn(result);',
            '})'
          ].join('\n');
        }
        result = ExternalInterface.call.apply(ExternalInterface, [jsFuncExpr].concat(args));
      }
      return result;
    }


    /**
     * Execute a function expression or named function, with optional arguments.
     * No return values will ever be received.
     *
     * This will attempt to execute the JavaScript, even if ExternalInterface is
     * not available; in which case: the worst thing that can happen is that
     * the JavaScript is not executed (i.e. if JavaScript is disabled, or if
     * the SWF is not allowed to communicate with JavaScript on its host page).
     *
     * @return `undefined`
     */
    public function send(jsFuncExpr:String, args:Array = null): void {
      if (jsFuncExpr) {
        if (this.isComplete()) {
          this.call(jsFuncExpr, args);
        }
        else if (!this.disabled) {
          if (args == null) {
            args = [];
          }
          var argsStr:String = "";
          for (var counter:int = 0; counter < args.length; counter++) {
            argsStr += JSON.stringify(args[counter]);
            if ((counter + 1) < args.length) {
              argsStr += ", ";
            }
          }
          navigateToURL(new URLRequest("javascript:" + jsFuncExpr + "(" + argsStr + ");"), "_self");
        }
      }
    }
  }
}