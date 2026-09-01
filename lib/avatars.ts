export type Avatar = {
  key: string;
  label: string;
  emoji: string;
  // Optional custom illustration overriding the emoji glyph — see
  // AvatarGlyph, which falls back to `emoji` for every avatar without one.
  imageSrc?: string;
};

// 24 avatars to comfortably cover the 15-participant cap (NFR2) with margin.
export const AVATARS: Avatar[] = [
  { key: "licorne-fluo", label: "Licorne Fluo", emoji: "🦄", imageSrc: "/avatars/licorne-fluo.jpg" },
  { key: "poulpe-disco", label: "Poulpe Disco", emoji: "🐙", imageSrc: "/avatars/poulpe-disco.jpg" },
  { key: "castor-boss", label: "Castor Boss", emoji: "🦫", imageSrc: "/avatars/castor-boss.jpg" },
  { key: "flamant-zen", label: "Flamant Zen", emoji: "🦩", imageSrc: "/avatars/flamant-zen.jpg" },
  { key: "panda-ninja", label: "Panda Ninja", emoji: "🐼", imageSrc: "/avatars/panda-ninja.jpg" },
  { key: "renard-malin", label: "Renard Malin", emoji: "🦊", imageSrc: "/avatars/renard-malin.jpg" },
  { key: "loutre-chill", label: "Loutre Chill", emoji: "🦦", imageSrc: "/avatars/loutre-chill.jpg" },
  { key: "hibou-sage", label: "Hibou Sage", emoji: "🦉", imageSrc: "/avatars/hibou-sage.jpg" },
  { key: "koala-cool", label: "Koala Cool", emoji: "🐨", imageSrc: "/avatars/koala-cool.jpg" },
  { key: "toucan-fiesta", label: "Toucan Fiesta", emoji: "🦜", imageSrc: "/avatars/toucan-fiesta.jpg" },
  { key: "hedgehog-espiegle", label: "Hérisson Espiègle", emoji: "🦔", imageSrc: "/avatars/hedgehog-espiegle.jpg" },
  { key: "axolotl-mystique", label: "Axolotl Mystique", emoji: "🦎", imageSrc: "/avatars/axolotl-mystique.jpg" },
  { key: "manchot-elegant", label: "Manchot Élégant", emoji: "🐧", imageSrc: "/avatars/manchot-elegant.jpg" },
  { key: "raton-laveur-farceur", label: "Raton Laveur Farceur", emoji: "🦝", imageSrc: "/avatars/raton-laveur-farceur.jpg" },
  { key: "narval-legendaire", label: "Narval Légendaire", emoji: "🐳", imageSrc: "/avatars/narval-legendaire.jpg" },
  { key: "lama-decontracte", label: "Lama Décontracté", emoji: "🦙", imageSrc: "/avatars/lama-decontracte.jpg" },
  { key: "paresseux-serein", label: "Paresseux Serein", emoji: "🦥", imageSrc: "/avatars/paresseux-serein.jpg" },
  { key: "kangourou-bondissant", label: "Kangourou Bondissant", emoji: "🦘", imageSrc: "/avatars/kangourou-bondissant.jpg" },
  { key: "chouette-curieuse", label: "Chouette Curieuse", emoji: "🦤", imageSrc: "/avatars/chouette-curieuse.jpg" },
  { key: "pingouin-audacieux", label: "Pingouin Audacieux", emoji: "🐤", imageSrc: "/avatars/pingouin-audacieux.jpg" },
  { key: "dragon-facetieux", label: "Dragon Facétieux", emoji: "🐲", imageSrc: "/avatars/dragon-facetieux.jpg" },
  { key: "abeille-productive", label: "Abeille Productive", emoji: "🐝", imageSrc: "/avatars/abeille-productive.jpg" },
  { key: "ecureuil-turbulent", label: "Écureuil Turbulent", emoji: "🐿️", imageSrc: "/avatars/ecureuil-turbulent.jpg" },
  { key: "phenix-flamboyant", label: "Phénix Flamboyant", emoji: "🐦‍🔥", imageSrc: "/avatars/phenix-flamboyant.jpg" },
];
