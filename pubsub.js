const { RedisPubSub } = require("graphql-redis-subscriptions");
const Redis = require("ioredis");

const options = {
    host: process.env.REDIS_URL,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_AUTH,
    username: process.env.REDIS_USERNAME,
    retryStrategy: times => {
        // reconnect after
        return Math.min(times * 50, 2000);
    },
};

module.exports = new RedisPubSub({
    publisher: new Redis(options),
    subscriber: new Redis(options),
});
