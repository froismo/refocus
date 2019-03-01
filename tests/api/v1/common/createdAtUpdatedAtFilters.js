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
  aspects: 'name',
  // subjects: 'name',
  // auditEvents: 'resourceName',
  // botActions: 'name',
}

// const modelsToTest = ['aspects', 'subjects', 'auditEvents'];

let userToken;
let clock;
let createdResources;

describe('tests/api/v1/common/createdAtUpdatedAtFilters >', () => {
  before(() => {
    // clock = sinon.useFakeTimers();
    return tu.createUserAndToken('mainUser')
      .then(({ user, token }) => {
        userToken = token;
      });
  });

  after(() => tu.forceDeleteAllRecords(tu.db.User)
    .then(() => tu.forceDeleteAllRecords(tu.db.Profile))
      .then(() => tu.forceDeleteAllRecords(tu.db.Token)));

  Object.entries(modelsToTest).forEach(runFilterTestsForModel);
});

function getUtilForModel(modelName) {
  return require(`../${modelName}/utils`);
}

function getResources({ modelName, filterString}) {
  const path = `/v1/${modelName}${filterString}`;
  console.log("Querying....", path);
  return api.get(`${path}`)
    .set('Authorization', userToken)
    .expect(constants.httpStatus.OK);
}

function createMultipleRecordsAtDifferentTimes(modelName, nameAttr, util) {
  // create a record for (now) -10d, -10h, -10m, -10s

  const dateD = new Date();
  const dateH = new Date();
  const dateM = new Date();
  const dateS = new Date();
  createdResources = [];
  let overrideProp = {};
  clock = sinon.useFakeTimers(dateD.setDate(dateD.getDate() - 10));
  overrideProp[nameAttr] = `${tu.namePrefix}-${modelName}-10d`;
  return util.createBasic(overrideProp)
    .then((created10d) => {
      createdResources.push(created10d);
      overrideProp = {};
      overrideProp[nameAttr] = `${tu.namePrefix}-${modelName}-10h`;
      clock = sinon.useFakeTimers(dateH.setHours(dateH.getHours() - 10));
      return util.createBasic(overrideProp);
    })
    .then((created10h) => {
      createdResources.push(created10h);
      overrideProp = {};
      overrideProp[nameAttr] = `${tu.namePrefix}-${modelName}-10m`;
      clock = sinon.useFakeTimers(dateM.setMinutes(dateM.getMinutes() - 10));
      return util.createBasic(overrideProp);
    })
    .then((created10m) => {
      createdResources.push(created10m);
      overrideProp = {};
      overrideProp[nameAttr] = `${tu.namePrefix}-${modelName}-10s`;
      clock = sinon.useFakeTimers(dateS.setSeconds(dateS.getSeconds() - 10));
      return util.createBasic(overrideProp);
    })
    .then((created10s) => {
      createdResources.push(created10s);
      return Promise.resolve();
    });

}

function runFilterTestsForModel([modelName, nameAttr]) {
  const u = getUtilForModel(modelName);

  describe(`${modelName} createdAt >`, () => {
    beforeEach(() => createMultipleRecordsAtDifferentTimes(modelName, nameAttr, u));

    afterEach(() => clock.restore());
    afterEach(u.forceDeleteAllRecords);

    describe('GET, test createdAt for specific time period >', () => {
      it('5 hour', () => {
        const filterString = '?createdAt=-5h';
        return getResources({ modelName, filterString })
          .then((res) => {
            console.log(modelName, res.body);
            expect(res.body.length).to.equal(2);
            expect(res.body[0][nameAttr]).equal(`___-${modelName}-10m`);
            expect(res.body[1][nameAttr]).equal(`___-${modelName}-10s`);
          });
      });
    });
  });
}
