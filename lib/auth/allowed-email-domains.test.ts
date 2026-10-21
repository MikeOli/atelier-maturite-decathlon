import { describe, expect, it } from "vitest";
import { isAllowedEmailDomain } from "./allowed-email-domains";

describe("isAllowedEmailDomain", () => {
  it("accepte une adresse du domaine autorisé", () => {
    expect(isAllowedEmailDomain("prenom.nom@decathlon.com")).toBe(true);
  });

  it("ignore la casse du domaine", () => {
    expect(isAllowedEmailDomain("Prenom.Nom@DECATHLON.com")).toBe(true);
  });

  it("refuse un autre domaine", () => {
    expect(isAllowedEmailDomain("quelquun@gmail.com")).toBe(false);
  });

  // Le piège classique d'un contrôle écrit avec endsWith : un domaine
  // attaquant qui se termine par le domaine autorisé.
  it("refuse un domaine qui se contente de finir par le domaine autorisé", () => {
    expect(isAllowedEmailDomain("moi@faux-decathlon.com")).toBe(false);
    expect(isAllowedEmailDomain("moi@decathlon.com.attaquant.net")).toBe(false);
  });

  it("refuse une adresse sans domaine", () => {
    expect(isAllowedEmailDomain("sansarobase")).toBe(false);
    expect(isAllowedEmailDomain("vide@")).toBe(false);
  });
});
