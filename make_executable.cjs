const fs = require('fs');
fs.chmodSync('android/gradlew', 0o755);
console.log('Made gradlew executable');
