# 💻 How to Run This Project from Scratch on Any Laptop or PC

This guide walks you step-by-step through setting up and running the **AI-Powered 3D Escape Room** on any fresh Windows, macOS, or Linux computer.

---

## 📋 Prerequisites

Before starting, ensure your computer has the following installed:

1. **Node.js** (v18.0 or higher)  
   - Download & Install from: [https://nodejs.org](https://nodejs.org) (LTS Version recommended)
   - Verify installation in Terminal / Command Prompt:
     ```bash
     node -v
     npm -v
     ```

2. **Python** (v3.10 or higher — *Optional for AI Cloud Server*)  
   - Download & Install from: [https://python.org](https://python.org)
   - Verify installation:
     ```bash
     python --version
     ```

---

## ⚡ Option 1: 1-Click Launch (Windows)

If you are on Windows, you can launch the game instantly with **1 click**:

1. Open the project folder (`game`).
2. Double-click **`START.bat`**.
3. It will automatically install missing dependencies and open the game in your default browser at `http://localhost:5173`.

---

## 🛠️ Option 2: Manual Setup (Windows / macOS / Linux)

### Step 1: Open Terminal / Command Prompt
Navigate into the project directory:
```bash
cd path/to/game
```

### Step 2: Install Node.js Dependencies
Run the following command to download all 3D engine packages (Three.js, Rapier Physics, GSAP, Vite):
```bash
npm install
```

### Step 3: Start the Game Server
Run the local development server:
```bash
npm run dev
```

### Step 4: Play in Your Browser
Open Chrome, Edge, or Firefox and go to:
👉 **`http://localhost:5173`**

---

## 🤖 Option 3: Starting the Python Flask AI Backend (Optional)

> **Note**: The game has a built-in **Offline Procedural AI Engine**, so running the Python server is optional. Only follow this step if you want to connect live OpenAI API keys for GPT-4o puzzle generation.

1. **Open a new terminal window** and navigate to the `server/` directory:
   ```bash
   cd game/server
   ```

2. **Create and Activate a Virtual Environment**:
   - **Windows**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install Server Packages**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set Your OpenAI API Key**:
   - **Windows (CMD)**:
     ```cmd
     set OPENAI_API_KEY=your_actual_api_key_here
     ```
   - **Windows (PowerShell)**:
     ```powershell
     $env:OPENAI_API_KEY="your_actual_api_key_here"
     ```
   - **macOS / Linux**:
     ```bash
     export OPENAI_API_KEY="your_actual_api_key_here"
     ```

5. **Start Flask Server**:
   ```bash
   python app.py
   ```
   *(Backend starts running at `http://localhost:5000`)*

---

## ❓ Troubleshooting & FAQs

- **Q: Game shows a black screen or WebGL error.**  
  - *Fix*: Ensure Hardware Acceleration is enabled in your browser settings (Chrome Settings $\rightarrow$ System $\rightarrow$ Use graphics acceleration when available).

- **Q: Background soundtrack isn't playing.**  
  - *Fix*: Click anywhere on the screen or press any key on the main menu. Modern browsers require 1 user click/keypress before playing HTML5 background audio.

- **Q: How do I build a production package for Netlify / Web deployment?**  
  - *Fix*: Run `npm run build`. The final built site will be saved in the `dist/` folder ready for deployment.
