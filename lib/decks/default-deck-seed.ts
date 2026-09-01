export type SeedCard = {
  orderIndex: number;
  theme: "Strategy" | "Discovery" | "Delivery";
  title: string;
  bullets: string[];
};

export const DEFAULT_DECK_NAME = "Maturité Produit";

export const DEFAULT_DECK_DESCRIPTION =
  "16 cartes pour faire le point en équipe sur votre maturité produit, réparties en trois thèmes : Strategy, Discovery et Delivery.";

export const DEFAULT_DECK_CARDS: SeedCard[] = [
  {
    orderIndex: 1,
    theme: "Strategy",
    title: "Vision produit",
    bullets: [
      "Nous connaissons la vision de notre produit, et elle est clairement articulée avec les objectifs business.",
      "Nous sommes alignés avec les parties prenantes sur cette vision produit.",
      "Elle est incarnée : portée et défendue par quelqu'un, pas juste écrite quelque part.",
      "Nous challengeons régulièrement la vision de notre produit pour nous assurer qu'elle soit toujours d'actualité.",
    ],
  },
  {
    orderIndex: 2,
    theme: "Strategy",
    title: "Roadmap produit",
    bullets: [
      "Nous savons d'où viennent les sujets de notre roadmap : le processus de captation et de priorisation des idées est clair, qu'elles viennent du terrain ou du top management.",
      "Nous nous basons sur notre vision produit et notre discovery pour établir une roadmap sur les mois à venir (6 mois max).",
      "L'équipe a un vrai pouvoir de dire non à une initiative mal alignée, pas juste de l'exécuter.",
      "La roadmap produit est unique, partagée à l'ensemble des parties prenantes, et régulièrement mise à jour pour refléter la réalité.",
    ],
  },
  {
    orderIndex: 3,
    theme: "Discovery",
    title: "Exploration du marché — utilisateurs",
    bullets: [
      "Afin de proposer les meilleures solutions à nos clients, nous connaissons parfaitement nos utilisateurs.",
      "Nous avons une connaissance évolutive de leurs besoins : nous prenons le temps régulièrement avec eux pour récupérer leurs désirs, leurs frustrations, leurs habitudes... et les comprendre.",
    ],
  },
  {
    orderIndex: 4,
    theme: "Discovery",
    title: "Exploration du produit",
    bullets: [
      "Afin de proposer les meilleures solutions à nos clients, nous connaissons parfaitement notre produit.",
      "Nous savons comment notre produit réagit et réagira une fois sur le marché, grâce à des indicateurs chiffrés et sensés.",
    ],
  },
  {
    orderIndex: 5,
    theme: "Discovery",
    title: "Exploration du marché — concurrents et pairs",
    bullets: [
      "Afin de proposer les meilleures solutions à nos clients, nous connaissons parfaitement notre marché.",
      "Nous avons une connaissance maîtrisée de nos concurrents directs : leurs forces, leurs faiblesses, leurs menaces et leurs futures opportunités.",
      "Nous regardons aussi ce qui se fait chez nos cousins (Decathlon, Leroy Merlin...) : leurs outils, leurs pratiques, leurs choix, même quand ils ne sont pas en concurrence directe avec nous.",
    ],
  },
  {
    orderIndex: 6,
    theme: "Discovery",
    title: "Exploration des problématiques",
    bullets: [
      "Afin de ne pas nous brider sur une seule solution, nous nous forçons à comprendre et à définir nos problématiques produit.",
      "Nous investissons réellement du temps et des moyens dans la discovery, pas seulement en théorie.",
      "Nous pratiquons différents types de discovery (exploratoire, validative, continue) selon le besoin.",
      "Nous explorons régulièrement de nouvelles hypothèses afin d'affiner nos idées pour résoudre un problème.",
    ],
  },
  {
    orderIndex: 7,
    theme: "Discovery",
    title: "Validation des solutions",
    bullets: [
      "Avant de nous lancer dans le développement d'une solution, nous avons l'habitude de vérifier nos convictions (apport de valeur) en prototypant nos idées et en les confrontant à nos utilisateurs.",
      "Les résultats de nos validations influencent réellement nos décisions, ils ne sont pas juste consultés puis ignorés.",
      "Grâce aux feedbacks récoltés, nous nous assurons d'aller vers un succès.",
    ],
  },
  {
    orderIndex: 8,
    theme: "Discovery",
    title: "Minimum Valuable Product",
    bullets: [
      "Le MVP de notre produit a été travaillé et est connu de tous.",
      "Il est la base de nos projections dans le delivery.",
      "Ce concept est aussi utilisé pour toute idée nouvelle ayant de la valeur pour notre produit (feature, fix, dette technique...).",
    ],
  },
  {
    orderIndex: 9,
    theme: "Delivery",
    title: "L'équipe Produit",
    bullets: [
      "Nous connaissons et comprenons les rôles et les attentes de chacun.",
      "L'équipe a la main sur le « quoi » (le problème à résoudre), pas seulement sur le « comment » (la solution à livrer).",
      "Les PM sont responsabilisés sur les décisions stratégiques, pas cantonnés à l'exécution.",
      "L'équipe est stable, d'une taille adaptée et pluridisciplinaire.",
    ],
  },
  {
    orderIndex: 10,
    theme: "Delivery",
    title: "Fluidité de réalisation",
    bullets: [
      "La réalisation est fluide, efficace, et nous terminons rapidement les choses sans bloquants et sans retard.",
      "Nous rencontrons peu de blocages par des dépendances ou des interruptions.",
      "Nous livrons à un rythme régulier et soutenable.",
    ],
  },
  {
    orderIndex: 11,
    theme: "Delivery",
    title: "Valeur",
    bullets: [
      "Nous comprenons le contexte et la vision derrière chacun des besoins de nos clients.",
      "Nous connaissons la valeur des besoins/demandes de nos clients.",
      "Les sujets que nous adressons sont priorisés par la valeur, avec une vraie logique d'investissement produit plutôt qu'une logique de gestion de projet classique.",
      "Les budgets sont alloués et révisés en cohérence avec cette priorisation.",
    ],
  },
  {
    orderIndex: 12,
    theme: "Delivery",
    title: "Suivi de performance",
    bullets: [
      "Tout ce qui est mis à disposition des utilisateurs est suivi.",
      "Nos KPIs sont orientés impact, pas seulement delivery, et sont compris par toute l'équipe.",
      "L'utilisation des nouvelles fonctionnalités est monitorée pour s'assurer de la valeur délivrée.",
      "Une vraie boucle relie nos résultats mesurés à nos décisions produit suivantes.",
    ],
  },
  {
    orderIndex: 13,
    theme: "Delivery",
    title: "Qualité",
    bullets: [
      "Nous sommes fiers de la qualité de notre travail et confiants dans ce que nous produisons.",
      "Nous partageons un objectif qualité commun.",
    ],
  },
  {
    orderIndex: 14,
    theme: "Delivery",
    title: "Satisfaction utilisateur",
    bullets: [
      "Nos clients sont satisfaits de ce que nous livrons, et nous en sommes fiers.",
      "Nous connaissons nos clients et mesurons régulièrement leur satisfaction.",
      "Leur feedback alimente la phase d'exploration de notre produit.",
    ],
  },
  {
    orderIndex: 15,
    theme: "Delivery",
    title: "Amélioration continue",
    bullets: [
      "Nous travaillons en continu sur des points d'amélioration.",
      "Nous réalisons les plans d'actions d'amélioration.",
      "Nous prenons régulièrement le temps de faire le point sur notre façon de travailler.",
    ],
  },
  {
    orderIndex: 16,
    theme: "Strategy",
    title: "Culture produit et posture des dirigeants",
    bullets: [
      "Nos dirigeants comprennent et soutiennent activement l'approche produit ; ils ne la voient pas comme un centre de coût à exécuter.",
      "Il existe une vraie culture du test, de l'erreur et de l'apprentissage, à l'échelle de l'organisation et pas seulement de l'équipe.",
      "Les Product Managers sont perçus et traités comme des leaders porteurs d'une vision, pas comme de simples exécutants.",
    ],
  },
];
