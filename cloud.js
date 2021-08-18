const {
  Cloud,
  Object: AvObject,
  Query,
} = require('leanengine');
const {use} = require("express/lib/router");
const STATUS_NORMAL = 0;
const STATUS_CANCELED = 50;
const STATUS_COMPLETED = 100;

const USER_NORMAL = 0;
const USER_FORBIDDEN = 100;

Cloud.define('drawWinner', async function(req) {
  const {
    currentUser,
    params: {
      luckyId,
    },
  } = req;
  if (!currentUser) {
    throw new Error('Not logged in.');
  }
  if (!luckyId) {
    throw new Error('Lucky ID is needed.');
  }

  const model = 'lucky'
  let lucky = AvObject.createWithoutData(model, luckyId);
  lucky = await lucky.fetch();
  let {
    startTime,
    endTime,
    strict,
    content,
    onlyOnce,
    number,
    name,
    roomId,
    owner,
    winners,
  } = lucky.toJSON();
  if (!name) {
    throw new Error('Lucky does not exist.');
  }
  if (owner.objectId !== currentUser.id) {
    throw new Error('You dont have permission.');
  }
  if (winners && winners.length) {
    throw new Error('This lucky already has winners');
  }

  const query = new Query('danmu');
  query.equalTo('room', roomId)
    .greaterThanOrEqualTo('ts', new Date(startTime).getTime() / 1000 >> 0)
    .lessThanOrEqualTo('ts', new Date(endTime).getTime() / 1000 >> 0)
    .exists('uid');
  if (content) {
    if (strict) {
      query.equalTo('content', content);
    } else {
      query.contains('content', content);
    }
  }
  let danmu = await query.find();
  if (onlyOnce) {
    danmu = Object.values(danmu.reduce((memo, item) => {
      const uid = item.get('uid');
      memo[uid] = item;
      return memo;
    }, {}));
  }
  winners = new Set();
  if (danmu.length <= number) {
    winners = danmu;
  } else {
    while (winners.size < number) {
      const index = danmu.length * Math.random() >> 0;
      winners.add(index);
    }
    winners = [...winners].map(winner => danmu[winner]);
  }
  lucky.set('winners', winners);
  lucky.set('status', STATUS_COMPLETED);
  await lucky.save();

  return {
    status: 0,
    winners,
  };
});

Cloud.onLogin(request => {
  if (request.object.get('status') === USER_FORBIDDEN) {
    throw new Cloud.Error('您的账户状态异常，请联系开发者。');
  }

  request.object.set('lastLoginTime', new Date());
  let ipAddress = request.meta.remoteAddress;
  request.object.set('lastLoginIp', ipAddress);
});

Cloud.define('changePassword', async function (req) {
  const {
    currentUser,
    params: {
      password,
      oldPassword,
    },
  } = req;
  if (!currentUser) {
    throw new Cloud.Error('Not logged in.');
  }

  await currentUser.updatePassword(oldPassword, password);
  return {
    status: 0,
    data: 'ok',
  };
});

Cloud.define('setUser', async function (req) {
  const {
    currentUser,
    params: {
      userId,
      status,
      rooms,
      password,
    },
  } = req;
  if (!currentUser) {
    throw new Cloud.Error('Not logged in.');
  }
  const roles = await currentUser.getRoles();
  const role = roles.find(role => role.getName() === 'niceguy');
  if (!role) {
    throw new Cloud.Error('You are not administrator, you don\'t have permission');
  }
  if (!userId) {
    throw new Cloud.Error('User ID is needed.');
  }

  const query = new Query('_User');
  const user = await query.get(userId);
  if (status !== undefined) {
    user.set('status', status);
  }
  if (rooms !== undefined) {
    user.set('rooms', rooms.split(/\s*[,，]\s*/));
  }
  if (password !== undefined) {
    user.setPassword(password);
  }
  try {
    await user.save();
    return {
      status: 0,
      data: 'ok',
    };
  } catch (e) {
    throw new Cloud.Error(`操作用户 status => ${status} 失败。${e.message}`);
  }
});
