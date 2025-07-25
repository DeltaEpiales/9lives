# 9 Lives Streetwear - README

This is a modern, single-page web application for a streetwear brand called "9 Lives". It's built with HTML, CSS, and vanilla JavaScript, and it uses Firebase for its backend services. This README will guide you through setting up the project, configuring Firebase, and deploying it.

## Features

* **Dynamic Product Catalog**: Products are loaded from a Firestore database.
* **Shopping Cart**: Users can add items to their cart, which is stored in Firestore.
* **Admin Panel**: A hidden admin panel allows for adding, editing, and deleting products.
* **Interactive Poll**: Users can vote on their favorite colorway for the next drop.
* **3D Animated Background**: A cool, interactive 3D background using Three.js.
* **Demo Mode**: If Firebase is not configured, the site will run in a demo mode with mock data.

## Getting Started

### Prerequisites

* Python 3.x
* A web browser
* A Firebase project (see Firebase Setup section)

### Local Development

1.  **Run the setup script**:
    ```bash
    python setup.py
    ```
    This will create all the necessary files and an `images/` directory.

2.  **Add Your Images**:
    * Place the following files inside the newly created `images/` folder:
        * `lt.png` (your main hero logo)
        * `cat1.png` (your first floating head image)
        * `cat2.png` (your second floating head image)

3.  **Start the local server**:
    * On Windows: `launch.bat`
    * On macOS/Linux: `./launch.sh`

4.  **View the site**: Open your browser to the localhost address provided in the terminal (usually `http://localhost:8000`).

## Firebase Setup

This project uses Firebase for its database and authentication. To get it working, you'll need to create a Firebase project and copy your configuration details into the `js/main.js` file.

1.  **Create a Firebase Project**:
    * Go to the [Firebase Console](https://console.firebase.google.com/).
    * Click "Add project" and follow the on-screen instructions.
2.  **Create a Firestore Database**:
    * In your Firebase project, go to the "Firestore Database" section.
    * Click "Create database" and start in **test mode**.
3.  **Enable Anonymous Authentication**:
    * Go to the "Authentication" section.
    * Click "Get started".
    * Under the "Sign-in method" tab, enable "Anonymous" authentication.
4.  **Get Your Firebase Config**:
    * In your project's settings, under the "General" tab, scroll down to "Your apps".
    * Click the "</>" icon to create a new web app.
    * Give your app a nickname and click "Register app".
    * You'll be given a `firebaseConfig` object. Copy this object.
5.  **Update `js/main.js`**:
    * Open `js/main.js` and find the `firebaseConfig` object.
    * Paste your copied configuration into this object.

## Deployment

You can deploy this site using Firebase Hosting.

1.  **Install Firebase CLI**:
    ```bash
    npm install -g firebase-tools
    ```
2.  **Login to Firebase**:
    ```bash
    firebase login
    ```
3.  **Initialize Firebase**:
    ```bash
    firebase init
    ```
    * Select "Hosting: Configure files for Firebase Hosting and (optionally) set up GitHub Action deploys".
    * Select your Firebase project.
    * Use `.` as your public directory.
    * Configure as a single-page app by responding with `yes`.
4.  **Deploy**:
    ```bash
    firebase deploy
    ```

## Demo Mode

If you don't want to set up Firebase, you can still run the site in a demo mode. This will use mock product data and disable features that require a database. To enter demo mode, simply run the project without adding your Firebase configuration to `js/main.js`.
