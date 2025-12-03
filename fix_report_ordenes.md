# Fix Report: Order Creation Issue

## Problem
The user reported that creating a new order was failing with a 404 error (`Failed to load resource: the server responded with a status of 404 (Not Found) :3000/api/ordenes`).

## Diagnosis
1.  **Frontend**: The `createOrden` function in `frontend/services/ordenes-service.js` correctly sends a POST request to `http://localhost:3000/api/ordenes`.
2.  **Backend**: The `backend/routes/ordenes.js` file exists and defines the POST route.
3.  **Root Cause**: The `ordenes` router was **not mounted** in the main backend entry point (`backend/index.js`). This meant the application was not listening for requests at `/api/ordenes`, resulting in a 404 error.

## Solution Applied
I have modified `backend/index.js` to import and use the `ordenes` router.

```javascript
// backend/index.js

// ... existing routes ...
app.use('/api/compras', require('./routes/compras'));
app.use('/api/ordenes', require('./routes/ordenes')); // Added this line
// ...
```

## Next Steps for User
**You must restart your backend server** for these changes to take effect.
1.  Stop the currently running backend process (Ctrl+C).
2.  Start it again (e.g., `npm run dev` or `node index.js`).
3.  Try creating the order again.
