/**
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * tests/api/v1/common/createdAtUpdatedAtFilters.js
 */
'use strict';
const supertest = require('supertest');
const api = supertest(require('../../../../index').app);
const tu = require('../../../testUtils');
const constants = require('../../../../api/v1/constants');
const expect = require('chai').expect;
const Promise = require('bluebird');
const sinon = require('sinon');
supertest.Test.prototype.end = Promise.promisify(supertest.Test.prototype.end);
supertest.Test.prototype.then = function (resolve, reject) {
  return this.end().then(resolve).catch(reject);
};

const modelsToTest = {
  aspects: ['get'],
  // subjects: ['get'],
}

let mainUser;
let userToken;
let clock;
const nowDate = new Date();
let createdResources;

function forceDeleteEverything(...models) {
  Promise.all(models.map((modelName) => tu.db[modelName].destroy({
    where: {},
    force: true,
  })));
}

describe('tests/api/v1/common/createdAtUpdatedAtFilters >', () => {
  before(() => {
    // clock = sinon.useFakeTimers();
    return tu.createUserAndToken('mainUser')
      .then(({ user, token }) => {
        mainUser = user;
        userToken = token;
      });
  });

  after(() => forceDeleteEverything('User', 'Profile', 'Token'));

  Object.entries(modelsToTest).forEach(runFilterTestsForModel);
});

function getUtilForModel(modelName) {
  return require(`../${modelName}/utils`);
}

function getResources({ modelName, filterString}) {
  const path = `/v1/${modelName}${filterString}`;
  console.log('path', path);
  return api.get(`${path}`)
    .set('Authorization', userToken)
    .expect(constants.httpStatus.OK);
}

function createMultipleRecordsAtDifferentTimes(modelName, util) {
  // create a record for (now) -10d, -10h, -10m, -10s

  const dateD = new Date();
  const dateH = new Date();
  const dateM = new Date();
  const dateS = new Date();
  createdResources = [];
  clock = sinon.useFakeTimers(dateD.setDate(dateD.getDate() - 10));
  return util.createBasic({ name: `${tu.namePrefix}-aspect-10d`})
    .then((created10d) => {
      createdResources.push(created10d);
      clock = sinon.useFakeTimers(dateH.setHours(dateH.getHours() - 10));
      return util.createBasic({ name: `${tu.namePrefix}-aspect-10h`});
    })
    .then((created10h) => {
      createdResources.push(created10h);
      clock = sinon.useFakeTimers(dateM.setMinutes(dateM.getMinutes() - 10));
      return util.createBasic({ name: `${tu.namePrefix}-aspect-10m`});
    })
    .then((created10m) => {
      createdResources.push(created10m);
      clock = sinon.useFakeTimers(dateS.setSeconds(dateS.getSeconds() - 10));
      return util.createBasic({ name: `${tu.namePrefix}-aspect-10s`});
    })
    .then((created10s) => {
      createdResources.push(created10s);
      return Promise.resolve();
    });

}

function runFilterTestsForModel([modelName, methods]) {
  const u = getUtilForModel(modelName);

  describe(`${modelName} createdAt >`, () => {
    beforeEach(() => createMultipleRecordsAtDifferentTimes(modelName, u));

    afterEach(() => clock.restore());
    afterEach(() => forceDeleteEverything('Aspect'));

    describe('GET, test createdAt for specific time >', () => {

      it('basic', () => {
        // const filterString = '?name=___-aspect-10d';
        const filterString = `?createdAt=-1d`;
        return getResources({ modelName, filterString })
          .then((res) => {
            console.log(res.body);
            // expect(new Date(res.body[0].createdAt).getTime())
            //   .to.equal(new Date(timeCreatedAt).getTime());
          })
      });
    });
  });
}
