/** Inbox: everything waiting on a person — deliverable reviews, support tickets, sensitive-data checks. */
export const inboxCopy = {
  title: "Inbox",
  description: "Reviews, support tickets and sensitive-data checks waiting on you.",
  customerTitle: "My tickets",
  customerDescription: "Questions you handed off to a person. Replies appear here and in the conversation.",
  tabsLabel: "Inbox sections",
  tabs: { reviews: "Reviews", support: "Support", privacy: "Sensitive data" },
  privacyNote: "Detected personal data is held until a person decides. Detection is rule-based.",
} as const;
