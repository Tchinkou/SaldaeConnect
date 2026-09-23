import "server-only";

/**
 * Erreurs applicatives distinguées de toute autre exception JS, pour que
 * l'enveloppeur serveur (`action.ts`) sache lesquelles renvoyer telles
 * quelles au client (message sûr à afficher) et lesquelles masquer derrière
 * un message générique (voir docs/architecture.md §A.2, §H.2).
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

/** Aucune session valide. */
export class UnauthenticatedError extends AppError {
  constructor(message = "Connexion requise.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/** Session valide, mais permission manquante pour l'action demandée. */
export class ForbiddenError extends AppError {
  constructor(message = "Action non autorisée.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Entrée invalide (échec de validation Zod, résumé pour l'utilisateur). */
export class ValidationError extends AppError {
  constructor(message = "Données invalides.") {
    super(message);
    this.name = "ValidationError";
  }
}

/** Trop de tentatives — voir rate-limit.ts. */
export class RateLimitedError extends AppError {
  constructor(message = "Trop de tentatives, réessayez plus tard.") {
    super(message);
    this.name = "RateLimitedError";
  }
}
