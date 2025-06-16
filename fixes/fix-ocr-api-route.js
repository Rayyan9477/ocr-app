// Add this to the top of your OCR API route files (e.g., app/api/ocr/route.js)

/*
import { createSafeJsonResponse } from '@/app/api/safe-response-handler';

// Replace instances of:
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
});

// With:
return createSafeJsonResponse(data);

// And replace instances of:
return new Response(JSON.stringify({
  success: false,
  error: "Error message"
}), {
  status: 500,
  headers: {
    'Content-Type': 'application/json',
  },
});

// With:
return createSafeJsonResponse({
  success: false,
  error: "Error message"
}, 500);
*/
