import type { NextRequest } from "next/server";

export const successResponse = (data?: unknown): Response => {
  return Response.json({
    success: true,
    data: data,
    error: null,
  });
};

export const errorResponse = (
  error: Error | string,
  status: number = 400,
): Response => {
  return Response.json(
    {
      success: false,
      data: null,
      error: {
        message: typeof error === "string" ? error : error.message,
      },
    },
    { status },
  );
};

export const unauthorized = (): Response => {
  return errorResponse("Unauthorized", 401);
};

export const authenticate = (request: NextRequest): boolean => {
  const authHeader = request.headers.get("authorization");
  const isAuthRequired = authHeader || process.env.NODE_ENV !== "development";
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  return !isAuthRequired || isAuthorized;
};
