/**
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * tests/realtime/pubsub.js
 */
'use strict'; // eslint-disable-line strict
const expect = require('chai').expect;
const tu = require('../testUtils');
const Subject = tu.db.Subject;
const Aspect = tu.db.Aspect;
const Sample = tu.Sample;
const redisPublisher = require('../../realtime/redisPublisher');
const event = require('../../realtime/constants').events.sample;
const rtu = require('../cache/models/redisTestUtil');
const subClients = require('../../cache/redisCache').client.subPerspectives;

describe('tests/realtime/pubsub.js >', () => {
  describe('publish and subscribe>', () => {
    const subjectName = `${tu.namePrefix}Subject`;
    const numberOfAspects = 50;

    let subj;
    let samplesNames;
    before((done) => {
      Subject.create({ // create one subject
        isPublished: true,
        name: subjectName,
      })
        .then((createdSubj) => {
          subj = createdSubj;
          const aspNames = [];
          for (let i = 0; i < numberOfAspects; i++) {
            aspNames.push(`${tu.namePrefix}Aspect-${i}`);
          }

          // create multiple aspects
          return Promise.all(aspNames.map((aspName) => Aspect.create({
            isPublished: true,
            name: aspName,
            timeout: '30s',
          })));
        })
        // create multiple samples, num of samples = num of aspects
        .then((createdAspects) => Promise.all(createdAspects.map((asp) =>
          Sample.create({
            subjectId: subj.id,
            aspectId: asp.id,
            value: '0',
          })
        )))
        .then((createdSamples) => {
          samplesNames = createdSamples.map((sample) => sample.name);
          done();
        })
        .catch(done);
    });

    after((done) => {
      rtu.forceDelete(done);
    });

    it('subscribers receive all published messages', (done) => {
      const receivedMsgs = [];
      subClients.forEach((subscriber) => {
        subscriber.on('message', (ch, msg) => {
          receivedMsgs.push(msg);
        });
      });

      function waitForMessages(time) {
        // check for messages when we get all of them and then return
        if (receivedMsgs.length === numberOfAspects) {
          receivedMsgs.forEach((msg) => {
            const msgObj = JSON.parse(msg);
            expect(samplesNames).to.include(msgObj[event.upd].name);
          });
          return done();
        }

        return setTimeout(waitForMessages, time);
      }

      Sample.findAll()
        .then((samples) => {
          return Promise.all(samples.map((samp) =>
            redisPublisher.publishSample(samp, Subject, event.upd, Aspect)
          ));
        })
        .then(() => {
          // Check every 50ms until we get all the messages
          waitForMessages(50);
        })
        .catch(done);
    });
  });
});
