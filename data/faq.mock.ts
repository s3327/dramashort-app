export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

// Mock data — stands in for a "GET /faq" response. This content will
// likely move to an admin-managed list (e.g. Admin Settings) later, so
// support can add/edit questions without a code change.
export const faqItems: FaqItem[] = [
  {
    id: "faq-1",
    question: "Is DramaShort free to use?",
    answer:
      "Yes — DramaShort is free to browse and watch. VIP plans with extra perks may be introduced later; you'll see any changes reflected in your account before they apply.",
  },
  {
    id: "faq-2",
    question: "How do I create an account?",
    answer:
      "Tap the account icon in the header, choose Sign Up with Email, and fill in your display name, email, and password. You'll get a 6-digit code by email to verify your account.",
  },
  {
    id: "faq-3",
    question: "I forgot my password. What do I do?",
    answer:
      "On the login page, select \"Forgot password?\" and enter your account email. We'll send a reset code to that address.",
  },
  {
    id: "faq-4",
    question: "How does Continue Watching work?",
    answer:
      "Whenever you start an episode, we save your progress. The next time you visit Home, that title appears in Continue Watching so you can pick up right where you left off.",
  },
  {
    id: "faq-5",
    question: "How do Lists work?",
    answer:
      "From your Favorites page, create a list, then add titles to it using the Add to List button on any favorited title. Lists are a way to organize your favorites into groups.",
  },
  {
    id: "faq-6",
    question: "How far back does my watch history go?",
    answer:
      "Your History page shows activity from today back to 60 days ago. Older activity isn't deleted — it's simply outside the window currently shown on that page.",
  },
  {
    id: "faq-7",
    question: "A video isn't playing — what should I do?",
    answer:
      "Try refreshing the page first. If it still doesn't work, go to Contact Us, choose Report as the subject, then Video Not Working, and let us know which title and episode.",
  },
  {
    id: "faq-8",
    question: "Can I request a title that isn't on DramaShort yet?",
    answer:
      "Yes — go to Contact Us and choose Request Title as the subject. Include the title name and, if you have it, the channel or studio it's from.",
  },
  {
    id: "faq-9",
    question: "What's a Channel?",
    answer:
      "A Channel is the studio or publisher a title comes from — similar to what some platforms call a \"provider.\" You can browse all titles from a channel from the Channel menu in the header.",
  },
  {
    id: "faq-10",
    question: "Can I connect my Telegram account?",
    answer:
      "Yes — from Account settings, you can optionally link your Telegram account, giving you another way to sign in through our Telegram bot.",
  },
  {
    id: "faq-11",
    question: "How do I delete my account?",
    answer:
      "Go to Account > Setting and select Delete Account. You'll be asked to confirm — this permanently removes your profile, favorites, lists, and watch history.",
  },
];
