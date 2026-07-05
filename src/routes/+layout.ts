// Disable global prerendering at root since layouts load session cookie dynamically.
// Individual static pages can choose to opt-in using `export const prerender = true`.
export const prerender = false;
