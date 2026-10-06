const { initializeApp, cert } = require("firebase-admin/app");
const fs = require("fs");
const path = require("path");

let serviceAccount;

const localKeyPath = path.join(__dirname, "../../serviceAccountKey.json");

if (fs.existsSync(localKeyPath)) {
  serviceAccount = require(localKeyPath);
} else if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_PRIVATE_KEY_BASE64 &&
  process.env.FIREBASE_CLIENT_EMAIL
) {
  const privateKey = Buffer.from(
    process.env.FIREBASE_PRIVATE_KEY_BASE64,
    "base64"
  ).toString("utf8");

  serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url:
      "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };
} else {
  throw new Error(
    "Firebase Admin credentials not found. Provide serviceAccountKey.json locally or Firebase environment variables in production."
  );
}

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
});

console.log("Firebase Admin initialized successfully");

module.exports = firebaseApp;
