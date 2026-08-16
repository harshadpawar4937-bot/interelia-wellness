# Instagram Graph API setup (Interelia Wellness)

Use this when you want **live sync** of Reels from:

- `@interelia.pharmacy`
- `@interelialifescience`
- `@tata1mgwellness`

Manual curated reels and Instagram embeds work **without** this setup.

## Requirements

1. Meta Developer App with **Instagram Graph API**
2. Instagram accounts converted to **Professional** (Business or Creator) and linked to a Facebook Page
3. Long-lived Page / Instagram User access token with permissions such as:
   - `instagram_basic`
   - `instagram_manage_insights` (optional)
   - `pages_show_list` / `pages_read_engagement` as required by Meta’s current docs

## Configure `.env`

```env
INSTAGRAM_ACCESS_TOKEN=EAAB...your_long_lived_token
# handle:instagram_business_account_id pairs
INSTAGRAM_ACCOUNTS=interelia.pharmacy:17841400000000000,interelialifescience:17841400000000001,tata1mgwellness:17841400000000002
```

Find each IG user id via Graph API Explorer:

`GET /me/accounts` → page → `instagram_business_account{id,username}`

## Admin flow

1. Open **Content → Instagram Sync**
2. Confirm accounts show `ig_user_id` and `token_configured`
3. Click **Sync now** — new media arrive as **unpublished drafts**
4. Open **Reels**, attach products, set display mode, **Publish**

## Notes

- Sync never auto-publishes (homepage stays curated)
- If the token is missing or invalid, sync returns a clear error; storefront still shows manually published reels
- App Review is required before production tokens work for non-admin testers
