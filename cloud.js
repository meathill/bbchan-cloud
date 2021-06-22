const {
  Cloud,
  Object: AvObject,
  Query,
} = require('leanengine');
const STATUS_NORMAL = 0;
const STATUS_CANCELED = 50;
const STATUS_COMPLETED = 100;

Cloud.define('hello', function(request) {
  return 'Hello world!'
})

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
  const {
    startTime,
    endTime,
    strict,
    content,
    onlyOnce,
    number,
    name,
    roomId,
    owner,
  } = lucky.toJSON();
  if (!name) {
    throw new Error('Lucky does not exist.');
  }
  if (owner.objectId !== currentUser.id) {
    throw new Error('You dont have permission.');
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
  let winners = new Set();
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
