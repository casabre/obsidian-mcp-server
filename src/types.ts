import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

export type tool<Args extends z.ZodRawShape> = {
  name: string;
  description: string;
  schema: Args;
  handler: (
    args: z.infer<z.ZodObject<Args>>,
    extra: RequestHandlerExtra<any, any>
  ) => Promise<ToolResult>;
};
