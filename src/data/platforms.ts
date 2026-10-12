// Existing use-case URLs remain stable. Compatibility is not inferred from a signup form.
// Official sources support the notes below; acceptance has not been tested unless stated.
export type PlatformCategory = 'social' | 'gaming' | 'streaming' | 'finance' | 'ai' | 'productivity' | 'shopping';
export type Platform = {
  slug: string; name: string; category: PlatformCategory; initials: string;
  oneLiner: string; guidance: string;
  suitability: 'unverified' | 'blocked' | 'phone-required' | 'permanent-email';
  source?: { title: string; url: string; note: string };
  relatedSlugs: string[];
};
export const CATEGORIES: Record<PlatformCategory, { label: string; blurb: string }> = {
  social: { label: 'Social', blurb: 'Social networks and messaging apps' },
  gaming: { label: 'Gaming', blurb: 'Games, marketplaces, and game launchers' },
  streaming: { label: 'Streaming', blurb: 'Video and audio streaming services' },
  finance: { label: 'Finance', blurb: 'Why payment accounts need permanent email' },
  ai: { label: 'AI tools', blurb: 'AI assistants and creative tools' },
  productivity: { label: 'Productivity', blurb: 'Work tools and collaboration apps' },
  shopping: { label: 'Shopping', blurb: 'Orders and account recovery' },
};
export const suitabilityLabels = {
  unverified: 'Acceptance unverified',
  blocked: 'Disposable email blocked',
  'phone-required': 'Email does not replace phone',
  'permanent-email': 'Use permanent email',
};
export const platforms: Platform[] = [
  {
    "slug": "discord",
    "name": "Discord",
    "category": "social",
    "initials": "DC",
    "oneLiner": "Voice, video and text chat for gaming and online communities.",
    "guidance": "Keep a lasting email address on a Discord account you want to retain. A temporary inbox cannot replace phone verification or other server requirements. If you only need a one-time message, check that the service permits disposable addresses first.",
    "suitability": "unverified",
    "source": {
      "title": "Discord account verification requirements",
      "url": "https://support.discord.com/hc/en-us/articles/6181726888215-How-to-Verify-Your-Discord-Account",
      "note": "Discord documents both email and phone verification. A server can require account verification; email alone may not satisfy every requirement."
    },
    "relatedSlugs": [
      "reddit",
      "telegram",
      "steam",
      "twitch"
    ]
  },
  {
    "slug": "reddit",
    "name": "Reddit",
    "category": "social",
    "initials": "RD",
    "oneLiner": "The front page of the internet — communities for every interest.",
    "guidance": "Use an email address you can keep for a Reddit account whose posts, moderation roles, or community access matter to you. An expiring inbox is a poor recovery address even if a signup form accepts it.",
    "suitability": "unverified",
    "relatedSlugs": [
      "discord",
      "twitter",
      "telegram",
      "tiktok"
    ]
  },
  {
    "slug": "twitter",
    "name": "Twitter / X",
    "category": "social",
    "initials": "X",
    "oneLiner": "Public conversation platform — formerly Twitter, now X.",
    "guidance": "For a Twitter / X profile you intend to keep, choose a permanent email or forwarding alias. A temporary address will stop receiving future login and recovery messages after expiry.",
    "suitability": "unverified",
    "relatedSlugs": [
      "reddit",
      "discord",
      "instagram",
      "tiktok"
    ]
  },
  {
    "slug": "tiktok",
    "name": "TikTok",
    "category": "social",
    "initials": "TT",
    "oneLiner": "Short-form video platform.",
    "guidance": "Use lasting contact details for a TikTok account that holds videos, followers, or purchases. InboxForNow can receive email only; it cannot receive SMS or satisfy phone verification.",
    "suitability": "unverified",
    "relatedSlugs": [
      "instagram",
      "twitter",
      "youtube",
      "spotify"
    ]
  },
  {
    "slug": "instagram",
    "name": "Instagram",
    "category": "social",
    "initials": "IG",
    "oneLiner": "Photo and video sharing owned by Meta.",
    "guidance": "Keep a permanent recovery address for an Instagram profile, especially one used for a business or a portfolio. Reducing signup email clutter is not worth losing access to your photos or followers.",
    "suitability": "unverified",
    "relatedSlugs": [
      "tiktok",
      "twitter",
      "reddit",
      "youtube"
    ]
  },
  {
    "slug": "telegram",
    "name": "Telegram",
    "category": "social",
    "initials": "TG",
    "oneLiner": "Cloud-based messaging with strong group features.",
    "guidance": "Telegram links accounts to phone numbers. A temporary email address does not replace a phone number you control. Use a permanent email for any recovery email you choose to configure.",
    "suitability": "phone-required",
    "source": {
      "title": "Telegram account and phone number FAQ",
      "url": "https://telegram.org/faq",
      "note": "Telegram describes each phone number as a separate account and advises keeping control of the connected phone number."
    },
    "relatedSlugs": [
      "discord",
      "reddit",
      "twitter",
      "slack"
    ]
  },
  {
    "slug": "youtube",
    "name": "YouTube",
    "category": "social",
    "initials": "YT",
    "oneLiner": "Video platform — requires a Google account.",
    "guidance": "Use a lasting Google Account for a YouTube channel or subscription. If a Google signup uses a non-Google email, that address must receive the verification message. A temporary inbox is not a Gmail account.",
    "suitability": "unverified",
    "source": {
      "title": "Verify a Google Account",
      "url": "https://support.google.com/accounts/answer/63950",
      "note": "Google sends a verification code to the non-Google email used when setting up a Google Account."
    },
    "relatedSlugs": [
      "tiktok",
      "instagram",
      "spotify",
      "netflix"
    ]
  },
  {
    "slug": "steam",
    "name": "Steam",
    "category": "gaming",
    "initials": "ST",
    "oneLiner": "The largest PC game marketplace and launcher.",
    "guidance": "Use a lasting address for a Steam account with games, purchases, or items. An inbox that expires cannot receive future account recovery messages. Keep disposable mail for unrelated one-time tasks.",
    "suitability": "unverified",
    "relatedSlugs": [
      "epic-games",
      "roblox",
      "twitch",
      "discord"
    ]
  },
  {
    "slug": "epic-games",
    "name": "Epic Games",
    "category": "gaming",
    "initials": "EG",
    "oneLiner": "Game store and launcher behind Fortnite and Unreal Engine.",
    "guidance": "Use permanent contact details for an Epic Games account that holds games or purchases. Do not connect an expiring inbox to an account you plan to keep or need to recover later.",
    "suitability": "unverified",
    "relatedSlugs": [
      "steam",
      "roblox",
      "twitch",
      "discord"
    ]
  },
  {
    "slug": "roblox",
    "name": "Roblox",
    "category": "gaming",
    "initials": "RX",
    "oneLiner": "User-generated game platform popular with younger players.",
    "guidance": "Choose a lasting recovery address for a Roblox account with creations, progress, or purchases. A disposable inbox can expire before you need the next account message.",
    "suitability": "unverified",
    "relatedSlugs": [
      "steam",
      "epic-games",
      "twitch",
      "discord"
    ]
  },
  {
    "slug": "twitch",
    "name": "Twitch",
    "category": "gaming",
    "initials": "TV",
    "oneLiner": "Live streaming platform for games, music, and creators.",
    "guidance": "For a Twitch channel, subscription, or community identity you want to keep, use permanent email. An expiring inbox is unsuitable for ongoing account notices and recovery.",
    "suitability": "unverified",
    "relatedSlugs": [
      "steam",
      "roblox",
      "discord",
      "youtube"
    ]
  },
  {
    "slug": "netflix",
    "name": "Netflix",
    "category": "streaming",
    "initials": "NF",
    "oneLiner": "Subscription video streaming.",
    "guidance": "Use permanent email for a Netflix subscription so you can receive future account and billing messages. A temporary address does not change subscription eligibility or payment requirements.",
    "suitability": "unverified",
    "relatedSlugs": [
      "spotify",
      "youtube",
      "twitch",
      "discord"
    ]
  },
  {
    "slug": "spotify",
    "name": "Spotify",
    "category": "streaming",
    "initials": "SP",
    "oneLiner": "Music and podcast streaming.",
    "guidance": "Keep a lasting email address for a Spotify account with playlists or a paid subscription. Disposable email is better suited to one-time messages that do not require later account recovery.",
    "suitability": "unverified",
    "relatedSlugs": [
      "netflix",
      "youtube",
      "twitch",
      "tiktok"
    ]
  },
  {
    "slug": "paypal",
    "name": "PayPal",
    "category": "finance",
    "initials": "PP",
    "oneLiner": "Online payments and money transfer.",
    "guidance": "We recommend permanent email for PayPal. Payment accounts need a reliable contact and recovery channel, and an inbox that expires is unsuitable for financial records or account access.",
    "suitability": "permanent-email",
    "relatedSlugs": [
      "venmo",
      "stripe",
      "amazon",
      "paypal"
    ]
  },
  {
    "slug": "venmo",
    "name": "Venmo",
    "category": "finance",
    "initials": "VM",
    "oneLiner": "Mobile payments owned by PayPal — popular in the US.",
    "guidance": "We recommend permanent email for Venmo. Do not depend on a temporary inbox for payment notices, transaction records, or future recovery of a financial account.",
    "suitability": "permanent-email",
    "relatedSlugs": [
      "paypal",
      "stripe",
      "amazon",
      "instagram"
    ]
  },
  {
    "slug": "stripe",
    "name": "Stripe",
    "category": "finance",
    "initials": "SR",
    "oneLiner": "Payments infrastructure for businesses and developers.",
    "guidance": "We recommend permanent email for a Stripe business account. For testing your own application, a disposable inbox can receive test notifications when your test setup permits it; do not use it as the account owner email.",
    "suitability": "permanent-email",
    "relatedSlugs": [
      "paypal",
      "venmo",
      "github",
      "notion"
    ]
  },
  {
    "slug": "chatgpt",
    "name": "ChatGPT",
    "category": "ai",
    "initials": "CG",
    "oneLiner": "OpenAI's flagship chatbot product.",
    "guidance": "Use an email address you can keep for a ChatGPT account, especially one with saved conversations or a subscription. If you lose access to an account inbox, login troubleshooting may not restore email access.",
    "suitability": "unverified",
    "source": {
      "title": "ChatGPT login troubleshooting",
      "url": "https://help.openai.com/en/articles/7426629-why-cant-i-log-in-to-chatgpt",
      "note": "OpenAI warns that self-service troubleshooting cannot solve loss of access to the inbox used for account emails."
    },
    "relatedSlugs": [
      "claude",
      "gemini",
      "notion",
      "github"
    ]
  },
  {
    "slug": "claude",
    "name": "Claude",
    "category": "ai",
    "initials": "CL",
    "oneLiner": "Anthropic's AI assistant.",
    "guidance": "Use a lasting address for a Claude account whose conversations or subscription you want to keep. An expiring inbox is unsuitable whenever you may need another email to sign in later.",
    "suitability": "unverified",
    "relatedSlugs": [
      "chatgpt",
      "gemini",
      "github",
      "notion"
    ]
  },
  {
    "slug": "gemini",
    "name": "Gemini",
    "category": "ai",
    "initials": "GM",
    "oneLiner": "Google's flagship AI assistant.",
    "guidance": "Use a lasting Google Account for Gemini. Google can verify a non-Google signup email by sending it a code, but a temporary address is not a Gmail inbox and is unsuitable for long-term recovery.",
    "suitability": "unverified",
    "source": {
      "title": "Verify a Google Account",
      "url": "https://support.google.com/accounts/answer/63950",
      "note": "Google sends a verification code to the non-Google email used when setting up a Google Account."
    },
    "relatedSlugs": [
      "chatgpt",
      "claude",
      "youtube",
      "github"
    ]
  },
  {
    "slug": "notion",
    "name": "Notion",
    "category": "productivity",
    "initials": "NT",
    "oneLiner": "All-in-one workspace for notes, docs, and project tracking.",
    "guidance": "Choose a lasting email for a Notion workspace containing notes, documents, or team information. Avoid connecting important workspace access to an inbox with a short expiry timer.",
    "suitability": "unverified",
    "relatedSlugs": [
      "github",
      "slack",
      "stripe",
      "discord"
    ]
  },
  {
    "slug": "github",
    "name": "GitHub",
    "category": "productivity",
    "initials": "GH",
    "oneLiner": "Code hosting and collaboration platform owned by Microsoft.",
    "guidance": "GitHub explicitly says disposable email addresses cannot be verified. Use a lasting account email and GitHub’s noreply address for private commits. A noreply address does not receive account mail.",
    "suitability": "blocked",
    "source": {
      "title": "GitHub email verification restrictions",
      "url": "https://docs.github.com/en/account-and-profile/reference/email-addresses-reference",
      "note": "GitHub explicitly excludes disposable email services from verification and points users to its noreply address for commit privacy."
    },
    "relatedSlugs": [
      "notion",
      "slack",
      "stripe",
      "discord"
    ]
  },
  {
    "slug": "slack",
    "name": "Slack",
    "category": "productivity",
    "initials": "SL",
    "oneLiner": "Team messaging owned by Salesforce.",
    "guidance": "Use a lasting email address for ongoing Slack workspace access. A temporary inbox cannot receive future sign-in or recovery messages once it expires. Ask the workspace owner about permitted account email domains.",
    "suitability": "unverified",
    "relatedSlugs": [
      "notion",
      "github",
      "discord",
      "stripe"
    ]
  },
  {
    "slug": "amazon",
    "name": "Amazon",
    "category": "shopping",
    "initials": "AZ",
    "oneLiner": "Online marketplace.",
    "guidance": "Use permanent email for an Amazon account you use for orders. Receipts, delivery updates, returns, and future account recovery can outlast the temporary inbox timer.",
    "suitability": "unverified",
    "relatedSlugs": [
      "paypal",
      "stripe",
      "venmo",
      "netflix"
    ]
  }
];
export const platformMap = Object.fromEntries(platforms.map((p) => [p.slug, p]));
export function platformsByCategory(category: PlatformCategory): Platform[] {
  return platforms.filter((p) => p.category === category);
}
export function getRelated(p: Platform): Platform[] {
  return p.relatedSlugs.map((s) => platformMap[s]).filter(Boolean);
}
