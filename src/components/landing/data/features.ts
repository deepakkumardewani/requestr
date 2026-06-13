export interface Feature {
  id: string;
  title: string;
  description: string;
}

export const FEATURES: Feature[] = [
  {
    id: "multi-tab",
    title: "Multi-tab workspace",
    description:
      "Keep multiple requests open side-by-side. Switch between GET, POST, and DELETE without losing context.",
  },
  {
    id: "env-vars",
    title: "Environment variables",
    description:
      "Use {{BASE_URL}} and {{API_KEY}} across all requests. Switch between dev, staging, and prod in one click.",
  },
  {
    id: "collections",
    title: "Collections",
    description:
      "Organize requests into folders. Drag, drop, and reorder. Import from Postman v2.1 in seconds.",
  },
  {
    id: "response-viewer",
    title: "Response viewer",
    description:
      "Formatted JSON tree, raw mode, headers — all in one panel. Color-coded status codes at a glance.",
  },
  {
    id: "import-formats",
    title: "Import anything",
    description:
      "Import collections from Postman v2.1, Insomnia, and cURL commands with zero friction.",
  },
  {
    id: "method-theming",
    title: "Method theming",
    description:
      "Every HTTP method has its own color. GET is emerald, DELETE is red — your API is always scannable.",
  },
];
