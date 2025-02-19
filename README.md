# CCExtractor Beacon back-end

This is the backend for the Beacon app. It is written in GraphQL using Apollo and has realtime subscriptions to share user locations with one another. A MongoDB Atlas cluster is used for databasing.

## Official documentation
https://ccextractor-beacon-docs.netlify.app/

the source code of documentation can be found here: https://github.com/CCExtractor/Beacon-Documentation

## Live URL's (possibly outdated)

- `https://beacon.aadibajpai.com`: standalone version for development and testing;
- `https://agw4au70ek.execute-api.us-east-1.amazonaws.com/dev/` for production use

## Deployment

### Set up MongoDB

Through cloud.mongodb.com you can set up a (free) instance of MongoDB to store all data. 

While creating a database, make sure you do the following things:
- Write down the username/password combination after adding the user (through the quick-configuration).
- Allow all IP's to access the database (use `0.0.0.0/0`for this); FIXME (unsecure)

Once created, you can get the full URI by clicking "Connect", then select "Connect your application". The URI should look something like "mongodb+srv://<user>:<password>@<db-name>.mongodb.net/?retryWrites=true&w=majority". This URI should be stored in the `DB` variable of your `.env` file.

### Running on AWS Lambda (serverless)

```
# Install serverless and plugins needed
npm install -g serverless
serverless plugin install -n serverless-offline
# Copy the .env and update it accordingly
cp .env.example .env
nano .env
# Things you should have set up: DB (see above, "Set up MongoDB"), JWT_SECRET (random string)
# Run the install script
./script.sh "{acess key here}" "{secret key here}" {dev or prod here}
```

### Running locally

-   clone the repo
-   copy .env.sample to .env and fill variables then run:

```
npm i
npm start
```

### Old ramblings

`master` contains all the queries, mutations and subscriptions together for running on a standalone server. The `aws` branch has been modified to run the API on AWS Lambda which is a serverless platform so no resources are used while idle. This means subscriptions cannot be run since it is serverless, so we have another `manager` function that starts an ec2 instance while a beacon is active since that is only when subscriptions are necessary, and it pauses the ec2 instance when there is no beacon running. To communicate across Lambda and ec2, redis is used for the pub/sub mechanism.

for the ec2 instance, you would want to deploy the normal `master` branch to a server and set up a cron job or similar that would start the service when the instance is started after it was paused
