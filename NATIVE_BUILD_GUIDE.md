# Build Android + Ubuntu executable

## Etat actuel
- Le projet est responsive mobile + desktop.
- Le projet est installable en PWA (navigateur) via `manifest.webmanifest` + `sw.js`.
- Les configs sont preparees pour generer:
  - un APK Android (Honor) via Capacitor
  - un executable Ubuntu via Tauri

## 1) Prerequis Ubuntu

### Commun
- Node.js 20+ et npm
- `npm install`

### Android (Honor)
- Android Studio
- Android SDK + Platform Tools + Build Tools
- JDK 17 (ou JDK configure par Android Studio)
- Un appareil Android avec mode developpeur + debug USB

### Ubuntu executable (Tauri)
- Rustup + Rust (`cargo`, `rustc`)
- Dependances Linux pour WebKitGTK:
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

## 2) Installer les outils natifs JS

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli @tauri-apps/cli
```

## 3) Android APK (Honor)

Initialisation (une seule fois):
```bash
npx cap add android
```

Build web + sync natif:
```bash
npm run build
npx cap sync android
```

Ouvrir Android Studio:
```bash
npx cap open android
```

Ensuite dans Android Studio:
1. `Build > Build Bundle(s) / APK(s) > Build APK(s)`
2. Recuperer l'APK genere (dossier `android/app/build/outputs/apk/`)

## 4) Ubuntu executable (Tauri)

Initialiser Tauri (une seule fois):
```bash
npx tauri init
```

Accepter les valeurs par defaut, puis verifier:
- dev command: `npm run dev -- --host`
- build command: `npm run build`
- dist dir: `../dist`

Build executable Linux:
```bash
npm run build
npx tauri build
```

Sortie typique:
- `src-tauri/target/release/bundle/`
- formats selon config: `AppImage`, `.deb`, etc.

## 5) Test mobile sur reseau local

Sur Ubuntu:
```bash
npm run dev
```

Depuis le Honor sur le meme Wi-Fi:
- ouvrir `http://IP_DE_TON_PC:5173`

Pour connaitre l'IP:
```bash
hostname -I
```

## Notes
- Dans cet environnement d'execution, l'installation npm externe est bloquee (pas d'acces `registry.npmjs.org`).
- Le guide ci-dessus est pret pour ta machine locale des que tu as internet.
