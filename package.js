Package.describe({
  name: 'mahmost:inpladitor',
  git: 'https://github.com/mahmost/inpladitor.git',
  summary: 'An in-place editor for meteor',
  version: '0.2.5',
});

Npm.depends({
  'optimal-select': '3.5.0',
  loglevel: '1.6.1',
});

Package.onUse((api) => {
  api.versionsFrom('1.4.3.2');

  api.use('modules');

  api.mainModule('dist/handler.js', 'client');
  api.mainModule('dist/model.js', 'server');

  api.addFiles('css/style.css', 'client');
});
