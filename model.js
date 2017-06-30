(function () {

  var root = this,
    underscore = Package && Package['underscore'] ? Package['underscore']._ : require('underscore'),
    Mongo = Package['mongo'].Mongo,
    Inpladitor = {}; //require('./handler.js');

  // The collection
  Inpladitor._edits = new Mongo.Collection('edits', {transform: function(pathEdits) {
    return new Inpladitor.PathEdits(pathEdits);
  }});

  // The prototype
  Inpladitor.PathEdits = function(pathEdits) {
    underscore.extend(this, pathEdits);
  };

  // Meteor methods for creating and remove edits
  Meteor.methods({
    createEdit: function (edits) {
      // arguments check
      if (edits.selector && edits.original) edits = [{
        path: edits.path,
        edits: [{ selector: edits.selector, index: edits.index, original: edits.original, newValue: edits.newValue }]
      }];
      else if (Array.isArray(edits.edits)) edits = [edits];
      else throw new Meteor.Error("not-an-edit", "Could not create edit of the given arguments");

      var self = this;
      edits.forEach(function (pathEdits) {
        var existingPathEdits = Inpladitor._edits.findOne({path: pathEdits.path});
        if (!existingPathEdits) {
          Inpladitor._edits.insert(pathEdits);
          return;
        }
        var newPathEdits = [];
        pathEdits.edits.forEach(function (edit) {
          var updated = Inpladitor._edits.update({path: pathEdits.path, edits: { $elemMatch: { selector: edit.selector, original: edit.original}}}, {$set: { "edits.$.newValue" : edit.newValue }});
          if (!updated) newPathEdits.push(edit);
        });
        if (newPathEdits.length) Inpladitor._edits.update(existingPathEdits._id, {$push: {edits: {$each: newPathEdits}}});
      });
    },
    removeEdit: function (query) {
      // arguments check
      if (typeof query != 'string' && !query.path && !query._id) throw new Meteor.Error("remove-edit-no-path-or-id", "Could not remove edit .. Please specify a path or an id");
      else if (!query.selector && !query["edits.selector"]) {
        var badKey = Object.keys(query).find(function(key) {
          return key == "original" || key == "newValue" || key == "index" || key.indexOf('edits.') === 0;
        });
        if (badKey) throw new Meteor.Error("remove-edit-unsupported-key", "Could not remove edit .. To choose a selector edit, please specify the selector");
      }

      // remove a single edit (or some edits)
      if (query.selector || query["edits.selector"]) {
        var modifier = {};
        ["selector", "index", "original", "newValue"].forEach(function(key) {
          if (typeof query[key] != "undefined" || typeof query["edits."+key] != "undefined") modifier[key] = typeof query[key] != 'undefined' ? query[key] : query["edits."+key];
          delete query[key]; delete query["edits."+key];
        });
        var pathEdits = Inpladitor._edits.findOne(query);
        // multiple edits for this path .. remove (pull) just the matching one
        if (pathEdits && pathEdits.edits.length > 1) return Inpladitor._edits.update(query, {$pull: {edits: modifier}});
        // no path edits record found for this path has an edit matching our
        // query .. return without errors for less code (remove if any)
        else if (!Inpladitor._edits.findOne(underscore.extend({edits: {$elemMatch: modifier}}, query))) return 0;
      }
      // In any case of (OR):
      // 1. query had path & selector, record found with just one matching edit
      // 2. query just had path (we need to remove all edits for a path)
      // remove the whole pathEdits (document)
      return Inpladitor._edits.remove(query);
    }
  });

  // Publish edits to a specific path
  if (Meteor.isServer) {
    Meteor.publish("Edits", function(path) {
      return Inpladitor._edits.find({path: path});
    });
  }

  root.exports = Inpladitor;

  if (root.module) root.module.exports = Inpladitor;
  else root.Inpladitor = Inpladitor;

  return Inpladitor;

}).call(this);
