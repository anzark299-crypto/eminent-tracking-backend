const { initializeApp, cert } = require("firebase-admin/app");
const fs = require("fs");
const path = require("path");

let serviceAccount;

const localKeyPath = path.join(__dirname, "../../serviceAccountKey.json");

if (fs.existsSync(localKeyPath)) {
  serviceAccount = require(localKeyPath);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  serviceAccount = JSON.parse(
    Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64"
    ).toString("utf8")
  );
} else {
  throw new Error(
    "Firebase Admin credentials not found. Provide serviceAccountKey.json locally or FIREBASE_SERVICE_ACCOUNT_BASE64 in production."
  );
}

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
});

console.log("Firebase Admin initialized successfully");

module.exports = firebaseApp;
