const path = require("path");

module.exports = {
    entry: "./src/index.js",
    output: {
        filename: "particles2.js",
        path: path.resolve(__dirname, "dist"),
        library: {
            type: "module"
        }
    },
    experiments: {
        outputModule: true
    },
    mode: "production"
};
