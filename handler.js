// Initialize options
// TODO use Config API
var Inpladitor = require('./model.js'),
  OptimalSelect = require('optimal-select');

if (!Inpladitor._edits) Inpladitor = window.Inpladitor;

Inpladitor.options = {
  preserveLineBreaks: true,
  preserveWhiteSpace: false
};

Inpladitor.handler = function(event, template) {
  event.stopPropagation(); // stop bubbling up (do not fire event on parents)
  // disabled as the anchorNode/focusNode check seems enough
  //var textNode = false;
  //for (var i = 0; i < event.currentTarget.childNodes.length; i++) {
  //  var n = event.currentTarget.childNodes[i];
  //  if (n.nodeType == Node.TEXT_NODE && n.nodeValue.trim() !== "") { textNode = true; break; }
  //}
  //if (!textNode) return;
  var selection = document.getSelection(),
    parent = event.currentTarget,
    textNode = selection.baseNode || selection.anchorNode || selection.focusNode;
  Inpladitor.options.debug && console.log('entering editor event', textNode, parent);
  if (!textNode || !textNode.nodeValue || !textNode.nodeValue.trim() || textNode.parentNode != parent) return;

  var input = document.createElement('textarea'),
    parentStyle = window.getComputedStyle(parent);
  input.id = 'editable-input';
  input.placeholder = "--";

  // adjust style of parent element
  if (!parent.styleOriginal) parent.styleOriginal = {};
  var parentPosition = parentStyle.getPropertyValue('position'),
    parentWhiteSpace = parentStyle.getPropertyValue('white-space'),
    parentDisplay = parentStyle.getPropertyValue('display'),
    enableLineWrapping = parentWhiteSpace != 'pre' && parentWhiteSpace != 'nowrap',
    preserveLineBreaks = parentWhiteSpace.indexOf('pre') === 0 || Inpladitor.options.preserveLineBreaks,
    preserveWhiteSpace = parentWhiteSpace == 'pre' || parentWhiteSpace == 'pre-wrap' || Inpladitor.options.preserveWhiteSpace;
  if (parentPosition != 'absolute') {
    if (typeof parent.styleOriginal.position == 'undefined') parent.styleOriginal.position = parent.style.position;
    parent.style.position = "relative";
  }
  if (parentWhiteSpace != 'pre' && parentWhiteSpace != 'pre-wrap') {
    if (typeof parent.styleOriginal.whiteSpace == 'undefined') parent.styleOriginal.whiteSpace = parent.style.whiteSpace;
    if (parentWhiteSpace == 'nowrap') parent.style.whiteSpace = 'pre';
    else parent.style.whiteSpace = 'pre-wrap';
  }
  if (parentDisplay == 'inline') {
    if (typeof parent.styleOriginal.display == 'undefined') parent.styleOriginal.display = parent.style.display;
    parent.style.display = 'inline-block';
  }

  function resetParentStyle(force) {
    for (var p in parent.styleOriginal) {
      var styleValue = parent.styleOriginal[p];
      if (!force && p == "whiteSpace") {
        var lineBreakExists = textNode.nodeValue.indexOf("\n") > -1,
          whiteSpaceExists = lineBreakExists || /\s\s/.test(textNode.nodeValue);
        if (preserveWhiteSpace && whiteSpaceExists) {
          if (!enableLineWrapping) styleValue = "pre";
          else styleValue = "pre-wrap";
        }
        else if (preserveLineBreaks && lineBreakExists) {
          if (!enableLineWrapping) styleValue = "pre"; // FIXME
          else styleValue = "pre-line";
        }
      }
      parent.style[p] = styleValue;
    }
  }

  // adjust size of input
  selection.removeAllRanges();
  var r = document.createRange();
  r.selectNode(textNode);
  resize();
  input.value = textNode.nodeValue; //$(e.currentTarget).contents().filter(function() { return this.nodeType == Node.TEXT_NODE; }).first().text();
  function resizeForText(text) {
    if (!text) text = input.value;
    if (!text.trim()) text = (input.placeholder || "").trim();
    if (!textNode.tempValue) textNode.tempValue = textNode.nodeValue;
    if (text[text.length - 1] == "\n") text += " ";
    textNode.nodeValue = text; //input.value;
    resize();
  }
  function resize() {
    var textNodeRect = r.getBoundingClientRect(),
      textNodeRectOne = r.getClientRects()[0],
      parentLineHeight = +parentStyle.getPropertyValue('line-height').replace(/px$/,''),
      parentIndent = +parentStyle.getPropertyValue('text-indent').replace(/px$/,''),
      parentIndentAdded = function() { return textNodeRect.height < 2*parentLineHeight ? parentIndent : 0; },
      originalTransform = parent.style.transform;
    parent.style.transform = "none";
    r.selectNode(textNode);
    textNodeRect = realShape(r); //r.getBoundingClientRect();
    parentRect = parent.getBoundingClientRect();
    parent.style.transform = originalTransform;
    input.style.width = (textNodeRect.width + 8 + parentIndentAdded()) + "px";
    input.style.height = (textNodeRect.height + 4) + "px";
    input.style.bottom = (parentRect.bottom - textNodeRect.bottom - 2) + "px";
    input.style.left = (textNodeRect.left - parentRect.left - 4 - parentIndentAdded()) + "px";
    if (textNodeRectOne.left > textNodeRect.left && textNodeRect.height > textNodeRectOne.height) input.style.textIndent = (textNodeRectOne.left - textNodeRect.left) + "px";
    Inpladitor.options.debug && console.log('resizing', input.style.width, input.style.height, input.style.bottom, input.style.left);
  }

  // input event handlers
  $(input).on('click', function(inputClicked) { return false; });
  $(input).on('focus', function(inputFocused) { inputFocused.target.value = inputFocused.target.value; });
  $(input).on('keyup', function(inputKeyUp) {
    if (inputKeyUp.keyCode == 8 || inputKeyUp.keyCode == 46) resizeForText();
  });
  $(input).on('keypress blur', function(inputSave) {
    if (inputSave.type != 'keypress' || (inputSave.which == 13 && !inputSave.shiftKey)) {
      if (typeof textNode.tempValue == 'undefined') textNode.tempValue = textNode.nodeValue;
      if (!textNode.originalValue && input.value != textNode.tempValue) {
        textNode.originalValue = textNode.tempValue;
        // initialize an array of child text nodes
        if (!parent.childTextNodes) childTextNodes(parent);
        var resetButton = document.createElement('span'),
          stickButton = document.createElement('span'),
          saveButton;
        resetButton.className = "reset";
        resetButton.title = "Reset to original text";
        resetButton.innerHTML = "<i></i>";
        resetButton.textNode = textNode;
        if (makeChangesPermanent.call(textNode, {dryRun: true})) {
          saveButton = document.createElement('span');
          saveButton.className = "save";
          saveButton.title = "Save to database";
          saveButton.innerHTML = "<i></i>";
          saveButton.textNode = textNode;
          $(saveButton).on('click', _.bind(makeChangesPermanent, textNode));
        }
        stickButton.className = "stick";
        stickButton.title = "Stick this edit";
        stickButton.innerHTML = "<i></i>";
        stickButton.textNode = textNode;
        $(stickButton).on('click', function (stickButtonClicked) {
          Meteor.call('createEdit', {
            path: location.pathname,
            selector: elementSelector(parent),
            index: textNode.textNodeIndex,
            original: textNode.originalValue,
            newValue: textNode.nodeValue
          }, function(stickError) {
            if (stickError) {
              console.error(stickError.reason);
              return;
            }
            applyEdits();
          });
        });
        textNode.adjustButtons = function() {
          var originalTransform = parent.style.transform;
          parent.style.transform = "none";
          textNodeRect = r.getBoundingClientRect();
          parentRect = parent.getBoundingClientRect();
          for (var i = 0,button,buttonIndex = 0,buttonStyle,buttonWidth,buttonHeight,buttonTextNode; button = parent.children[i++];) {
            if (button.tagName !== 'SPAN' || !/^(save|reset|stick)$/.test(button.className)) continue;
            if (button.textNode != buttonTextNode) {
              buttonIndex = 0;
              buttonTextNode = button.textNode;
            }
            r.selectNode(button.textNode);
            textNodeRectOne = r.getClientRects()[0];
            if (!buttonStyle) buttonStyle = window.getComputedStyle(button);
            if (!buttonHeight) buttonHeight = +buttonStyle.getPropertyValue('height').replace(/px$/, '');
            if (!buttonWidth) buttonWidth = +buttonStyle.getPropertyValue('width').replace(/px$/, '');
            //button.style.left = (textNodeRectOne.left - parentRect.left - (0.4*buttonWidth) + (buttonIndex*(buttonWidth+2))) + "px";
            //button.style.bottom = (parentRect.bottom - textNodeRectOne.top + 2) + "px";
            var angle = ((Math.PI/4)*(2*buttonIndex-1));
            button.style.top = (textNodeRectOne.top - parentRect.top + textNodeRectOne.height/2 - buttonHeight/2 - Math.cos(angle)*(textNodeRectOne.height + 7)) + "px";
            button.style.left = (textNodeRectOne.left - parentRect.left + textNodeRectOne.width/2 - buttonWidth/2 + Math.sin(angle)*(textNodeRectOne.height + 4)) + "px";
            //button.style.transformOrigin = (textNodeRect.width/2)+"px "+(buttonHeight+2+textNodeRect.height/2)+"px";
            button.style.transform = "rotate("+angle+"rad)";
            buttonIndex++;
          }
          parent.style.transform = originalTransform;
        };
        textNode.removeButtons = function() {
          nonObserved(function() {
            textNode.resetButton.remove();
            if (textNode.saveButton) textNode.saveButton.remove();
            if (textNode.stickButton) textNode.stickButton.remove();
          });
        };
        $(resetButton).on('click', function(resetButtonClicked) {
          var selector = elementSelector(parent),
            valueBeforeReset = textNode.nodeValue;
          Meteor.call("removeEdit", {
            path: location.pathname,
            selector: selector,
            index: textNode.textNodeIndex
          }, function(removeEditError, removedEdit) {
            if (removeEditError) console.error(removeEditError.reason);
            else Inpladitor.options.debug && console.log('removed edit for selector', selector, ' text node #'+textNode.textNodeIndex);
          });
          textNode.nodeValue = textNode.originalValue;
          delete textNode.originalValue;
          delete textNode.stuckValue;
          textNode.removeButtons();
          selection.removeAllRanges();
          var otherEditedNodes = false;
          for (var i = 0,n; n = parent.childTextNodes[i++];) {
            if (n.originalValue && n.adjustButtons) n.adjustButtons();
            if (n != textNode && n.originalValue) otherEditedNodes = true;
          }
          if (parent.childTextNodes.length == 1 || !otherEditedNodes) {
            $(parent).removeClass('edited');
            resetParentStyle(true);
          }
          // fire our event for others to hook on (textNode reset) in event map :
          // 'editor:reset td': function(event, template, textNode, previousValue)
          $(parent).trigger('editor:reset', [textNode, valueBeforeReset]);
          return false;
        });
        var buttons = [resetButton];
        if (saveButton) buttons.push(saveButton);
        if (stickButton) buttons.push(stickButton);
        $(buttons).hover(function(hoverOn) {
          hoverOn.currentTarget.title.replace(/\s\(stuck\)$/, "");
          if (textNode.stuckValue && textNode.nodeValue == textNode.stuckValue && hoverOn.currentTarget.title.search(/\s\(stuck\)$/) == -1) hoverOn.currentTarget.title += " (stuck)";
          if (hoverOn.currentTarget.className == 'reset') $(parent).addClass('hl-red');
          if (hoverOn.currentTarget.className == 'stick') $(parent).addClass('hl-orange');
          if (hoverOn.currentTarget.className == 'save') $(parent).addClass('hl-green');
          r.selectNode(textNode);
          selection.removeAllRanges();
          selection.addRange(r);
        }, function(hoverOff) {
          $(parent).removeClass('hl-red hl-orange hl-green');
          selection.removeAllRanges();
        });
        $(parent).hover(function(hoverOn) {
          if (parentDisplay != 'inline') return;
          parent.styleHover = {}; parent.styleHover.display = "inline"; parent.style.display = "inline-block";
        }, function(hoverOff) {
          if (!parent.styleHover) return;
          for (var p in parent.styleHover) parent.style[p] = parent.styleHover[p];
        });
        nonObserved(function() {
          parent.appendChild(resetButton);
          textNode.resetButton = resetButton;
          if (saveButton) {
            parent.appendChild(saveButton);
            textNode.saveButton = saveButton;
          }
          if (stickButton) {
            parent.appendChild(stickButton);
            textNode.stickButton = stickButton;
          }
        });
        $(parent).addClass("edited");
        textNode.adjustButtons();
        //$(parent).prepend('<span class="reset" title="Reset to original text"><i></i></span>').addClass('edited');
      }
      if (textNode.stickButton) {
        if (!textNode.stuckValue || textNode.stuckValue != input.value) textNode.stickButton.style.visibility = "visible";
        else textNode.stickButton.style.visibility = "hidden";
      }
      if (input.value == textNode.originalValue) textNode.resetButton.click();
      else if (input.value != textNode.tempValue) {
        textNode.makeChangesPermanent = _.bind(makeChangesPermanent, textNode);
        for (var i = 0,n; n = parent.childTextNodes[i++];) {
            if (n.originalValue && n.adjustButtons) n.adjustButtons();
        }
        // fire our event for others to hook on (textNode edited) in event map :
        // 'editor:edit td': function(event, template, textNode, previousValue)
        $(parent).trigger('editor:edit', [textNode, textNode.tempValue]);
      }
      delete textNode.tempValue;
    }
    else if (inputSave.keyCode != 27) {
      if ((inputSave.which == 13 && !preserveWhiteSpace && !preserveLineBreaks) ||
          (inputSave.which == 32 && !preserveWhiteSpace && input.value[input.selectionStart - 1] == " "))
        inputSave.preventDefault();
      else if (inputSave.which && (inputSave.which == 32 || inputSave.which == 13 || inputSave.charCode)) {
        var c = String.fromCharCode(inputSave.keyCode | inputSave.charCode);
        if (inputSave.which == 13) c = "\n";
        resizeForText(input.value.slice(0, input.selectionStart) + c + input.value.slice(input.selectionEnd));
      }
      return;
    }
    //inputSave.stopImmediatePropagation();
    //inputSave.stopPropagation();
    // remove the input
    if (inputSave.keyCode == 27 && textNode.tempValue) textNode.nodeValue = textNode.tempValue;
    nonObserved(function() { input.remove(); });
    // reset style of parent
    resetParentStyle();
    // stop propagation
    return false;
  });
  nonObserved(function() {
    // remove other inputs
    var oldInput = document.getElementById('editable-input');
    if (oldInput) oldInput.remove();
    parent.appendChild(input).focus();
  });
  Meteor.defer(function(){ input.selectionStart = input.selectionEnd = 10000; });
};

function makeChangesPermanent(options) {
  var textNode = this,
    parent = textNode.parentNode,
    action = parent.getAttribute('data-field');
  if (!action && !parent.editAction) return;
  if (!options) options = {};
  var context = Blaze.getData(parent),
    index = 0,
    successCallback = function() {
      textNode.originalValue = textNode.nodeValue;
      textNode.resetButton.click();
      //textNode.removeButtons();
    };
  index = textNode.textNodeIndex;
  if (_.isFunction(parent.editAction)) {
    Inpladitor.options.debug && console.log('custom editAction will be invoked', parent.editAction);
    if (options.dryRun) return true;
    parent.editAction.call(context, textNode.nodeValue, index, successCallback);
  }
  else if (_.isString(action)) {
    // get collection and method considering multiple textNodes ...
    action = action.indexOf('|') > -1 ? action.split('|')[index] : action;
    if (action == 'none') return;
    var collection = parent.getAttribute('data-collection') || "",
      method = parent.getAttribute('data-method') || "",
      contextId = parent.getAttribute('data-context-id'),
      fields = action.split('.');

    // prepare context and field
    var contextIndex = 0,
      field = false,
      checkContextId = function (checkedContext, checkedFields) {
        if (!checkedContext) checkedContext = context;
        if (!checkedFields) checkedFields = fields;
        Inpladitor.options.debug && console.log('checking context id', checkedContext, checkedFields);
        for (i = 0; i < checkedFields.length; i++) {
          checkedContext = checkedContext[checkedFields[i]];
          Inpladitor.options.debug && console.log('i :', i, 'checking', checkedContext);
          if (checkedContext && checkedContext._id) {
            context = checkedContext;
            contextIndex = i + 1;
            fields = fields.slice(contextIndex);
            field = fields.join('.');
          }
        }
        Inpladitor.options.debug && console.log('returning with', !!context._id, context, field);
        return !!context._id;
      };

    if (collection && collection.indexOf("|") > -1) collection = collection.split("|")[index];
    if (method && method.indexOf("|") > -1) method = method.split("|")[index];

    Inpladitor.options.debug && console.log('check', context, method, collection, index, action);
    // get method and collection by inheritance (3 levels max depth)
    if ((!contextId && (!context[fields[0]] || !checkContextId())) || (!method && !collection)) {
      var depth = 0, grandParent = parent, maxDepth = grandParent.getAttribute('data-depth') || 3;
      while (((!contextId && (!context[fields[0]] || !checkContextId())) || (!method && !collection)) && depth <= maxDepth) {
        grandParent = grandParent.parentNode;
        maxDepth = grandParent.getAttribute('data-depth') || maxDepth;
        if (!method && !collection) {
          collection = grandParent.getAttribute('data-collection');
          method = grandParent.getAttribute('data-method');
        }
        if (!contextId && (!context[fields[0]] || !checkContextId())) context = Blaze.getData(grandParent);
        Inpladitor.options.debug && console.log('depth', depth, context, method, collection);
        depth++;
      }
    }
    if (!field) field = fields[fields.length - 1];
    Inpladitor.options.debug && console.log('context', context, fields, field);
    Inpladitor.options.debug && console.log('requirements', context[fields[0]], checkContextId(), method, collection);
    // if we defined a depth data attribute on parent then don't insist the
    // context has the field .. maybe this field is optional
    if (parent.getAttribute('data-depth')) context[fields[0]] = undefined;
    if ((!contextId && (!context.hasOwnProperty(fields[0]) || !checkContextId())) || (!method && !collection)) return;

    if (contextId) context = {_id: contextId};

    method = method ||  "update"+collection.replace(/s$/, '');
    var modifier = {}, value = textNode.nodeValue;
    if (value == "--") value = "";
    if (parent.editAlter) {
      modifier[field] = parent.editAlter.call(context, value, field, index);
    }
    else modifier[field] = value;
    Inpladitor.options.debug && console.log(method, context._id, modifier);
    if (options.dryRun) { return true; }
    Meteor.call(method, context._id, modifier, function(error) {
      if (error) {
        alert('Could not save the new value : '+ error.reason);
        log.error('Error using in place editor ('+method+' -- '+field+' => '+textNode.nodeValue+')', error.reason);
        return;
      }
      successCallback();
    });
  }
}

function realShape(range) {
  var rects = range.getClientRects(),
    rect = range.getBoundingClientRect(),
    shape = {};
  function replaceIfMore (param) {
    shape[param] = Math.max(rect[param], rects[i][param], shape[param] || 0);
  }
  function replaceIfLess (param) {
    shape[param] = Math.min(rect[param], rects[i][param], shape[param] || Infinity);
  }
  for (var i = 0; i < rects.length; i++) {
    ['x', 'y', 'top', 'left'].forEach(replaceIfLess);
    ['bottom','right'].forEach(replaceIfMore);
  }
  shape.width = shape.right - shape.left;
  shape.height = shape.bottom - shape.top;
  return shape;
}

function elementSelector(element) {
  return OptimalSelect.select(element, {
    ignore: {
      class: function(className) { return /(?=(\s|))(sortable|edited|save|stick|reset|hl-red|hl-orange|hl-green)(?=(\s|$))/.test(className); },
      attribute: function(name, value, defaultPredicate) { return /^style$/.test(name); }
    }
  });
}

function childTextNodes(element) {
  element.childTextNodes = [];
  for (var i = 0,index=0,n; n = element.childNodes[i++];) {
    if (n.nodeType == Node.TEXT_NODE && (n.nodeValue.trim() !== "" || n.originalValue)) {
      element.childTextNodes.push(n);
      n.textNodeIndex = index;
      index++;
    }
  }
}

var sub;
var mutationObserver = new MutationObserver(function(mutations) {
  applyEdits();
});

Inpladitor.start = function() {
  observe(true);
  applyEdits();
  sub = Meteor.subscribe("Edits", location.pathname, {onReady: function() { applyEdits(); }});
};

Inpladitor.stop = function () {
  stopObserve();
  if (sub && sub.stop) sub.stop();
};

Meteor.startup(function() {
  Tracker.autorun(function() { Inpladitor.start(); });
});

// start observing DOM .. here we specify printable/editable areas
var observe = function () {
  Tracker.afterFlush(function() {
    //Array.apply(null, document.querySelectorAll('.editable')).forEach(function (element) {
    Array.apply(null, document.querySelectorAll(':not(.no-edit)')).forEach(function (element) {
      if (element.observed) return;
      mutationObserver.observe(element, { childList: true, subtree: true });
      element.observed = true;
    });
  });
};

// stop observing DOM .. Do not need the observer to fire for the upcoming
// changes (adding the editor textarea, buttons, ..etc)
var stopObserve = function () {
  mutationObserver.disconnect();
  Array.apply(null, document.querySelectorAll(':not(.no-edit)')).forEach(function (element) {
    element.observed = false;
  });
};

var nonObserved = function (callback) {
  // stop observer : do not re-apply edits after these DOM changes
  stopObserve();
  callback();
  // start observer again
  observe();
};

var applyEdits = function () {
  var pathEdits = Inpladitor._edits.findOne({path: location.pathname}),
    affectedNodes = [];
  if (pathEdits) pathEdits.edits.forEach(function(edit) {
    Meteor.defer(function () {
      Tracker.afterFlush(function () {
        var parent = document.querySelector(edit.selector),
          clickEvent = jQuery.Event('click'),
          range = document.createRange(),
          selection = window.getSelection();
        if (!parent) { console.warn('Error applying edit of', edit.selector, ' #'+edit.index+' : element not found'); return; }
        clickEvent.currentTarget = parent;
        // create the array of child text nodes (with some text inside)
        if (!parent.childTextNodes) childTextNodes(parent);
        var textNode = parent.childTextNodes[edit.index];
        if (!textNode.textNodeIndex) childTextNodes(parent);
        // return if this index is not found (html changed)
        if (!textNode) { console.warn('Error applying edit for '+edit.selector+' #'+edit.index+' : Text node not found'); return; }
        // return if original value is not the current one (html changed or value updated by other means)
        if (textNode.nodeValue != edit.original && textNode.originalValue != edit.original) { console.warn('Error applying edit for '+edit.selector+' #'+edit.index+' : Original value mismatch !!'); return; }
        // we should only reach here if this is the element was originally edited
        textNode.stuckValue = edit.newValue;
        range.selectNodeContents(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        Inpladitor.handler(clickEvent);
        var input = document.getElementById('editable-input');
        input.value = edit.newValue;
        var keyPressEvent = new KeyboardEvent("keyup", {keyCode: 46, which: 46, view: window});
        input.dispatchEvent(keyPressEvent);
        keyPressEvent = new KeyboardEvent("keypress", {keyCode: 13, which: 13, view: window});
        input.dispatchEvent(keyPressEvent);
        affectedNodes.push(textNode);
      });
    });
  });
  Meteor.defer(function () { Tracker.afterFlush(function () {
    Array.apply(null,document.querySelectorAll('.edited')).forEach(function (editedParent) {
      editedParent.childTextNodes.forEach(function (textNode) {
        if (typeof textNode.stuckValue != 'undefined' && affectedNodes.indexOf(textNode) == -1) {
          if ((!Inpladitor.options.permissionCallback || Inpladitor.options.permissionCallback()) && textNode.nodeValue != textNode.stuckValue) {
            delete textNode.stuckValue;
            textNode.stickButton.style.visibility = 'visible';
          }
          else textNode.resetButton.click();
        }
        // hide all buttons if user has no permission to use the editor
        if (Inpladitor.options.permissionCallback && !Inpladitor.options.permissionCallback()) ['reset', 'save', 'stick'].forEach(function (op) {
          if (textNode[op+"Button"]) textNode[op+"Button"].style.visibility = 'hidden';
        });
      });
    });
  }); });
};

module.exports = Inpladitor;
