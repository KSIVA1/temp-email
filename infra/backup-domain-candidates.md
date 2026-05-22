# Backup receiving domains (pre-staged, do not register until needed)

If `veqla.com` is blacklisted or stops receiving mail, register one of these and plug it into Cloudflare Email Routing + `domains` table within ~60 minutes.

Criteria (strategy §9): innocuous name, `.com`, no `temp|trash|burner|disposable` substrings.

| Candidate | Notes |
|-----------|-------|
| *(add 2 shortlist names here before launch)* | e.g. invented brandable .com, checked for obvious blacklist on Spamhaus DBL |

After registering: run `npm run infra:email-routing` with the new domain, then `INSERT INTO domains (name, status, added_at) VALUES ('newdomain.com', 'active', unixepoch())`.
