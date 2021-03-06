/**
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * tests/db/api/botData/utils.js
 */
'use strict';
const tu = require('../../../testUtils');
const roomUtil = require('../rooms/utils');
const botUtil = require('../bots/utils');

const testStartTime = new Date();
const n = `${tu.namePrefix}TestBotData`;

const standard = {
  name: n,
  value: 'String1',
};

module.exports = {
  name: n,

  getStandard() {
    return JSON.parse(JSON.stringify(standard));
  },

  createStandard() {
    return tu.db.BotData.create(standard);
  },

  getBasic(overrideProps={}) {
    const defaultProps = JSON.parse(JSON.stringify(standard));
    return Object.assign(defaultProps, overrideProps);
  },

  doSetup(props={}) {
    const { createdBy } = props;
    return Promise.all([
      botUtil.createBasic({ installedBy: createdBy }),
      roomUtil.createBasic({ createdBy: createdBy }),
    ])
    .then(([bot, room]) => {
      const createdIds = {
        botId: bot.id,
        roomId: room.id,
      };
      return createdIds;
    });
  },

  createBasic(overrideProps={}) {
    const { createdBy } = overrideProps;
    return this.doSetup({ createdBy })
    .then(({ botId, roomId }) => {
      Object.assign(overrideProps, { botId, roomId });
      const toCreate = this.getBasic(overrideProps);
      return tu.db.BotData.create(toCreate);
    });
  },

  getDependencyProps() {
    return ['botId', 'roomId'];
  },

  forceDelete(done) {
    tu.forceDelete(tu.db.BotData, testStartTime)
    .then(() => tu.forceDelete(tu.db.Bot, testStartTime))
    .then(() => tu.forceDelete(tu.db.Room, testStartTime))
    .then(() => tu.forceDelete(tu.db.RoomType, testStartTime))
    .then(() => done())
    .catch(done);
  },
};

