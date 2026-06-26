# Vial

<p align="center">
  <img src="image/vial-animation.svg?v=3" alt="Vial — Medicine Tracker" width="680"/>
</p>

Vial is a premium, feature-rich private client-side medical companion application themed around modern **Apple Web Design System** principles. Designed specifically for a single nurse to manage and track weekly medicine injections for patients, Vial runs entirely in the browser as a local-first Single Page Application (SPA), utilizing standard HTML5, CSS3, and JavaScript, with absolute medical privacy via offline browser `localStorage` persistence.

Vial fully supports:
- **Treatment Calendar**: A highly visual weekly grid showing daily schedules, highlighting the current day, and visually distinguishing patients whose weekly dose is administered vs. pending.
- **Clinical Database**: Detailed demographic information, prescribed dosages, clinic availability (weekly multi-select days like an alarm clock), preferred injection site, and medical notes.
- **Smart Watch Integration**: Standard HTML5 notifications designed to mirror automatically to your **Samsung Smart Watch** at the start of the day (7:00 AM) or instantly on demand.
- **Offline Capabilities**: Full Progressive Web App (PWA) support allowing direct native installation on iOS and Android devices without browser chrome.



## 📱 How to Run Locally

If you prefer to run it locally on your computer:
1. Open a terminal in the folder.
2. Launch a lightweight python development server:
   ```bash
   python -m http.server 8080
   ```
3. Open your browser and go to **`http://localhost:8080`**.

---

## ⌚ Smart Watch Notification Sync Guide

1. **Standard Notification Prompt:** Upon loading, the browser will request permission to show notifications. Click **Allow**.
2. **Mirroring to Samsung Watch:**
   - **On Desktop (Windows):** Ensure your PC is synced with your phone using **Microsoft Phone Link**. The browser notification will mirror to your phone.
   - **On Phone (PWA):** Access the web app on your phone browser, click the browser settings menu, and select **Add to Home screen** (installing it as a native PWA).
   - **Galaxy Wearable:** Open the **Galaxy Wearable** app on your phone, go to **Watch Settings > Notifications**, and ensure forwarding is enabled for your browser or Phone Link app.
3. **Testing Sync:** Scroll to the bottom **Watch Sync** section of the app and click **Test Instant Watch Notice**. A system notification will instantly fire, showing how scheduled alerts will mirror to your wrist!

---

## 🔒 Clinical Practice Privacy & Compliance
Vial is designed with a **privacy-first architecture**:
- **0% Network Tracking:** No analytics engines, cookies, external databases, or network calls are initialized.
- **Local Isolation:** 100% of patient medical details and logs are confined within the browser's isolated LocalStorage cache.
- **Offline Operation:** The PWA Service Worker allows fully functional usage without an active internet connection.
