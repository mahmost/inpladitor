module.exports = {
  "env": {
    "browser": true,
    "es6": true,
    "mocha": true,
  },
  "globals": {
    "Meteor": true,
    "Package": true,
    "Blaze": true,
    "Tracker": true,
    "jQuery": true,
    "_": true,
    "$": true,
  },
  "plugins": [
    "mocha",
    "chai-friendly",
    "babel",
  ],
  "settings": {
    "import/resolver": {
      "babel-module": {}
    }
  },
  "extends": "airbnb-base",
  "rules": {
    "no-underscore-dangle": [ "error", { "allow": ["_id", "_edits"] }],
    "no-await-in-loop": 0,

    // allow chai expect (without disabling no-unused-expression)
    "no-unused-expressions": 0,
    "chai-friendly/no-unused-expressions": 2,

    // mocha
    "prefer-arrow-callback": 0,
    "mocha/prefer-arrow-callback": [ "error", { "allowNamedFunctions": true }],
  },
};
