# 🏋️‍♂️ Application Muscu

Une application complète de suivi de musculation, développée en utilisant **Claude Code** et **Mistral IA**. 

Ce projet permet aux pratiquants de musculation de suivre leurs séances, leurs performances, d'utiliser l'échelle RPE et d'organiser leurs cycles d'entraînement, le tout encapsulé dans une application mobile via Capacitor.

## ✨ Fonctionnalités Principales

*   📅 **Suivi des séances** : Enregistrement des dates de séances et historique détaillé.
*   📈 **Gestion des Cycles** : Création et suivi de cycles d'entraînement pour une progression optimale (ex: Cycle 2).
*   🏆 **Personal Records (PR)** : Système pour tester, calculer et enregistrer ses records personnels sur les différents exercices.
*   📊 **Échelle RPE & Labels** : Évaluation de la difficulté des séries via l'échelle RPE (Rating of Perceived Exertion) et système d'étiquettes personnalisées.
*   📱 **Application Mobile Native** : Export Android fonctionnel avec fonctionnalités spécifiques (comme le partage d'images sur appareils Honor).

## 🛠️ Technologies Utilisées

*   **Frontend Web** : JavaScript, CSS, HTML (Build ultra-rapide avec [Vite](https://vitejs.dev/)).
*   **Backend & Base de données** : [Supabase](https://supabase.com/) / PostgreSQL (Gestion de l'authentification, requêtes et migrations de base de données).
*   **Mobile** : [Capacitor](https://capacitorjs.com/) pour transformer l'application web en véritable application native Android.
*   **Déploiement** : Prêt à être déployé sur des plateformes web via `netlify.toml` et `vercel.json`.
*   **IA de Développement** : Claude Code & Mistral IA.

## 📁 Architecture du Projet

L'architecture s'appuie sur une structure moderne :

```text
├── android/               # Code natif généré pour l'application Android
├── src/                   # Code source principal (JS/CSS) de l'application
├── public/                # Assets statiques (images, icônes)
├── scripts/               # Scripts utilitaires (ex: check_db.js)
├── *.sql                  # Scripts de création, migration et tests pour Supabase (RPE, PR, Cycles)
├── capacitor.config.ts    # Configuration du pont mobile Capacitor
├── vite.config.js         # Configuration du bundler Vite
└── package.json           # Dépendances Node.js

🚀 Installation et Lancement local
Prérequis

    Node.js installé sur votre machine.

    Un projet Supabase configuré (voir SUPABASE_GUIDE.md).

    Android Studio (uniquement pour compiler l'application mobile).

Lancer le projet Web

    Cloner le dépôt
    code Bash

    git clone https://github.com/RuddyAudigier/ApplicationMuscu.git
    cd ApplicationMuscu

    Installer les dépendances
    code Bash

    npm install

    Configurer la base de données
    Exécutez les scripts .sql présents à la racine directement dans le SQL Editor de votre interface Supabase pour initialiser vos tables (ex: SQL_SCHEMA.sql).

    Lancer le serveur de développement
    code Bash

    npm run dev

📱 Build Mobile (Android)

L'application utilise Capacitor pour générer l'APK Android. Pour la compiler :
code Bash

# 1. Construire la version de production web
npm run build

# 2. Synchroniser les nouveaux fichiers avec le projet Android
npx cap sync android

# 3. Ouvrir le projet dans Android Studio pour compiler l'application
npx cap open android

(💡 Voir le fichier NATIVE_BUILD_GUIDE.md et GUIDE_ANDROID_HONOR_PARTAGE_IMAGE.md pour des astuces de build avancées).
🤝 Remerciements & Création

Projet pensé, structuré et codé par RuddyAudigier, avec l'assistance des intelligences artificielles Claude Code (Anthropic) et Mistral IA
