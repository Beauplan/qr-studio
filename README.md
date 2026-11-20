# QR Studio

A free, client-side QR code generator built with React, Vite, `qrcode`, and Lucide icons.

## Start locally

```powershell
npm install
npm run dev
```

## Build for Netlify

```powershell
npm run build
```

Upload the generated `dist` folder to Netlify Drop, or connect a Git repository with build command `npm run build` and publish directory `dist`.

## Before publishing

- Replace the generic Buy Me a Coffee URL in `src/App.jsx` with your own account URL, or remove the button until you have one.
- Test generated codes on a real phone, especially Wi-Fi codes and codes containing logos.
- The generator runs in the browser and does not store user data. QR codes are static, so their destinations cannot be changed after printing.
- QR payloads are not validated for reachability; for example, a mistyped website address may generate a QR code that leads nowhere.
- Fonts are loaded from Google Fonts; remove the `@import` in `src/styles.css` if you want the interface to avoid external font requests.
