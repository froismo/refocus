/**
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * tests/cache/redisOps.js
 */
'use strict'; // eslint-disable-line strict
const sampleStore = require('../../cache/sampleStore');
const redisOps = require('../../cache/redisOps');
const rcli = require('../../cache/redisCache').client.sampleStore;
const featureToggles = require('feature-toggles');
const expect = require('chai').expect;
const tu = require('../testUtils');
const u = require('./utils');
const Sample = tu.Sample;
const Aspect = tu.db.Aspect;
const Subject = tu.db.Subject;
const initialFeatureState = featureToggles
  .isFeatureEnabled(sampleStore.constants.featureName);

describe('tests/cache/redisOps >', () => {
  let a1;
  let a2;
  let a3;
  let s1;
  let s2;
  let s3;

  beforeEach((done) => {
    tu.toggleOverride(sampleStore.constants.featureName, true);
    Aspect.create({
      isPublished: true,
      name: `${tu.namePrefix}Aspect1`,
      timeout: '30s',
      valueType: 'NUMERIC',
      criticalRange: [0, 1],
      relatedLinks: [
        { name: 'Google', value: 'http://www.google.com' },
        { name: 'Yahoo', value: 'http://www.yahoo.com' },
      ],
    })
    .then((created) => (a1 = created))
    .then(() => Aspect.create({
      isPublished: true,
      name: `${tu.namePrefix}Aspect2`,
      timeout: '10m',
      valueType: 'NUMERIC',
      okRange: [10, 100],
    }))
    .then((created) => (a2 = created))
    .then(() => Aspect.create({
      isPublished: true,
      name: `${tu.namePrefix}Aspect3`,
      timeout: '10m',
      valueType: 'NUMERIC',
      okRange: [10, 100],
    }))
    .then((created) => (a3 = created))
    .then(() => Subject.create({
      isPublished: true,
      name: `${tu.namePrefix}Subject1`,
    }))
    .then((created) => (s1 = created))
    .then(() => Subject.create({
      isPublished: true,
      name: `${tu.namePrefix}Subject2`,
      parentId: s1.id,
    }))
    .then((created) => (s2 = created))
    .then(() => Subject.create({
      isPublished: true,
      name: `${tu.namePrefix}Subject3`,
      parentId: s1.id,
    }))
    .then((created) => (s3 = created))
    .then(() => Sample.create({ // name: '___Subject1.___Subject2|Aspect1'
      subjectId: s2.id,
      aspectId: a1.id,
      value: '0',
      relatedLinks: [
        { name: 'Salesforce', value: 'http://www.salesforce.com' },
      ],
    }))
    .then(() => Sample.create({ // name: '___Subject1.___Subject2|Aspect2'
      subjectId: s2.id,
      aspectId: a2.id,
      value: '50',
      relatedLinks: [
        { name: 'Salesforce', value: 'http://www.salesforce.com' },
      ],
    }))
    .then(() => Sample.create({ // name: '___Subject1.___Subject3|Aspect1'
      subjectId: s3.id,
      aspectId: a1.id,
      value: '5',
      relatedLinks: [
        { name: 'Salesforce', value: 'http://www.salesforce.com' },
      ],
    }))
    .then(() => done())
    .catch(done);
  });

  afterEach((done) => {
    u.forceDelete(done)
    .then(() => rcli.flushallAsync())
    .then(() => tu.toggleOverride(sampleStore.constants.featureName,
      initialFeatureState))
    .then(() => done())
    .catch(done);
  });

  describe('deleteSampleKeys tests >', () => {
    it('should return deleted samples back, aspsubmap association', (done) => {
      const aspectName = `${tu.namePrefix}Aspect1`;
      redisOps.deleteSampleKeys(sampleStore.constants.objectType.aspSubMap,
        aspectName)
      .then((samples) => {
        expect(samples).to.have.a.lengthOf(2);
        expect(samples[0].name).to.be.oneOf([
          '___Subject1.___Subject2' + '|' + aspectName,
          '___Subject1.___Subject3' + '|' + aspectName,
        ]);
        expect(samples[1].name).to.be.oneOf([
          '___Subject1.___Subject2' + '|' + aspectName,
          '___Subject1.___Subject3' + '|' + aspectName,
        ]);
        const cmd = [
          ['hgetall', '___Subject1.___Subject2' + '|' + aspectName],
          ['hgetall', '___Subject1.___Subject3' + '|' + aspectName],
        ];
        return rcli.batch(cmd).execAsync();
      })
      .then((samples) => {
        expect(samples[0]).to.equal(null);
        expect(samples[1]).to.equal(null);
        return done();
      })
      .catch((err) => done(err));
    });

    it('should return deleted samples back, subaspmap association', (done) => {
      const subject2AbsPath = `${tu.namePrefix}Subject1.` +
        `${tu.namePrefix}Subject2`;
      redisOps.deleteSampleKeys(sampleStore.constants.objectType.subAspMap,
        subject2AbsPath)
      .then((samples) => {
        expect(samples).to.have.a.lengthOf(2);
        expect(samples[0].name).to.be.oneOf([
          subject2AbsPath + '|' + '___Aspect1',
          subject2AbsPath + '|' + '___Aspect2',
        ]);
        expect(samples[1].name).to.be.oneOf([
          subject2AbsPath + '|' + '___Aspect1',
          subject2AbsPath + '|' + '___Aspect2',
        ]);
        const cmd = [
          ['hgetall', subject2AbsPath + '|' + '___Aspect1'],
          ['hgetall', subject2AbsPath + '|' + '___Aspect2'],
        ];
        return rcli.batch(cmd).execAsync();
      })
      .then((samples) => {
        expect(samples[0]).to.equal(null);
        expect(samples[1]).to.equal(null);
        return done();
      })
      .catch((err) => done(err));
    });

    it('should not return samples if not found', (done) => {
      const subject1AbsPath = `${tu.namePrefix}Subject1.`;
      redisOps.deleteSampleKeys(sampleStore.constants.objectType.subAspMap,
        subject1AbsPath)
      .then((samples) => {
        expect(samples).to.have.a.lengthOf(0);
        return done();
      })
      .catch((err) => done(err));
    });
  });

  describe('deleteSubjectFromAspectResourceMaps >', () => {
    it('subject deleted from aspect resource map', (done) => {
      const aspSubMapAspect2Key = sampleStore.toKey(
        sampleStore.constants.objectType.aspSubMap, a2.name
      );
      rcli.smembersAsync(aspSubMapAspect2Key)
      .then((subjectNames) => {
        expect(subjectNames).to.deep.equal(['___subject1.___subject2']);
        return redisOps.executeCommand(
          redisOps.deleteSubjectFromAspectResourceMaps(
            [a2.name], s2.absolutePath));
      })
      .then(() => rcli.smembersAsync(aspSubMapAspect2Key))
      .then((subNames) => {
        expect(subNames).to.deep.equal([]);
      })
      .then(() => done())
      .catch((err) => done(err));
    });
  });
});
