const { initializeApp, cert } = require("firebase-admin/app");
const path = require("path");

const serviceAccount = require(
  path.join(__dirname, "../../serviceAccountKey.json")
);

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
});

console.log("Firebase Admin initialized successfully");

module.exports = firebaseApp;