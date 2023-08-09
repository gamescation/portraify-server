const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: "mt1",
  useTLS: true
});

module.exports ={
    async pushToPusher(channelName, eventName, message) {
        await pusher.trigger(channelName, eventName, {
            message
        });
    }
}