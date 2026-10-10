# Synchronisation entre appareils (Firebase)

Les coches faites sur un téléphone apparaissent sur la tablette et sur les autres appareils, et inversement, en direct. Sans réseau, la coche reste sur l'appareil et part dès que la connexion revient.

Tant que `firebase-config.js` est vide, chaque appareil garde ses coches pour lui, comme avant. Seule différence : le premier chargement après la mise à jour efface les coches en cours (nouveaux identifiants de tâches). **Pousse la mise à jour un soir de semaine**, une fois les coches du jour faites.

## Ce qui est public, ce qui ne l'est pas

| Élément | Où il est | Public ? |
|---|---|---|
| Code du site, `firebase-config.js` (clé API web + adresse de la base) | Dépôt GitHub | Oui, et c'est prévu : ces deux valeurs disent *où* est la base, elles n'ouvrent rien |
| `database.rules.json` (qui a le droit de lire/écrire quoi) | Dépôt GitHub | Oui : la sécurité ne repose pas sur le secret des règles |
| Mots de passe des comptes | Nulle part : tapés une fois sur chaque appareil et envoyés à Google, le site ne les enregistre pas (refuse si le navigateur propose de les mémoriser) | Non |
| Jeton de connexion de chaque appareil | Stockage local de l'appareil | Non |
| Les coches (qui a fait quoi, à quelle heure) | Base Firebase, lisible seulement par les comptes autorisés | Non |
| Liste des comptes autorisés (`members`) | Base Firebase, modifiable seulement depuis la console | Non |

Le jeton de connexion est rangé dans le stockage du site `davidvgn.github.io`, partagé par tous les sites GitHub Pages de ce compte : n'active pas GitHub Pages sur un autre dépôt du compte qui chargerait des scripts extérieurs.

À ne **jamais** mettre dans le dépôt : un mot de passe, la « clé secrète de base de données » (Paramètres > Comptes de service) ou un fichier de compte de service. Le site n'en a pas besoin.

Qui peut faire quoi, avec les règles de `database.rules.json` :

- un compte enfant lit et coche **seulement ses propres tâches** (Liam ne peut ni voir ni cocher celles de Nina) ;
- le compte `famille` (tablette + téléphone du parent) lit et coche pour les trois ;
- n'importe quel autre compte, même créé par un inconnu avec la clé publique, n'a accès à **rien** : il n'est pas dans `members` ;
- personne, même un compte autorisé, ne peut modifier `members` depuis le site ;
- une coche ne peut contenir qu'une date et une heure (`2026-10-10 18:42`), à un emplacement de forme prévue ;
- l'état de la maison (lave-vaisselle, sèche-linge, étendage) est lisible par les comptes autorisés ; seuls les parents peuvent lancer une machine ; un enfant ne peut que **valider l'étape en cours** (la base n'accepte que la valeur du déclencheur actuel : impossible d'écrire une date truquée, de rouvrir une étape ancienne, ou de valider pour un frère ou une sœur) et jamais l'effacer. Un enfant peut en revanche fermer une étape partagée (ex. « vider le lave-vaisselle ») pour tout le monde, ce qui est voulu : le premier qui le fait.

## Mise en place (une fois, environ 20 minutes, depuis un ordinateur)

### 1. Créer le projet
[console.firebase.google.com](https://console.firebase.google.com) > **Créer un projet** > un nom (ex. `maison-vignon`).
Désactive **Google Analytics** et **Gemini dans Firebase** (inutiles ici). Ne rattache **jamais** de compte de facturation : c'est ce qui garantit la gratuité (voir « Gratuit » plus bas).

### 2. Créer la base
Menu **Databases & Storage** (anciennement *Créer*) > **Realtime Database** > **Créer une base de données**.
- Emplacement : **Belgique (europe-west1)** — il ne peut plus être changé ensuite.
- Règles de départ : **mode verrouillé** (surtout pas le mode test, qui ouvre la base à tout le monde pendant 30 jours).

Note l'adresse affichée en haut de l'onglet **Données** : `https://…europe-west1.firebasedatabase.app`.

### 3. Activer la connexion par e-mail
**Security > Authentication** > **Commencer** > onglet **Sign-in method** > **Adresse e-mail/Mot de passe** > activer (pas le « lien par e-mail ») > Enregistrer.

Puis onglet **Settings** > **User actions** :
- **décoche « Enable create (sign-up) »** si l'option est là : plus personne ne pourra se créer de compte avec la clé publique (même sans ça, un tel compte n'aurait accès à rien) ;
- vérifie que **Email enumeration protection** est cochée.

### 4. Créer les 4 comptes
**Authentication > Users > Ajouter un utilisateur**, quatre fois :

| Compte | Pour quel appareil | E-mail (exemple) |
|---|---|---|
| jeremy | téléphone de Jérémy | `ton.adresse+jeremy@gmail.com` |
| liam | téléphone de Liam | `ton.adresse+liam@gmail.com` |
| nina | téléphone de Nina | `ton.adresse+nina@gmail.com` |
| famille | tablette de la cuisine + ton téléphone | `ton.adresse+famille@gmail.com` |

- L'astuce `+prénom` donne 4 adresses valides qui arrivent toutes dans ta boîte (utile pour un mot de passe oublié). Aucune n'est écrite dans le dépôt.
- Mots de passe : **longs, obligatoirement** (16 caractères ou 4 mots au hasard). Ils ne sont tapés qu'une fois par appareil, et la clé publique permet à n'importe qui d'essayer de les deviner : les adresses, elles, se devinent facilement.
- Note l'**UID** de chaque compte (colonne « UID utilisateur »).

Un compte `famille` partagé entre la tablette et ton téléphone suffit. Si tu préfères pouvoir couper la tablette seule, crée un 5ᵉ compte `tablette` et donne-lui aussi le rôle `famille` à l'étape 5.

### 5. Donner les droits (`members`)
**Realtime Database > Données** > survole la racine > **+** :
- clé `members`, puis dedans une entrée par compte : clé = l'**UID**, valeur = `jeremy`, `liam`, `nina` ou `famille` (en minuscules, sans guillemets dans le champ valeur, type chaîne).

Résultat attendu :
```
members
  ├─ Xy12…(UID de Jérémy) : "jeremy"
  ├─ Ab34…(UID de Liam)   : "liam"
  ├─ Cd56…(UID de Nina)   : "nina"
  └─ Ef78…(UID famille)   : "famille"
```

### 6. Coller les règles
**Realtime Database > Règles** > remplace tout par le contenu de [`database.rules.json`](database.rules.json) > **Publier**.
À refaire chaque fois que ce fichier change (ex. quand la maison a été ajoutée), **avant** de mettre le site en ligne : le site ne casse pas si les règles sont en avance, il se contente de garder les tâches habituelles tant que la base ne répond pas.

Vérifie-les avec le **Rules Playground** (bouton dans l'éditeur de règles, « Authentifié » + UID) :

| Type | Emplacement | Compte | Données | Attendu |
|---|---|---|---|---|
| lecture | `/done/2026-10-10/jeremy` | UID de Jérémy | | ✅ autorisé |
| lecture | `/done/2026-10-10/liam` | UID de Jérémy | | ❌ refusé |
| écriture | `/done/2026-10-10/jeremy/matin_Fairemonlit` | UID de Jérémy | `"2026-10-10 18:42"` | ✅ autorisé |
| écriture | `/done/2026-10-10/jeremy/matin_Fairemonlit` | UID de Jérémy | `"n'importe quoi"` | ❌ refusé |
| écriture | `/done/2026-10-10/nina/matin_Fairemonlit` | UID de Jérémy | `"2026-10-10 18:42"` | ❌ refusé |
| lecture | `/done/2026-10-10` | UID famille | | ✅ autorisé |
| lecture | `/done/2026-10-10` | non authentifié | | ❌ refusé |
| écriture | `/members/<ton UID>` | UID famille | `"famille"` | ❌ refusé |
| écriture | `/house/dishwasher/launched` | UID famille | `"2026-10-10 20:05"` | ✅ autorisé |
| écriture | `/house/dishwasher/launched` | UID de Liam | `"2026-10-10 20:05"` | ❌ refusé |
| écriture | `/house/dishwasher/emptied` (après un `launched` de `"2026-10-10 20:05"`) | UID de Liam | `"2026-10-10 20:05"` | ✅ autorisé |
| écriture | `/house/dishwasher/emptied` | UID de Liam | `"2000-01-01 00:00"` (autre valeur) | ❌ refusé |
| suppression | `/house/dishwasher/emptied` | UID de Liam | | ❌ refusé |
| écriture | `/house/rack/nina` | UID de Liam | (même valeur que `hung`) | ❌ refusé |
| lecture | `/house` | UID de Liam | | ✅ autorisé |
| lecture | `/house` | non authentifié | | ❌ refusé |

### 7. Récupérer la clé API web
**⚙️ Paramètres du projet > Général > Vos applications > icône Web `</>`** > surnom `maison` (ne coche pas Firebase Hosting) > **Enregistrer**.
Dans le bloc de code affiché, copie la valeur de `apiKey` (commence par `AIza…`). Ignore le reste : le site n'utilise pas le kit Firebase.

### 8. Restreindre la clé (recommandé)
[console.cloud.google.com](https://console.cloud.google.com) > ton projet > **API et services > Identifiants** > la clé « Browser key (auto created by Firebase) » :
- **Restrictions relatives aux applications** : *Sites Web*, deux lignes :
  - `https://davidvgn.github.io/*` (le site)
  - `https://<id-du-projet>.firebaseapp.com/*` (la page Firebase qui sert aux e-mails « mot de passe oublié » ; l'id du projet est dans Paramètres du projet > Général)
- **Restrictions relatives aux API** : garder seulement **Identity Toolkit API** et **Token Service API**.

Ça ne remplace pas les règles (un script peut imiter un site), mais ça coupe l'usage de la clé ailleurs. Si quelque chose est mal réglé ici, la page de connexion le dit (« Clé API refusée »), et les appareils déjà connectés affichent dans l'heure « ⚙️ Réglage Firebase à revoir » : ils ne sont pas déconnectés, leurs coches attendent sur l'appareil. Après cette étape, teste la réinitialisation une fois : Authentication > Users > ⋮ sur un compte > **Réinitialiser le mot de passe**, puis ouvre le lien reçu par e-mail et choisis un nouveau mot de passe (le site lui-même n'a pas de bouton « mot de passe oublié »).

### 9. Remplir `firebase-config.js`
```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza…",
  databaseURL: "https://…europe-west1.firebasedatabase.app"
};
```
Commit, push : GitHub Pages met le site à jour en une ou deux minutes.

### 10. Connecter chaque appareil
Sur chaque appareil : ouvrir la page de la maison > en bas, **🔐 Connexion de cet appareil** > e-mail + mot de passe du compte.

- **Tablette Android** (et téléphones Android) : ouvre la page dans Chrome et connecte-toi (pastille rouge « 🔒 Connecter la tablette » en haut). Pour avoir une icône : menu ⋮ > Ajouter à l'écran d'accueil (vérifie sur la tablette ce que ton Chrome propose : le site n'a pas de manifeste, donc c'est un simple raccourci). En principe la connexion faite dans Chrome vaut aussi pour l'icône, puisque c'est le même navigateur ; si l'icône affiche « pas connecté », reconnecte depuis l'icône.
- **iPhone/iPad** : mets la page de l'enfant en **icône d'écran d'accueil** (Partager > Sur l'écran d'accueil) et fais la connexion **depuis cette icône** (bandeau jaune « Appareil pas connecté » > Connecter). L'icône a son propre stockage, séparé de Safari, et elle échappe au ménage automatique de Safari : dans un simple onglet Safari, une page pas ouverte pendant plus d'une semaine perd sa connexion, et il faut la refaire.
- Si le navigateur propose d'enregistrer le mot de passe : **Jamais**, surtout sur la tablette et les téléphones des enfants.
- Tablette et ton téléphone : compte `famille`. Ton téléphone ouvre ensuite `tablet.html` : tu y vois les trois enfants, et l'heure de chaque coche.
- Les coches faites sur un appareil avant sa connexion sont envoyées à la base au moment où il se connecte.

## La maison : lave-vaisselle, sèche-linge, étendage

Sur la page de la tablette (et sur ton téléphone, connecté en compte `famille`), trois tuiles apparaissent au-dessus des cartes des enfants.

| Tuile | Les parents appuient | Les enfants voient | Quand ça disparaît |
|---|---|---|---|
| 🍽️ Lave-vaisselle | **Lancé** | « Vider le lave-vaisselle » (ne bloque l'écran que s'il a été lancé un jour précédent, hors mercredi et week-end) | un enfant appuie sur la tâche (ou toi sur **✓ Vidé**) : elle disparaît chez tous |
| 🧺 Sèche-linge | **Lancé** | « Sortir les serviettes du sèche-linge », puis « Plier les serviettes et les torchons, et les ranger » (facultatifs, ne comptent pas pour l'écran) | chaque étape est validée par le premier enfant qui la fait (ou par toi : **✓ Sorties**, **✓ Rangées**) |
| 👕 Étendage | **Linge étendu** | « Récupérer mon linge sec sur l'étendage et le ranger », pour chaque enfant (ne bloque pas l'écran) | chaque enfant la coche pour lui ; la tuile montre qui a fini |

- **↺ Annuler** corrige un appui par erreur (il clôt l'étape en cours : la base le refuse si quelqu'un a relancé entre-temps) ; **✓ Vidé / Sorties / Rangées** valide l'étape à la place des enfants.
- Un deuxième appui sur le même bouton moins de 2 secondes après le premier est ignoré. « Linge étendu » est masqué tant qu'un enfant n'a pas récupéré le sien.
- Un « Lancé » ou « Linge étendu » resté plus de 10 minutes en attente (appareil sans réseau) n'est pas rejoué : il rouvrirait une étape déjà faite.
- La durée d'un cycle n'est pas connue : les tâches apparaissent dès l'appui sur « Lancé », avec l'heure. Les enfants attendent que la machine soit arrêtée.
- Si tu oublies d'appuyer sur « Lancé », les enfants ne voient rien : c'est le bouton qui déclenche la tâche (elle remplace l'ancienne tâche fixe « Vider le lave-vaisselle »).
- Tant que l'appareil n'est pas connecté, ou que les nouvelles règles ne sont pas publiées, les pages gardent l'ancienne tâche fixe.
- Les tâches de la maison ne comptent pas dans la barre de progression des enfants.
- Un enfant qui utilise la tablette (connectée en `famille`) peut aussi appuyer sur les boutons, y compris « Annuler » : c'est à surveiller.

## Au quotidien

- Rien à faire. Un bandeau n'apparaît que s'il y a un souci : appareil pas connecté, pas de réseau (avec le nombre de coches en attente), accès refusé.
- Une tâche « 1 fois ce week-end » cochée samedi n'apparaît plus dimanche. Cochée dimanche, elle reste visible (cochée) jusqu'au soir.
- Pour ajouter une tâche « 1 fois ce week-end » dans `children.js` : `scope:"weekend"` sur la tâche, dans `morningExtra`, `sportExtra` ou `eveningExtra` (pas `afterSchoolExtra`, réservé aux jours d'école). Elle n'apparaît alors que samedi et dimanche.
- Les étapes intérieures des pages Sport et « Comment faire » (tours cochés, étapes du guide) restent sur l'appareil ; seule la tâche finale est partagée.

## Téléphone perdu, ou couper un appareil

1. **Tout de suite** : Realtime Database > Données > `members` > supprime la ligne de son UID. L'appareil perd l'accès à la requête suivante.
2. **Ensuite** : Authentication > Users > ce compte > **Supprimer le compte** (pas seulement le désactiver : un compte réactivé pourrait redonner l'accès à l'appareil perdu).
3. Crée un nouveau compte (étape 4 : il aura un **nouvel UID**), ajoute ce nouvel UID dans `members` (étape 5), et connecte le nouvel appareil.

Avec un compte `famille` partagé, l'étape 1 coupe aussi la tablette (et ton téléphone) : reconnecte-les avec le nouveau compte. C'est la raison d'être de l'option « 5ᵉ compte `tablette` » de l'étape 4.

## Gratuit, et ça le reste

- Le projet reste sur le plan **Spark** (gratuit) tant qu'aucun compte de facturation n'y est rattaché. Sans moyen de paiement, Google ne peut rien facturer : si une limite est dépassée, le service s'arrête jusqu'au mois suivant, c'est tout.
- Limites Spark : 1 Go stocké, 10 Go téléchargés par mois, 100 connexions ouvertes en même temps. La maison en utilise une infime partie : quelques dizaines de Ko par jour, et deux à trois connexions ouvertes par appareil allumé (le jour, le week-end si besoin, et la maison).
- À ne pas activer : Cloud Storage, Cloud Functions, App Hosting, passage au plan Blaze. Rien de tout ça n'est utile ici.
- Seul risque théorique : quelqu'un qui bombarderait l'adresse de la base pourrait épuiser le quota du mois (même les requêtes refusées comptent). Conséquence : synchro coupée jusqu'au mois suivant, les coches restent sur les appareils. Jamais de facture.

## Tester en local

`firebase-config.js` accepte deux réglages réservés aux tests (`authBase`, `tokenBase`) pour pointer vers un faux serveur. Ne pas les remplir en production.
