# Rappels Android — design (petit chantier)

## Intention
Rappeler, sur l'APK Android, la séance du jour d'après la semaine type, et prévenir la veille d'une bascule de cycle.
L'utilisateur ouvre l'app à chaque séance ; il veut une notification soignée, pas un texte brut.

## Objectifs / non-objectifs
- Objectifs : rappel de séance quotidien à une heure unique ; rappel de bascule la veille ; réglages (activé, heure).
- Non-objectifs : heure par jour, bouton « Plus tard », notifications web, push serveur.
- Anti-objectif : un rappel pour une séance déjà faite, sautée, ou un jour de repos.

## Approches
1. **Notifications locales `@capacitor/local-notifications` (retenue)** : sans serveur ni réseau, gratuites.
   Limite : reprogrammées à chaque ouverture et changement ; au-delà de 4 semaines sans ouvrir l'app, plus de rappels.
2. Push serveur (Firebase + tâche planifiée Supabase) : fonctionne sans ouvrir l'app, mais compte Firebase et code serveur ; écartée.

## Design validé
- Rappel de séance : titre « Cycle A · Haut du corps », corps « 5 exercices · 14 séries · semaine 1 sur 2 ».
  Dépliée (`largeBody`) : liste des exercices séparés par « · », puis « 14 séries prévues · semaine 1 sur 2 ». Action « Démarrer la séance ».
- Rappel de bascule (veille du premier jour du cycle suivant) : « Demain : début du cycle B », corps « Bloc A terminé · N séances · N PR », dépliée + « Prépare ton bilan pour le coach. ».
- Petite icône : haltère blanc (vector drawable `ic_stat_mymuscle`), teinte `#d4f53c`. Groupe « MyMuscle », canaux « Séances » et « Cycles ».
- Toucher ou action : ouvre l'app sur l'accueil (la carte de séance y est déjà).
- Réglages : section « Rappels » (APK seulement) : interrupteur + heure, défaut 8 h 00. Demande de permission Android 13+ à l'activation.

## Calls du builder
- Calcul pur dans `domain/reminders.ts` : liste des rappels des 28 prochains jours à partir de la semaine type, du cycle, des exceptions et des perfs (réutilise `weekOccurrences` semaine par semaine).
- Programmation dans `platform/notifications.ts` (seul à importer le plugin) ; feature `app` déclenche la reprogrammation quand plan, cycle, séances, perfs ou réglages changent.
- Séance décalée : rappel à la date décalée. Les jours passés et l'heure déjà passée aujourd'hui sont ignorés.
- Compteurs du rappel de bascule calculés au moment de la programmation (perfs connues).
- Réglages stockés en local (préférences de l'appareil), pas en base.
- Pas de nouveaux tests (demande de l'utilisateur).
