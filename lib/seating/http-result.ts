export type SeatingRpcResult =
  | boolean
  | { ok?: boolean; error?: string; [key: string]: unknown }
  | null;

export type SeatingHttpResult = {
  body: Record<string, unknown>;
  status: number;
};

const ERROR_STATUS: Record<string, number> = {
  invalid_token: 401,
  not_authorized: 403,
  event_not_found: 404,
  floor_plan_not_found: 404,
  not_delegated: 409,
};

export function seatingRpcHttpResult(result: SeatingRpcResult): SeatingHttpResult {
  if (result === true) return { body: { ok: true }, status: 200 };
  if (result === false || result == null) {
    return { body: { ok: false, error: "operation_rejected" }, status: 409 };
  }
  if (result.ok === false || result.error) {
    const error = result.error ?? "operation_rejected";
    return {
      body: { ...result, ok: false, error },
      status: ERROR_STATUS[error] ?? 422,
    };
  }
  return { body: result, status: 200 };
}
