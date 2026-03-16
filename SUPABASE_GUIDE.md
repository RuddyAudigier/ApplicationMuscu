# 🗄️ Configuration Supabase + PostgreSQL

## 📋 Qu'est-ce que Supabase?

**Supabase** = Backend PostgreSQL gratuit (comme Firebase mais avec SQL)

**Avantages:**
- ✅ PostgreSQL (base de données SQL classique)
- ✅ Authentification gratuite
- ✅ 500 MB de stockage gratuit
- ✅ Requêtes SQL puissantes
- ✅ Temps réel (Real-time subscriptions)
- ✅ Easy to use

---

## 🚀 Étapes d'installation

### Étape 1: Créer un compte Supabase gratuit

1. Allez sur **https://supabase.com**
2. Cliquez **"Sign up"** (S'inscrire)
3. Connectez-vous avec **GitHub** ou votre email
4. Vérifiez votre email

### Étape 2: Créer un nouveau projet

1. Cliquez **"New Project"**
2. Remplissez:
   - **Project Name**: `musculation-app`
   - **Database Password**: Entrez un mot de passe fort (vous le reverrez pas)
   - **Region**: `Europe` → `Paris (Belgique)` ou `Frankfurt`
3. Cliquez **"Create new project"**
4. **Attendez 2-3 minutes** que le projet se crée...

### Étape 3: Créer les tables SQL

Une fois le projet créé:

1. Allez à **"SQL Editor"** (icône SQL dans le menu)
2. Cliquez **"New Query"**
3. **Copiez tout le contenu de `SQL_SCHEMA.sql`** du projet
4. **Collez-le** dans l'éditeur SQL
5. Cliquez **"Run"** ou appuyez sur **Ctrl+Enter**

Les tables seront créées automatiquement! ✨

### Étape 4: Obtenir vos clés d'accès

1. Allez à **"Settings"** (icône ⚙️ en bas à gauche)
2. Sélectionnez **"API"**
3. Sous **"Project API keys"**, copiez:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `your-key-here`

### Étape 5: Configurer l'application

1. **Créez** un fichier `.env.local` à la racine du projet
2. **Collez:**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. **Remplacez** par vos vraies clés de Supabase

### Étape 6: Redémarrer l'application

```bash
npm run dev
```

---

## 🧪 Tester que ça marche

1. Ouvrez **http://localhost:5173**
2. Cliquez **"Commencer l'Entraînement"**
3. Allez à **"Exercices"**
4. Créez un exercice
5. Allez à **Supabase Dashboard** → **"Table Editor"**
6. Sélectionnez **"exercises"**
7. **Vous devriez voir votre exercice!** ✨

---

## 📊 Visualiser vos données

### Dans Supabase Dashboard:

1. **Table Editor** - Voir les données en tableau
2. **SQL Editor** - Écrire des requêtes SQL personnalisées
3. **Logs** - Voir les erreurs

### Requêtes SQL utiles:

#### Voir tous les exercices:
```sql
SELECT e.id, e.name, e.description, 
       ARRAY_AGG(mg.muscle_group) as muscles
FROM exercises e
LEFT JOIN muscle_groups mg ON e.id = mg.exercise_id
GROUP BY e.id, e.name, e.description;
```

#### Voir les performances d'un exercice:
```sql
SELECT exercise_name, reps, weight, performance_date
FROM performances
WHERE exercise_name = 'Développé Couché'
ORDER BY performance_date DESC;
```

#### Statistiques globales:
```sql
SELECT 
  COUNT(*) as total_series,
  COUNT(DISTINCT exercise_name) as exercices_differents,
  SUM(reps) as total_reps,
  ROUND(SUM(reps * weight)::numeric, 2) as poids_total_leve
FROM performances;
```

---

## 🔐 Sécurité importante

⚠️ **Ne commencez JAMAIS votre `.env.local` sur GitHub!**

Votre `.env.local` est déjà dans `.gitignore`. Vérifiez:

```bash
cat .gitignore | grep "env.local"
```

**Les clés Supabase:**
- `VITE_SUPABASE_URL` = Public (OK de partager)
- `VITE_SUPABASE_ANON_KEY` = Public (OK de partager)
- Pas de secret à garder comme Firebase!

---

## 🆓 Plan gratuit Supabase

| Feature | Limite |
|---------|--------|
| Stockage | 500 MB |
| Bande passante | 2 GB/mois |
| Connectionsactives | 10 |
| CPU | Partagé |
| Logs | 1 semaine |

**Plus que suffisant pour une app personnelle!** 🚀

---

## 📚 Documentation

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## ✅ Checklist complète

- [ ] Compte Supabase créé
- [ ] Projet créé
- [ ] SQL exécuté dans l'éditeur
- [ ] Clés copiées
- [ ] Fichier `.env.local` créé
- [ ] Application relancée
- [ ] Exercice créé et visible dans Supabase
- [ ] Seance créée et testée
- [ ] Performances enregistrées ✨

---

## 🆘 Dépannage

### Erreur: "Cannot find table"
**Solution**: Vérifiez que le SQL a bien été exécuté dans Supabase → SQL Editor

### Erreur: "Invalid API key"
**Solution**: Vérifiez vos clés dans `.env.local` (correctes et pas de typos)

### Les données ne s'affichent pas
1. Ouvrez les **DevTools** (F12)
2. Onglet **Console**
3. Cherchez les erreurs rouges
4. Vérifiez que les tables existent dans **Table Editor**

### Je veux réinitialiser la base

Dans **SQL Editor**, exécutez:
```sql
DROP TABLE IF EXISTS performances CASCADE;
DROP TABLE IF EXISTS coach_notes CASCADE;
DROP TABLE IF EXISTS session_exercises CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS muscle_groups CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
```

Puis réexécutez le script `SQL_SCHEMA.sql`

---

## 🎉 Vous êtes prêt!

Vous avez maintenant une véritable base de données PostgreSQL avec Supabase!

**Prochaines étapes:**
1. Utilisez l'application normalement
2. Les données se sauvegarderont automatiquement
3. Consultez Supabase Dashboard pour visualiser vos données

Besoin d'aide? Consultez la documentation Supabase! 💪
