# Guide Android Honor: Partage d'image natif (fiable)

Ce guide sert a installer et lancer l'app Android depuis ce projet, avec partage d'image via Android natif (plus fiable que le navigateur Honor).

## 1) Prerequis PC

- Android Studio installe
- SDK Android installe dans Android Studio
- `adb` disponible
- Cablage USB data OK

Verification rapide:

```bash
adb version
```

Si `adb` n'existe pas:

```bash
sudo apt update
sudo apt install android-sdk-platform-tools adb -y
```

## 2) Preparer le telephone Honor

Sur le telephone:

1. Parametres -> A propos du telephone -> tapoter `Numero de build` 7 fois
2. Parametres -> Options developpeur:
   - activer `Debogage USB`
   - activer `Installer via USB` (si present)
   - autoriser `Transfert de fichiers` en USB
3. Brancher le cable USB
4. Accepter la popup `Autoriser le debogage USB` (cocher `Toujours autoriser`)

Verification device:

```bash
adb devices
```

Tu dois voir ton telephone en `device` (pas `unauthorized`).

## 3) Installer les plugins natifs de partage image

Dans le dossier du projet:

```bash
npm install @capacitor/share @capacitor/filesystem
npm run build
npx cap sync android
```

## 4) Ouvrir Android Studio et lancer sur le Honor

```bash
npm run android:open
```

Ensuite dans Android Studio:

1. Attendre l'indexation Gradle
2. Selectionner ton telephone Honor comme device
3. Cliquer `Run` (triangle vert)

## 5) Tests de partage image dans l'app

Dans l'app Android installée:

1. Ouvrir `Seances`
2. Cliquer `Partager seance faite`
3. Verifier que la feuille de partage Android s'ouvre
4. Choisir WhatsApp / Messages / Gmail

## 6) Si le telephone n'apparait pas dans `adb devices`

### 6.1 Changer le mode USB

- Choisir explicitement `Transfert de fichiers (MTP)`

### 6.2 Relancer adb

```bash
adb kill-server
adb start-server
adb devices
```

### 6.3 Linux udev (cas frequent)

Ajouter regle udev (Huawei/Honor):

```bash
sudo bash -c 'cat > /etc/udev/rules.d/51-android.rules << RULES
SUBSYSTEM=="usb", ATTR{idVendor}=="12d1", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", MODE="0666", GROUP="plugdev"
RULES'
sudo chmod a+r /etc/udev/rules.d/51-android.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
adb kill-server
adb start-server
adb devices
```

## 7) Logs en cas de bug partage

```bash
adb logcat | grep -Ei "capacitor|share|filesystem|error"
```

## 8) Important

- Le partage image fiable sur Honor passe par l'app Android native (Capacitor), pas par le navigateur web.
- Si `npm install` echoue (pas internet/proxy), configure ton reseau puis relance l'etape 3.

