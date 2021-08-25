# beacon-backend

This is the backend for the beacon app. It is written in GraphQL using Apollo and has realtime subscriptions to share user locations with one another. A MongoDB Atlas cluster is used for databasing.

`master` contains all the queries, mutations and subscriptions together for running on a standalone server. The `aws` branch has been modified to run the API on AWS Lambda which is a serverless platform so no resources are used while idle. This means subscriptions cannot be run since it is serverless, so we have another `manager` function that starts an ec2 instance while a beacon is active since that is only when subscriptions are necessary, and it pauses the ec2 instance when there is no beacon running. To communicate across Lambda and ec2, redis is used for the pub/sub mechanism.

The `serverless` framework is used for the Lambda deploys.

The standalone version of the running API may be found at `https://beacon.aadibajpai.com` which is for development and testing, while the production Lambda is at `https://agw4au70ek.execute-api.us-east-1.amazonaws.com/dev/` and the ec2 instance is found at `shouldwealiastheiptosomething`.

to set up:

-   clone the repo
-   copy .env.sample to .env and fill variables then run:

```
npm i
npm start
```

for the serverless stuff, your .env file will be populated to the functions so you only need to do `serverless deploy`, once you have it installed.

for the ec2 instance, you would want to deploy the normal `master` branch to a server and set up a cron job or similar that would start the service when the instance is started after it was paused
