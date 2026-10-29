# SMI Delivery Challan — Backend

Express + MongoDB API for SRI MEENAKSHI INDUSTRIES delivery challans.

## Setup

```bash
cp .env.example .env
# edit MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

API runs on http://localhost:4000

## API

- `POST /api/auth/register|login`
- `GET/POST/PUT/DELETE /api/customers`
- `GET/POST/PUT/DELETE /api/items`
- `GET/POST/PUT/DELETE /api/challans`
- `GET /api/challans/:id/pdf`
