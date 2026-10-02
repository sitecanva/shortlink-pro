/**
 * Firebase Config Template & Initialization Guide
 * ShortLink Pro GitHub Hosted Application
 * 
 * Replace with your actual Firebase project credentials to enable cloud persistence across all users.
 */

const firebaseConfig = {
    apiKey: "AIzaSyYOUR_API_KEY_HERE",
    authDomain: "your-app-id.firebaseapp.com",
    projectId: "your-app-id",
    storageBucket: "your-app-id.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Instructions for Google Sign-In setup:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new Firebase project and register a Web App.
// 3. Enable Authentication -> Sign-in method -> Google (Gmail).
// 4. Add your GitHub Pages domain (e.g., username.github.io) to Authorized Domains in Firebase Auth settings.
// 5. Replace the credentials above and initialize Firebase SDK in index.html if using cloud database.
