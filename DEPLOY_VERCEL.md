# 🚀 TradeLog Frontend — Déploiement Vercel

## Prérequis
- Compte Vercel (vercel.com)
- Compte GitHub
- Repo GitHub créé (public ou privé)

---

## ÉTAPE 1 — Push sur GitHub

```bash
# Dans le dossier tradelog-front
cd tradelog-front

git init
git add .
git commit -m "feat: TradeLog frontend initial"

# Créer le repo sur github.com puis :
git remote add origin https://github.com/TON_USERNAME/tradelog-front.git
git branch -M main
git push -u origin main
```

---

## ÉTAPE 2 — Importer sur Vercel

1. Va sur **https://vercel.com/new**
2. Clique **"Import Git Repository"**
3. Sélectionne ton repo `tradelog-front`
4. Framework preset : **Next.js** (détecté auto)
5. Root directory : laisser vide (`.`)

---

## ÉTAPE 3 — Variables d'environnement

Dans Vercel → Settings → Environment Variables, ajoute :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://tradelog-api.creasity.com/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | `TradeLog` |
| `NEXT_PUBLIC_APP_URL` | `https://tradelog.creasity.com` |

---

## ÉTAPE 4 — Domaine personnalisé

```
Vercel → Ton projet → Settings → Domains
→ Ajouter : tradelog.creasity.com
```

Vercel te donnera des instructions DNS.

### Dans Cloudflare :
Ajoute un enregistrement CNAME :

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `tradelog` | `cname.vercel-dns.com` | ❌ DNS Only |

⚠️ **Important** : pour les domaines Vercel, le proxy Cloudflare doit être **désactivé** (nuage gris, pas orange). Sinon les certificats SSL de Vercel ne fonctionnent pas.

---

## ÉTAPE 5 — Déploiement automatique

Après le premier déploiement, chaque `git push main` déclenche automatiquement un nouveau build sur Vercel. Temps de build : ~45 secondes.

---

## Mises à jour

```bash
# Modifier du code, puis :
git add .
git commit -m "feat: ..."
git push

# Vercel redéploie automatiquement
```

---

## Structure des pages

| URL | Page |
|-----|------|
| `/` | Redirige vers `/dashboard` |
| `/auth/login` | Page de connexion |
| `/auth/register` | Page d'inscription |
| `/dashboard` | Dashboard KPIs + equity curve |
| `/trades` | Liste des trades avec filtres |
| `/trades/new` | Formulaire ajout trade |
| `/trades/[id]` | Détail d'un trade |
| `/analytics` | Analytics détaillées |
| `/settings` | Paramètres & comptes |
