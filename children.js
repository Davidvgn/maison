/* ================================================================
   Réglages des enfants — source unique, lue par les pages enfant
   ET par la page tablette (tablet.html).
   ================================================================ */
window.CHILDREN = {
  jeremy: {
    key: "jeremy",
    sport: {rounds:5, reps:10, plankSets:3, plankSec:45, plankPause:30, jjSets:3, jjReps:10, jjPause:60},
    sportWeights: {abdos:"", biceps:"5 kg par bras", epaules:"kettlebell 2 kg", squats:"boule de 4 kg"},
    sportNotes: {biceps:"Si c'est trop lourd : un seul poids de 5 kg tenu à deux mains pour les 2 bras (pas 5 kg par bras)."},
    manages: {key:"liam", name:"Liam"},   // Jérémy vérifie la fenêtre de Liam
    managedBy: {name:"Papa"},             // c'est David qui vérifie la fenêtre de Jérémy
    name: "Jérémy",
    color: "#2f9e6f",
    gradient: "linear-gradient(135deg,#2f9e6f,#56c98e)",
    hello: "Salut Jérémy",            // ton plus sobre (14 ans)
    celebrate: "Tout est fait. 💪",
    veilleuse: false,                 // Jérémy n'a plus de veilleuse
    poetry: false,                    // pas de poésie à son âge
    showerLead: true,                 // choisit l'ordre de passage à la douche et veille au bon déroulé
    schoolWeekdays: [1,2,3,4,5],      // école aussi le mercredi (matin)
    hairDays: [3,0],                  // cheveux : mercredi + dimanche
    morningExtra: [
      {emoji:"🪟", label:"Aérer ma chambre", note:"Ouvrir la fenêtre 5-10 min"},
      {emoji:"🏀", label:"Prendre mon sac de sport", note:"Lundi et jeudi", days:[1,4], schoolOnly:true}
    ],
    sportExtra: [
      {emoji:"🚴", label:"Faire de l'elliptique", note:"2x/semaine : mercredi & dimanche", days:[3,0]}
    ],
    eveningExtra: [
      {emoji:"🧹", label:"Passer l'aspirateur après le repas", note:"Cuisine + chaises"},
      {emoji:"🧽", label:"Nettoyer la table"},
      {emoji:"🗑️", label:"Vider l'aspirateur"},
      {emoji:"🪜", label:"Passer le balai (escalier + balcon)", note:"Ma tâche · provisoire : samedi", days:[6]},
      {emoji:"🧼", label:"Vérifier / remettre le niveau des savons", note:"Ma tâche · provisoire : samedi", days:[6]},
      {emoji:"🧴", label:"Mettre de l'Éparcyl", note:"Ma tâche · provisoire : dimanche", days:[0]}
    ]
  },

  liam: {
    key: "liam",
    sport: {rounds:5, reps:2, plankSets:3, plankSec:5, plankPause:30, jjSets:3, jjReps:10, jjPause:60},   // Liam : 2 répétitions, planche de 5 s
    sportWeights: {abdos:"", biceps:"petit poids", epaules:"petit poids", squats:"kettlebell 2 kg"},
    manages: {key:"nina", name:"Nina"},   // Liam vérifie la fenêtre de Nina
    managedBy: {name:"Jérémy"},           // Jérémy vérifie la fenêtre de Liam
    name: "Liam",
    color: "#5b8def",
    gradient: "linear-gradient(135deg,#5b8def,#7aa7f7)",
    poetry: true,
    keepClothes: true,                // garde pull + pantalon pour le lendemain
    schoolWeekdays: [1,2,4,5],   // lundi, mardi, jeudi, vendredi
    hairDays: [3,0],             // cheveux : mercredi + dimanche
    morningExtra: [
      {emoji:"💻", label:"Mettre dans mon sac : ordi, chargeur, casque, souris", schoolOnly:true},
      {emoji:"🧃", label:"Préparer ma gourde et mon goûter, et les mettre dans mon sac", note:"Eau dans la gourde + goûter dans la boîte", schoolOnly:true}
    ],
    afterSchoolExtra: [
      {emoji:"🍶", label:"Poser ma gourde et ma boîte à goûter dans la cuisine"}
    ],
    eveningExtra: [
      {emoji:"🍽️", label:"Débarrasser la table", note:"Avec Nina"},
      {emoji:"🚽", label:"Mettre les pastilles Canard WC", note:"Ma tâche · provisoire : mercredi & dimanche", days:[3,0]},
      {emoji:"🦉", label:"Faire mon Duolingo"}
    ]
  },

  nina: {
    key: "nina",
    sport: {rounds:5, reps:10, plankSets:3, plankSec:45, plankPause:30, jjSets:3, jjReps:10, jjPause:60},
    sportWeights: {abdos:"", biceps:"petit poids", epaules:"petit poids", squats:"kettlebell 2 kg"},
    managedBy: {name:"Liam"},            // Liam vérifie la fenêtre de Nina
    name: "Nina",
    color: "#d56fae",
    gradient: "linear-gradient(135deg,#d56fae,#ef9ad0)",
    poetry: true,
    keepClothes: true,                // garde pull + pantalon pour le lendemain
    schoolWeekdays: [1,2,4,5],   // lundi, mardi, jeudi, vendredi
    hairDays: [3,0],             // cheveux : mercredi + dimanche
    toiletteNote: "Me laver les mains et le visage", // pas de déo (8 ans) — à ajuster si besoin
    morningExtra: [
      {emoji:"🧃", label:"Préparer ma gourde et mon goûter, et les mettre dans mon sac", note:"Eau dans la gourde + goûter dans la boîte", schoolOnly:true}
    ],
    afterSchoolExtra: [
      {emoji:"🍶", label:"Poser ma gourde et ma boîte à goûter dans la cuisine"}
    ],
    eveningExtra: [
      {emoji:"🍽️", label:"Débarrasser la table", note:"Avec Liam"},
      {emoji:"🌸", label:"Mettre du Febreze (rideaux + maison)", note:"Ma tâche · provisoire : samedi", days:[6]},
      {emoji:"🦉", label:"Faire mon Duolingo"}
    ]
  }
};
