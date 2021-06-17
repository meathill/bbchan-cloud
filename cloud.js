const {STATUS_COMPLETED} = require("./model/lucky");
const {
  Cloud,
  Object,
  Query,
} = require('leanengine');

Cloud.define('drawWinner', async function(req) {
  const {
    currentUser,
    params: {
      luckyId,
    },
  } = req;
  const model = 'danmu'
  const roomId = currentUser.get('roomId');
  const lucky = Object.createWithoutData(model, luckyId);
  await lucky.fetch();
  const {
    startTime,
    endTime,
    strict,
    content,
    onlyOnce,
    number,
  } = lucky.toJSON();
  const query = new Query(model);
  query.equalTo('room', roomId)
    .greaterThanOrEqualTo('ts', new Date(startTime).getTime() / 1000 >> 0)
    .lessThanOrEqualTo('ts', new Date(endTime).getTime() / 1000 >> 0)
    .exists('uid');
  if (strict) {
    query.equalTo('content', content);
  } else {
    query.contains('content', content);
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
  while (winners.size < number) {
    const index = danmu.length * Math.random() >> 0;
    winners.add(index);
  }
  winners = [...winners].map(winner => danmu[winner]);
  lucky.set('winners', winners);
  lucky.set('status', STATUS_COMPLETED);
  await lucky.save();

  return {
    status: 0,
    winners,
  };
});
