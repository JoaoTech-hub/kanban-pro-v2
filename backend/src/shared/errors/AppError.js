// Erros de domínio, com status HTTP já embutido.
// O errorHandler global já lê `err.status`, então isso se integra sem precisar mudar nada lá.
class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflito de dados") {
    super(message, 409);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Acesso não permitido") {
    super(message, 403);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super(message, 401);
  }
}

class PlanLimitError extends AppError {
  constructor(message = "Limite do plano atual atingido") {
    super(message, 403);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  PlanLimitError,
};