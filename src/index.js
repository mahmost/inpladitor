// eslint-disable global-require

import Inpladitor from './model';


if (Meteor.isClient) {
  const clientInpladitor = require('./handler').default;
  Object.assign(Inpladitor, clientInpladitor);
}

export default Inpladitor;
