import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";

const options = {
    host: process.env.REDIS_URL,
    port: 19627,
    password: process.env.REDIS_AUTH,
    retryStrategy: times => {
        // reconnect after
        return Math.min(times * 50, 2000);
    },
};

export default new RedisPubSub({
    publisher: new Redis(options),
    subscriber: new Redis(options),
});
