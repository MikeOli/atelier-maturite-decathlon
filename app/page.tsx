import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-7 p-6 text-center">
      <Image
        src="/decathlon-logo.png"
        alt="Décathlon"
        width={130}
        height={26}
        className="h-[26px] w-[130px]"
        priority
      />
      <div className="flex flex-col gap-3 max-w-md">
        <h1 className="font-display text-[clamp(24px,3.6vw,30px)] font-bold tracking-tight">
          Atelier de maturité produit
        </h1>
        <p className="text-muted-foreground">
          Évaluez ensemble la maturité de votre équipe, carte par carte.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/admin">Espace animateur</Link>
      </Button>
      <p className="text-sm text-muted-foreground max-w-md">
        Participant ? Scannez le QR code affiché par votre animateur pour
        rejoindre la session.
      </p>
    </main>
  );
}
