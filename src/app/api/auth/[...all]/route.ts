import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/core/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
