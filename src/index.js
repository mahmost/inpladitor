// eslint-disable global-require

import Inpladitor from './model';

import clientInpladitor from './handler';

if (Meteor.isClient) Object.assign(Inpladitor, clientInpladitor);

export default Inpladitor;
