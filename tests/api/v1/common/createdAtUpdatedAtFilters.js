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
const BotUtil = require('../bots/utils');
const RoomUtil = require('../rooms/utils');

const modelsToTest = {
  aspects: 'name',
  subjects: 'name',
  auditEvents: 'resourceName',
  // botActions: 'name', // doesnt work
  // botData: 'name', // doesnt work
  bots: 'name',
  collectorGroups: 'name',
  collectors: 'name',
  // events: 'name', // doesnt work
  generators: 'name',
  generatorTemplates: 'name',
  lenses: 'name',
  perspectives: 'name',
  profiles: 'name',
  rooms: 'name',
  roomTypes: 'name',
  tokens: 'name',
  // users: 'name', // not working
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
  let path;
  if (modelName === 'botData') {
    path = `/v1/${modelName}
    ?botId=${createdResources[0].botId}&${filterString}`;
  } else {
    path = `/v1/${modelName}${filterString}`;
  }

  return api.get(`${path}`)
    .set('Authorization', userToken)
    .expect(constants.httpStatus.OK);
}

function createMultipleRecordsAtDifferentTimes(modelName, nameAttr, util) {
  const overrideProps = {};

  function updateProps() {
    return Promise.resolve()
      .then(() => {
        if (modelName === 'botData') {
          return BotUtil.createBasic()
            .then((bot) => {
              overrideProps.botId = bot.id;
              return RoomUtil.createBasic();
            })
            .then((room) => {
              overrideProps.roomId = room.id;
            });
        }
        console.log(overrideProps);
        return Promise.resolve();
      });
  }

  // create a record for (now) -10d, -10h, -10m, -10s
  const dateD = new Date();
  const dateH = new Date();
  const dateM = new Date();
  const dateS = new Date();
  createdResources = [];
  clock = sinon.useFakeTimers(dateD.setDate(dateD.getDate() - 10));
  overrideProps[nameAttr] = `${tu.namePrefix}-${modelName}-10d`;

  return updateProps()
    .then(() => util.createBasic(overrideProps))
    .then((created10d) => {
      // console.log(createdResources);
      createdResources.push(created10d);
      overrideProps[nameAttr] = `${tu.namePrefix}-${modelName}-10h`;
      clock = sinon.useFakeTimers(dateH.setHours(dateH.getHours() - 10));
      return util.createBasic(overrideProps);
    })
    .then((created10h) => {
      // console.log(createdResources);
      createdResources.push(created10h);
      overrideProps[nameAttr] = `${tu.namePrefix}-${modelName}-10m`;
      clock = sinon.useFakeTimers(dateM.setMinutes(dateM.getMinutes() - 10));
      return util.createBasic(overrideProps);
    })
    .then((created10m) => {
      // console.log(createdResources);
      createdResources.push(created10m);
      overrideProps[nameAttr] = `${tu.namePrefix}-${modelName}-10s`;
      clock = sinon.useFakeTimers(dateS.setSeconds(dateS.getSeconds() - 10));
      return util.createBasic(overrideProps);
    })
    .then((created10s) => {
      // console.log(createdResources);
      createdResources.push(created10s);
      return Promise.resolve();
    })
    .catch((err) => {
      console.log(err);
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
        console.log(modelName, createdResources);
        const filterString = '?createdAt=-5h';
        return getResources({ modelName, filterString })
          .then((res) => {
            console.log(modelName, res.body);
            expect(res.body.length).to.equal(2);
            const resultNames = res.body.map((obj) => obj.name);
            expect(resultNames).includes(`___-${modelName}-10m`);
            expect(resultNames).includes(`___-${modelName}-10s`);
          });
          // .catch((err) => {
          //   console.log(err);
          // });
      });
    });
  });
}
