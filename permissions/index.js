const { allow, not, shield } = require("graphql-shield");
const { isAuthenticated } = require("./rules.js");

const permissions = shield({
    Query: {
        "*": isAuthenticated,
        hello: allow,
    },
    Mutation: {
        "*": isAuthenticated,
        requestPasswordReset: not(isAuthenticated),
        verifyPasswordResetOtp: not(isAuthenticated),
        resetPassword: not(isAuthenticated),
        register: not(isAuthenticated),
        login: not(isAuthenticated),
    },
});

module.exports = { permissions };
