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
  // aspects: 'name',
  // auditEvents: 'resourceName',
  botActions: 'name', // doesnt work
  // botData: 'name',
  // bots: 'name',
  // collectorGroups: 'name',
  // collectors: 'name',
  // events: 'log',
  // generators: 'name',
  // generatorTemplates: 'name',
  // lenses: 'name',
  // perspectives: 'name',
  // rooms: 'name',
  // roomTypes: 'name',
  // subjects: 'name',
  // users: 'name',
  // globalconfig: 'key',
  // profiles: 'name',
  // tokens: 'name', // not working
};


// const modelsToTest = ['aspects', 'subjects', 'auditEvents'];

let userToken;
// let clock;
let clock;
let createdResources;

describe('tests/api/v1/common/createdAtUpdatedAtFilters >', () => {
  beforeEach(() => {
    clock = sinon.useFakeTimers()
    return tu.createUserAndToken('mainUser')
      .then(({ user, token }) => {
        userToken = token;
      });
  });

  afterEach(() => clock.restore());
  afterEach(() => tu.forceDeleteAllRecords(tu.db.User)
    .then(() => tu.forceDeleteAllRecords(tu.db.Profile))
      .then(() => tu.forceDeleteAllRecords(tu.db.Token)));

  Object.entries(modelsToTest).forEach(runFilterTestsForModel);
});

function getUtilForModel(modelName) {
  return require(`../${modelName}/utils`);
}

function getResources({ modelName, filterString}) {
  let path;
  if (modelName === 'botData' || modelName === 'botActions') {
    path = `/v1/${modelName}?botId=${createdResources[0].botId}` +
    `&${filterString}`;
  } else {
    path = `/v1/${modelName}?${filterString}`;
  }

  console.log('path >>>', path);
  return api.get(`${path}`)
    .set('Authorization', userToken)
    .expect(constants.httpStatus.OK);
}

function createModel(modelName, overrideProps, nameAttr, name) {
  const u = getUtilForModel(modelName);
  overrideProps[nameAttr] = name;

  return Promise.resolve()
    .then(() => {
      if (modelName === 'botActions') {
        return u.createBasicWithActionName(overrideProps);
      }

      return u.createBasic(overrideProps);
    });
}

// function createDependencies(modelName, createdBy) {
//   createdBy = createdBy.id;
//   const installedBy = createdBy;
//   const userId = createdBy;
//   const u = getUtilForModel(modelName);
//   if (u.doSetup) {
//     return u.doSetup({
//       createdBy,
//       installedBy,
//       userId,
//     })
//       .then((createdIds) => {
//         dependencyProps = createdIds;
//       });
//   }
// }

function createMultipleRecordsAtDifferentTimes(modelName, nameAttr, util) {
  const overrideProps = {};

  // create a record for (now) -10d, -10h, -10m, -10s
  clock.restore();
  const dateD = new Date();
  const dateH = new Date();
  const dateM = new Date();
  const dateS = new Date();
  let resourceName;
  createdResources = [];
  clock = sinon.useFakeTimers(dateD.setDate(dateD.getDate() - 10));
  resourceName = `${tu.namePrefix}-${modelName}-10d`;
  return createModel(modelName, overrideProps, nameAttr, resourceName)
    .then((created10d) => {
      createdResources.push(created10d);
      clock = sinon.useFakeTimers(dateH.setHours(dateH.getHours() - 10));
      resourceName = `${tu.namePrefix}-${modelName}-10h`;
      return createModel(modelName, overrideProps, nameAttr, resourceName);
    })
    .then((created10h) => {
      createdResources.push(created10h);
      clock = sinon.useFakeTimers(dateM.setMinutes(dateM.getMinutes() - 10));
      resourceName = `${tu.namePrefix}-${modelName}-10m`;
      return createModel(modelName, overrideProps, nameAttr, resourceName);
    })
    .then((created10m) => {
      createdResources.push(created10m);
      clock = sinon.useFakeTimers(dateS.setSeconds(dateS.getSeconds() - 10));
      resourceName = `${tu.namePrefix}-${modelName}-10s`;
      return createModel(modelName, overrideProps, nameAttr, resourceName);
    })
    .then((created10s) => {
      createdResources.push(created10s);
      return Promise.resolve();
    });
    // .catch((err) => {
    //   console.log(err);
    // });
}

function runFilterTestsForModel([modelName, nameAttr]) {
  const u = getUtilForModel(modelName);

  describe(`${modelName} createdAt >`, () => {
    beforeEach(() => createMultipleRecordsAtDifferentTimes(modelName, nameAttr, u));

    afterEach(() => clock.restore());
    afterEach(u.forceDeleteAllRecords);

    describe('GET, test createdAt for specific time period >', () => {
      it('5 hour', () => {
        // console.log(modelName, createdResources);
        const filterString = 'createdAt=-5h';
        return getResources({ modelName, filterString })
          .then((res) => {
            console.log(modelName, res.body);
            // let expectedNumRes = 2;
            // if (modelName === 'profiles') {
            //   expectedNumRes = 4; // extra for default admin and main user
            // }

            expect(createdResources.length).equals(4);
            expect(res.body.length).to.equal(2);
            const resultNames = res.body.map((obj) => obj[nameAttr]);
            expect(resultNames).includes(`___-${modelName}-10m`);
            expect(resultNames).includes(`___-${modelName}-10s`);
          })
          // .catch((err) => {
          //   console.log(err);
          // });
      });
    });
  });
}
