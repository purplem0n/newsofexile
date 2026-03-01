# Twitch Integration

When there's a new patch or news from either poe1 or poe2, the server will send a chat message to all live channels in Twitch for that same category. Should trigger for both `news_items` and `patch_note_updates` tables. Example:

- New patch for poe1 -> Sends chat alert to Live channels in `Path of Exile` category.

# Auth

The .env file already has all secret variables we need.

- ACCESS_TOKEN & REFRESH_TOKEN -> only use this when database does not have the tokens. and save this initially as well.
- Every 24hrs, refresh the access token and update the database.
- TWITCH_CLIENT_ID & TWITCH_CLIENT_SECRET are both provided already as well in .env

# Logic/Flow

1. Obtain list of live channels for POE1 or POE2 category. Example:

```bash
curl --location 'https://api.twitch.tv/helix/streams?first=100&language=en&type=live&game_id=29307' \
--header 'client-id: TWITCH_CLIENT_ID' \
--header 'Authorization: Bearer $accessTokenFromDB'
# `first` means number of items per page, we should send chats to all live channels so we paginate util no more page (max is 100 per page)
# 29307 = Path of Exile or use POE1_TWITCH_ID

curl --location 'https://api.twitch.tv/helix/streams?first=100&language=en&type=live&game_id=1702520304' \
--header 'client-id: TWITCH_CLIENT_ID' \
--header 'Authorization: Bearer $accessTokenFromDB'
# 1702520304 = Path of Exile 2 or use POE2_TWITCH_ID
```

Example response:

```json
{
  "data": [
    {
      "id": "316526467672",
      "user_id": "88147955",
      "user_login": "misoxshiru",
      "user_name": "MisoxShiru",
      "game_id": "1702520304",
      "game_name": "Path of Exile 2",
      "type": "live",
      "title": "ANCIENT BONES FARM ACTUALLY WORKS! Doing Control Testing Tonight. !ef !tierlist !abyss !build !exitlag",
      "viewer_count": 227,
      "started_at": "2026-03-01T08:02:32Z",
      "language": "en",
      "thumbnail_url": "https://static-cdn.jtvnw.net/previews-ttv/live_user_misoxshiru-{width}x{height}.jpg",
      "tag_ids": [],
      "tags": ["kpop", "English", "NewPlayersWelcome", "jpop", "Anime"],
      "is_mature": false
    },
    {
      "id": "315318610152",
      "user_id": "855498565",
      "user_login": "real_ninja_power",
      "user_name": "Real_Ninja_Power",
      "game_id": "1702520304",
      "game_name": "Path of Exile 2",
      "type": "live",
      "title": "Building new Temple !Mirror !Lock !lock1 !Pob !Filter 923 days no Drinking 895  no Smoking",
      "viewer_count": 79,
      "started_at": "2026-03-01T00:36:32Z",
      "language": "en",
      "thumbnail_url": "https://static-cdn.jtvnw.net/previews-ttv/live_user_real_ninja_power-{width}x{height}.jpg",
      "tag_ids": [],
      "tags": ["Project", "Amazon", "BloodMage", "Coc", "POE2"],
      "is_mature": false
    }
  ],
  "pagination": {
    "cursor": "eyJiIjp7IkN1cnNvciI6ImV5SnpJam95TWpjdU5USTBOakE1TVRRNU1Ea3dNVGNzSW1RaU9tWmhiSE5sTENKMElqcDBjblZsZlE9PSJ9LCJhIjp7IkN1cnNvciI6ImV5SnpJam80TWk0ME5ERTROVGd5TnpZMk5UYzROQ3dpWkNJNlptRnNjMlVzSW5RaU9uUnlkV1Y5In19"
  }
}
```

2. Send chats to each channel (one by one, there is no batch api). Example:

```bash
curl --location 'https://api.twitch.tv/helix/chat/messages' \
--header 'client-id: TWITCH_CLIENT_ID' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $accessTokenFromDB' \
--data '{
    "broadcaster_id": "230719137",
    "sender_id": "1452023249",
    "message": "Hello, world!"
}'

# broadcaster_id is same as user_id
# use TWITCH_SENDER_ID for sender_id (the initial tokens i provided from .env is same user as TWITCH_SENDER_ID)
```

# Dry-run Mode

I don't want for this to go in production immediately so let's implement a DRY-RUN mode that only sends chat message to a channel I chose which is TWITCH_DRY_RUN_CHANNEL_ID from .env
Still implement the real logic code for the actual twitch flow, just have a conditional for DRY-RUN mode
```bash
# from .env:
TWITCH_DRY_RUN_CHANNEL_ID="230719137" # a channel id on twitch for testing (different account from TWITCH_SENDER_ID)
DRY_RUN_MODE=1 # 1 = dry run mode, 0 = real mode
```
When dry run mode is enabled, broadcaster_id = TWITCH_DRY_RUN_CHANNEL_ID (only send to this channel id)

# Rate-limits
Twitch Chat Rate Limits:
20 Messages per 30 seconds (global, across all channels)
So we can send a chat every 1500ms
I want to implement this properly where we measure the latency of the previous send chat call. Example:
```typescript
const startTime = new DateTime.now();
const { response } = await sendChat('hello world');
const endTime = new DateTime.now();
const diff = endTime - startTime; // let's say it took 120ms, it means we only need to wait 1380ms for the next send. For safety, let's add +15ms as margin in the wait time to not encounter Rate-limits edge case.
```

# Error-handling
There are many reasons a chat could fail to send:
- Followers-only chat
- Follower-age chat (if you just followed, you have to wait a certain amount of time, the wait-time is configured by the streamer, we can't know this)
- Banned/blocked/restricted/timeouted
- Sub-only
- Some other unexpected errors
- etc.
The point is we should just ignore any chat send errors and go to the next channel item in the loop without breaking the whole loop.
DO NOT implement auto follow for now.