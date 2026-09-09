const { initializeApp, cert } = require("firebase-admin/app");

const firebaseCredentials = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

const firebaseApp = initializeApp({
  credential: cert(firebaseCredentials),
});

console.log("Firebase Admin initialized successfully");

module.exports = firebaseApp;