"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALLOWED_EMAIL_DOMAINS,
  isAllowedEmailDomain,
} from "@/lib/auth/allowed-email-domains";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const MINIMUM_PASSWORD_LENGTH = 8;

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAllowedEmailDomain(email)) {
      setError(
        `Seules les adresses ${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" ou ")} peuvent créer un compte.`,
      );
      return;
    }
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${MINIMUM_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Le lien du mail de validation repasse par /auth/confirm, qui
          // échange le jeton contre une session puis redirige ici.
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/admin`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";

      // Le déclencheur de domaine remonte au client sous une forme
      // générique ("Database error saving new user") : sans ce rattrapage,
      // une adresse hors Décathlon afficherait un message incompréhensible.
      if (/database error|unexpected_failure/i.test(message)) {
        setError(
          `Inscription refusée. Seules les adresses ${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" ou ")} sont autorisées.`,
        );
        return;
      }

      // Le service d'envoi intégré à Supabase est plafonné à 2 mails par
      // heure. Le message brut ("email rate limit exceeded") laisse croire
      // à un refus du compte, alors qu'il n'y a qu'à attendre.
      if (/rate limit/i.test(message)) {
        setError(
          "Trop de mails de validation ont été envoyés récemment. Le service d'envoi est limité à 2 par heure : réessayez plus tard.",
        );
        return;
      }

      setError(message || "Impossible de créer le compte.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Image
        src="/decathlon-logo.png"
        alt="Décathlon"
        width={160}
        height={32}
        className="mx-auto h-8 w-[160px]"
        priority
      />
      <Card>
        {sent ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Vérifiez vos mails</CardTitle>
              <CardDescription>
                Un lien de validation vient d&apos;être envoyé à {email}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Cliquez sur ce lien pour activer votre compte, puis revenez
                vous connecter. Pensez à regarder dans les indésirables.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/login">Retour à la connexion</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Créer un compte animateur</CardTitle>
              <CardDescription>
                Réservé aux adresses{" "}
                {ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" ou ")}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Adresse e-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={`prenom.nom@${ALLOWED_EMAIL_DOMAINS[0]}`}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={MINIMUM_PASSWORD_LENGTH}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {MINIMUM_PASSWORD_LENGTH} caractères minimum.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
                    <Input
                      id="confirmation"
                      type="password"
                      required
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Création..." : "Créer mon compte"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Déjà un compte ?{" "}
                    <Link
                      href="/admin/login"
                      className="underline underline-offset-4"
                    >
                      Se connecter
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
