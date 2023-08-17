const snowyflake_1 = require("snowyflake");
const sleep = async (ms) => await new Promise((resolve) => setTimeout(resolve, ms));
module.exports.sleep = sleep;
const random = (min, max) => Math.floor(Math.random() * (max - min) + min);
module.exports.random = random;
const snowflake = new snowyflake_1.Snowyflake({
    workerId: 0n,
    processId: 0n,
    epoch: snowyflake_1.Epoch.Discord, // BigInt timestamp
});
const nextNonce = () => snowflake.nextId().toString();
module.exports.nextNonce = nextNonce;