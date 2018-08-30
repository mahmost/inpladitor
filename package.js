Package.describe({
  name: "mahmost:inpladitor",
  git: "https://github.com/mahmost/inpladitor.git",
  summary: "An in-place editor for meteor",
  version: "0.1.0"
});

Npm.depends({
  "optimal-select": '3.5.0'
});

Package.onUse(function (api) {
  api.versionsFrom('1.4.3.2');

  api.use('modules');

  api.mainModule('handler.js', 'client');
  api.mainModule('model.js', 'server');

  api.addFiles('css/style.css', 'client');

});
