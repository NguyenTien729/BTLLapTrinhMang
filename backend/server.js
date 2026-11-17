require("dotenv").config();
const connectDB = require("./config/db");

async function start() {
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32)
        throw new Error("JWT_SECRET phải có ít nhất 32 byte.");
    await connectDB();
    await require("./src/models/User").init();
    require("./src/app").listen(process.env.PORT || 5000, () => console.log("PTITChat API đã sẵn sàng."));
}
start().catch((error) => {
    console.error(error);
    const servers = error.reason?.servers || error.cause?.servers;
    if (servers) {
        for (const [address, server] of servers) {
            console.error(`MongoDB node ${address}:`);
            console.dir(server.error, { depth: null });
        }
    }
    process.exit(1);
});
