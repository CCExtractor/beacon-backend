import { allow, not, shield } from "graphql-shield";
import { isAuthenticated } from "./rules.js";

export const permissions = shield({
    Query: {
        "*": isAuthenticated,
        hello: allow,
    },
    Mutation: {
        "*": isAuthenticated,
        register: not(isAuthenticated),
        login: not(isAuthenticated),
    },
});
