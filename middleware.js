import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define the routes that are protected (require a user to be logged in)
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',           // Protects all routes starting with /dashboard
  '/api/generate-interview',  // Explicitly protect your API route
  '/api/generate-feedback',   // Protect the feedback API route
]);

export default clerkMiddleware((auth, req) => {
  // If the route is a protected route, enforce authentication
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export const config = {
  // This matcher ensures the middleware runs on all routes
  // *except* for static files and Next.js internal routes.
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};