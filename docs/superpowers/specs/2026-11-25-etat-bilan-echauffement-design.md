# État du jour, bilan de bloc, échauffements — design

L'utilisateur a demandé les 3 chantiers d'un coup, sans nouvelles questions : les choix marqués « Choix » sont ceux de Claude.

## Intention
L'utilisateur envoie au coach le compte rendu de chaque séance (le coach corrige les exos), puis ils font un bilan par bloc de 2 semaines (« comment je me sens »).
Il veut : noter sa forme et son état (général et par exercice) dans le compte rendu ; un bilan de bloc ; des échauffements (général + séries de chauffe par exercice) visibles comme tels dans le compte rendu.

## 1. État du jour (compte rendu)
- Au démarrage d'une séance : choix **Frais** / **Fatigué** (feuille de choix). Frais = séries prévues ; Fatigué = séries prévues − 1 (min 1). Choix : règle « 3 si frais, 2 si fatigué » de la méthode, appliquée à toute séance.
- **État général** : texte libre (« pas très motivé, je me sens faible… »), saisissable pendant la séance et dans le compte rendu.
- **État par exercice** : un parmi `fatigué`, `motivé`, `énergique` (se sentir fort), `mou` (se sentir faible), ou aucun. Liste dans une constante unique, extensible.
- Compte rendu (écran + PDF) : forme du jour, état général, état de chaque exercice ; **modifiables depuis l'écran du compte rendu** (le PDF reflète les modifs).

## 2. Échauffements
- **Échauffement général** : catalogue d'exercices d'échauffement (nom + détail libre, ex. « Rotations d'épaules » / « 2 × 15 avec élastique »), géré dans Programme ; chaque séance choisit ses échauffements (ordre conservé) dans le constructeur de séance.
- En séance : bloc « Échauffement » en tête, liste à cocher.
- **Séries de chauffe** par exercice : bouton « + Série de chauffe » (reps × kg), séparées des séries de travail, jamais comparées aux records, **jamais enregistrées comme performances**.
- Compte rendu + PDF : section « Échauffement » (éléments faits) et, sous chaque exercice, ligne « Chauffe : 10 × 40 kg, 5 × 60 kg », style atténué et libellé explicite.

## 3. Bilan de bloc
- Écran `/bilan` : bloc en cours par défaut, sélecteur des blocs précédents (6 derniers). Accès : carte « Bilan du bloc » sur l'accueil (mise en avant les 3 derniers jours du bloc) et lien depuis la frise.
- Contenu : cycle, dates, séances faites / prévues / sautées (d'après la semaine type), PR par exercice (liste), exercices sans PR, répartition de la forme (frais/fatigué), états par exercice (comptes), états généraux saisis (liste datée), **ressenti du bloc** (texte libre enregistré).
- Export PDF (même moteur que le compte rendu), partageable.

## Stockage
- Choix : une table singleton `journal` (id = 1) en jsonb, sur le modèle de `week_plan` : `logs` (un journal par séance terminée : id, date, séance, cycle, forme, état général, états par exercice, échauffement fait, séries de chauffe), `block_notes` (début de bloc → texte), `warmups` (catalogue + choix par séance).
  Migration additive `scripts/sql/2026-11-25_journal.sql` + `reset_complet.sql` ; table absente → repli `localStorage`.
- Le journal d'une séance est écrit à « Terminer » et mis à jour à chaque modification dans le compte rendu. Échec (hors ligne) : toast, le compte rendu local garde les données, nouvel essai à la modification suivante.

## Approches écartées
- Colonnes/tables relationnelles (logs, warmups) : plus propre en SQL mais 3 tables, mappers et migrations ; l'app est mono-utilisateur, le jsonb suffit.
- Séries de chauffe enregistrées comme performances marquées : polluerait records et imports.

## Contraintes
- Pas de nouveaux tests (demande utilisateur) : tsc, eslint, suite existante (adapter au minimum les tests cassés).
- Couches ESLint existantes ; textes en français ; design noir & citron existant (`src/ui`).
