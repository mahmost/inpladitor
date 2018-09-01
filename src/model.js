// const root = this;

// eslint-disable-next-line global-require
const underscore = Package && Package.underscore ? Package.underscore._ : require('underscore');

const { Mongo } = Package.mongo;

const Inpladitor = {}; // require('./handler.js');

// The collection
Inpladitor._edits = new Mongo.Collection('edits', {
  transform(pathEdits) {
    return new Inpladitor.PathEdits(pathEdits);
  },
});

// The prototype
Inpladitor.PathEdits = function PathEdits(pathEdits) {
  underscore.extend(this, pathEdits);
};

// Meteor methods for creating and remove edits
Meteor.methods({
  createEdit(originalEdits) {
    let edits = originalEdits;
    // arguments check
    if (edits.selector && edits.original) {
      edits = [{
        path: edits.path,
        edits: [{
          selector: edits.selector,
          index: edits.index,
          original: edits.original,
          newValue: edits.newValue,
        }],
      }];
    } else if (Array.isArray(edits.edits)) edits = [edits];
    else throw new Meteor.Error('not-an-edit', 'Could not create edit of the given arguments');

    edits.forEach((pathEdits) => {
      const existingPathEdits = Inpladitor._edits.findOne({ path: pathEdits.path });
      if (!existingPathEdits) {
        Inpladitor._edits.insert(pathEdits);
        return;
      }
      const newPathEdits = [];
      pathEdits.edits.forEach((edit) => {
        const updated = Inpladitor._edits.update({ path: pathEdits.path, edits: { $elemMatch: { selector: edit.selector, original: edit.original } } }, { $set: { 'edits.$.newValue': edit.newValue } });
        if (!updated) newPathEdits.push(edit);
      });
      if (newPathEdits.length) {
        Inpladitor._edits.update(existingPathEdits._id, {
          $push: { edits: { $each: newPathEdits } },
        });
      }
    });
  },
  removeEdit(originalQuery) {
    const query = originalQuery;
    // arguments check
    if (typeof query !== 'string' && !query.path && !query._id) throw new Meteor.Error('remove-edit-no-path-or-id', 'Could not remove edit .. Please specify a path or an id');
    else if (!query.selector && !query['edits.selector']) {
      const badKey = Object.keys(query)
        .find(key => (
          key === 'original'
          || key === 'newValue'
          || key === 'index'
          || key.indexOf('edits.') === 0));
      if (badKey) throw new Meteor.Error('remove-edit-unsupported-key', 'Could not remove edit .. To choose a selector edit, please specify the selector');
    }

    // remove a single edit (or some edits)
    if (query.selector || query['edits.selector']) {
      const modifier = {};
      ['selector', 'index', 'original', 'newValue'].forEach((key) => {
        if (typeof query[key] !== 'undefined' || typeof query[`edits.${key}`] !== 'undefined') modifier[key] = typeof query[key] !== 'undefined' ? query[key] : query[`edits.${key}`];
        delete query[key]; delete query[`edits.${key}`];
      });
      const pathEdits = Inpladitor._edits.findOne(query);
      // multiple edits for this path .. remove (pull) just the matching one
      if (pathEdits && pathEdits.edits.length > 1) {
        return Inpladitor._edits.update(query, { $pull: { edits: modifier } });
      }
      // no path edits record found for this path has an edit matching our
      // query .. return without errors for less code (remove if any)
      if (
        !Inpladitor._edits.findOne(underscore.extend({ edits: { $elemMatch: modifier } }, query))
      ) return 0;
    }
    // In any case of (OR):
    // 1. query had path & selector, record found with just one matching edit
    // 2. query just had path (we need to remove all edits for a path)
    // remove the whole pathEdits (document)
    return Inpladitor._edits.remove(query);
  },
});

// Publish edits to a specific path
if (Meteor.isServer) {
  Meteor.publish('Edits', path => Inpladitor._edits.find({ path }));
}

/*
root.exports = Inpladitor;

if (root.module) root.module.exports = Inpladitor;
else root.Inpladitor = Inpladitor;
*/

export default Inpladitor;
