export type AccountUser = {
  name: string;
  email: string;
  initials: string;
};

// Mock data — stands in for the signed-in user until real auth exists.
export const accountUser: AccountUser = {
  name: "Jamie Doe",
  email: "jamie.doe@example.com",
  initials: "JD",
};
