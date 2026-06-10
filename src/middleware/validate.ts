import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "./errorHandler";

export interface ValidationSchemaObject {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (schema: ZodSchema | ValidationSchemaObject) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if ("safeParse" in schema) {
      // Direct ZodSchema passed, default to validating req.body
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errorMessages = result.error.issues
          .map((issue) => {
            const fieldName = issue.path.join(".");
            return `${fieldName || "Dữ liệu"}: ${issue.message}`;
          })
          .join("; ");
        throw new AppError(400, errorMessages);
      }
      req.body = result.data;
    } else {
      // Object containing body, query, and/or params schemas
      const targets: ("body" | "query" | "params")[] = [
        "body",
        "query",
        "params",
      ];

      for (const target of targets) {
        const subSchema = schema[target];
        if (subSchema) {
          const result = subSchema.safeParse(req[target]);
          if (!result.success) {
            const errorMessages = result.error.issues
              .map((issue) => {
                const fieldName = issue.path.join(".");
                return `[${target}] ${fieldName || "Trường dữ liệu"}: ${issue.message}`;
              })
              .join("; ");
            throw new AppError(400, errorMessages);
          }
          // Express exposes req.query as a getter in some versions, so do not
          // replace it directly. Mutating the existing object keeps validation
          // results available without crashing at runtime.
          if (target === "query") {
            Object.assign(req.query, result.data);
          } else {
            req[target] = result.data as any;
          }
        }
      }
    }
    next();
  };
};
