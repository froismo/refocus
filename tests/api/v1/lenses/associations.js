/**
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * tests/api/v1/lenses/associations.js
 */
'use strict';
const tu = require('../../../testUtils');
const u = require('./utils');
const testAssociations = require('../common/testAssociations.js').testAssociations;
const Lens = tu.db.Lens;
const path = '/v1/lenses';
const Joi = require('joi');

describe(`tests/api/v1/lenses/associations.js, GET ${path} >`, () => {
  let conf = {};

  const lens1 = u.getBasic();
  const lens2 = u.getBasic();
  lens1.name = 'lens1';
  lens2.name = 'lens2';

  before((done) => {
    tu.createUser('testUser')
    .then((user) => {
      lens1.installedBy = user.id;
      lens2.installedBy = user.id;
      lens1.ownerId = user.id;
      lens2.ownerId = user.id;
      conf.token = tu.createTokenFromUserName(user.name);
      done();
    })
    .catch(done);
  });

  before((done) => {
    Lens.create(lens1)
    .then(() => Lens.create(lens2))
    .then(() => done())
    .catch(done);
  });

  after(u.forceDelete);
  after(tu.forceDeleteUser);

  const associations = ['user', 'owner'];
  const schema = {
    user: Joi.object().keys({
      id: Joi.string().required(),
      name: Joi.string().required(),
      email: Joi.string().required(),
      profile: Joi.object().keys({
        id: Joi.string().required(),
        name: Joi.string().required(),
      }).required(),
    }),
    owner: Joi.object().keys({
      id: Joi.string().required(),
      name: Joi.string().required(),
      fullName: Joi.string().optional().allow(null),
      email: Joi.string().required(),
      profile: Joi.object().keys({
        id: Joi.string().required(),
        name: Joi.string().required(),
      }).required(),
    }),
  };

  testAssociations(path, associations, schema, conf);
});
