export async function GET() {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'You are offline and no cached data is available',
      timestamp: new Date().toISOString(),
      cached: true
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}