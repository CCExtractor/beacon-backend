import express from "express";
import { ApolloServer } from "apollo-server-express";
import mongoose from "mongoose";

import typeDefs from "./schema.js";
import resolvers from "./resolvers.js";

const server = new ApolloServer({ typeDefs, resolvers });

const app = express();
server.applyMiddleware({ app });

app.get("/", (req, res) => res.send("Hello World! This is a GraphQL API. Check out /graphql"));

const uri = process.env.DB;
const options = { useNewUrlParser: true, useUnifiedTopology: true };
mongoose
    .connect(uri, options)
    .then(() => app.listen({ port: 4000 }, console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)))
    .catch(error => {
        throw error;
    });
