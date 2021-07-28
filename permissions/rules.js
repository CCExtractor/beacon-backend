import { AuthenticationError } from "apollo-server-express";
import { rule } from "graphql-shield";

export const isAuthenticated = rule({ cache: "contextual" })(async (_parent, _args, ctx) => {
    if (ctx.user) return true;
    return new AuthenticationError("Authentication required to perform this action.");
});
