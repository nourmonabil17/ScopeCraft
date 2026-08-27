// The OAuth callback, CSRF token, session and sign-out endpoints. Auth.js
// builds all of them from the config in src/auth.ts; this file only mounts
// them on a route.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
