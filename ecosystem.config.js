module.exports = {
    apps: [
        {
            script: "./index.mjs",
            watch: ".",
            env: {
                DB: "",
                JWT_SECRET: "",
                REDIS_AUTH: "",
                REDIS_USERNAME: "",
                REDIS_URL: "",
                REDIS_PORT: "",
                INSTANCE: "",
            },
        },
    ],

    deploy: {
        production: {
            user: "SSH_USERNAME",
            host: "SSH_HOSTMACHINE",
            ref: "origin/master",
            repo: "GIT_REPOSITORY",
            path: "DESTINATION_PATH",
            "pre-deploy-local": "",
            "post-deploy": "npm install && pm2 reload ecosystem.config.js --env production",
            "pre-setup": "",
        },
    },
};
