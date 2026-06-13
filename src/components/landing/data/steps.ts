export interface Step {
  number: string;
  title: string;
  description: string;
}

export const STEPS: Step[] = [
  {
    number: "01",
    title: "Open",
    description:
      "Visit the app in any browser tab. No download, no login screen, no onboarding wizard to click through.",
  },
  {
    number: "02",
    title: "Build",
    description:
      "Pick a method, enter your URL, add headers or a body. Import an existing collection from Postman or Insomnia in one click.",
  },
  {
    number: "03",
    title: "Send & inspect",
    description:
      "Hit send. See status code, timing, headers, and a formatted JSON response. Your data never leaves the tab.",
  },
];
