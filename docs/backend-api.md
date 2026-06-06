# Home-Made Backend API

These Vercel serverless routes provide the first backend layer between the browser app and Supabase.

## Environment Variables

Required in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is used only by serverless API routes. It must never be exposed in browser JavaScript.

## Auth

Protected endpoints expect the user's Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
```

The API validates the token with Supabase Auth, loads the user's `profiles` row, and applies role checks where needed.

## Endpoints

### `GET /api/health`

Public health check.

Returns:

```json
{"ok":true,"service":"home-made-api","version":"v1"}
```

### `GET /api/admin/settings`

Returns public managed settings:

- `announcement_banner`
- `home_content`

### `PATCH /api/admin/settings`

Admin only. Updates managed site settings.

Body:

```json
{
  "settings": {
    "announcement_banner": {
      "visible": true,
      "message": "Testing phase",
      "background": "#3a2800",
      "foreground": "#fff8e8",
      "expiresAt": ""
    }
  }
}
```

### `GET /api/want-list`

Authenticated. Returns the current user's want-list items.

### `POST /api/want-list`

Authenticated. Adds or updates one want-list item.

Body:

```json
{
  "item": "Vegetarian supper",
  "source": "app",
  "sellerId": null,
  "metadata": {}
}
```

### `DELETE /api/want-list`

Authenticated. Removes by `id` or `item`.

Body:

```json
{"item":"Vegetarian supper"}
```

### `GET /api/messages`

Authenticated. Returns messages related to the current user.

- Admins can read all.
- Sellers can read messages linked to their seller id.
- Buyers can read messages they sent/received.

### `POST /api/messages`

Authenticated. Creates a message.

Body:

```json
{
  "subject": "Question about menu",
  "body": "Do you have vegetarian options?",
  "toRole": "seller",
  "toId": "1",
  "toLabel": "Mama's Lunchbox"
}
```

### `PATCH /api/messages`

Authenticated. Marks a related message read/unread.

Body:

```json
{"id":"message-uuid","read":true}
```

### `GET /api/ratings`

Authenticated.

- Admins can read all ratings.
- Sellers can pass `?sellerId=1` for their own ratings.
- Buyers without seller ownership get their submitted ratings.

### `POST /api/ratings`

Supports two actions.

Generate a rating token, seller/admin only:

```json
{
  "action": "generate-token",
  "sellerId": 1,
  "buyerRef": "Order HMO-123",
  "orderCode": "HMO-123",
  "orderCodeVerified": true,
  "deviceFingerprint": "optional"
}
```

Submit a rating, authenticated:

```json
{
  "action": "submit",
  "token": "HMR-...",
  "stars": 5,
  "comment": "Excellent food and friendly service.",
  "dwellMs": 25000,
  "deviceFingerprint": "optional"
}
```

## Recommended Frontend Migration Order

1. Use `/api/ratings` for token generation and rating submission.
2. Use `/api/want-list` for want-list load/add/remove.
3. Use `/api/messages` for message load/send/read state.
4. Use `/api/admin/settings` for admin content controls.
